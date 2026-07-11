import { Controller, Post, Headers, Body, BadRequestException, HttpCode, HttpStatus, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BookingStatus, TransactionType, TransactionStatus } from '@prisma/client';
import * as crypto from 'crypto';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private prisma: PrismaService) {}

  @Post('events')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('x-wme-signature') signature: string,
    @Body() payload: any,
  ) {
    if (!signature) {
      throw new UnauthorizedException('Missing x-wme-signature header');
    }

    const secret = process.env.WEBHOOK_SECRET || 'wme_hmac_webhook_secret_key';

    // Verify HMAC signature
    const hmac = crypto.createHmac('sha256', secret);
    const expectedSignature = hmac.update(JSON.stringify(payload)).digest('hex');

    if (signature !== expectedSignature) {
      this.logger.warn(`Signature mismatch. Expected: ${expectedSignature}, Received: ${signature}`);
      throw new UnauthorizedException('Invalid HMAC signature verification failed');
    }

    this.logger.log(`Received cryptographically verified webhook event: ${payload.event}`);

    // Reconcile e-sign or payment callback with DB ACID transitions
    const { bookingId, event } = payload;
    if (!bookingId) {
      throw new BadRequestException('Payload missing bookingId');
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new BadRequestException(`Booking with id ${bookingId} not found`);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      if (event === 'payment.deposit_cleared') {
        // Confirm booking in DB + update transaction status + seed ledger
        await tx.booking.update({
          where: { id: bookingId },
          data: { status: BookingStatus.CONFIRMED },
        });

        await tx.financialTransaction.create({
          data: {
            bookingId,
            type: TransactionType.DEPOSIT,
            amount: booking.guaranteedBudget.mul(0.5), // 50% deposit
            status: TransactionStatus.CLEARED,
            reference: payload.reference || 'webhook_wire_deposit_123',
            clearedAt: new Date(),
          },
        });

        // Upsert Financial Ledger for Talent
        const commission = booking.guaranteedBudget.mul(0.15); // 15% agency commission
        const withholding = booking.guaranteedBudget.mul(0.20); // 20% tax withholding
        const netPayout = booking.guaranteedBudget.sub(commission).sub(withholding);

        await tx.financialLedger.create({
          data: {
            bookingId,
            talentId: booking.talentId,
            grossEarnings: booking.guaranteedBudget,
            agencyCommission: commission,
            taxWithholding: withholding,
            netPayout,
            payoutStatus: 'AWAITING_CLEARANCE',
          },
        });

        this.logger.log(`ACID state transitioned booking ${bookingId} to CONFIRMED with financial ledgers generated.`);
        return { success: true, message: 'Deposit cleared and booking confirmed' };
      }

      if (event === 'esign.nda_signed') {
        await tx.booking.update({
          where: { id: bookingId },
          data: { status: BookingStatus.NDA_SIGNED },
        });

        await tx.contract.create({
          data: {
            bookingId,
            contractType: 'NDA',
            documentUrl: payload.documentUrl || 'https://wme-vault.s3.amazonaws.com/contracts/nda.pdf',
            isSigned: true,
            signedAt: new Date(),
            signerId: booking.buyerId,
          },
        });

        this.logger.log(`ACID state transitioned booking ${bookingId} to NDA_SIGNED.`);
        return { success: true, message: 'NDA signed and logged' };
      }

      if (event === 'esign.longform_signed') {
        await tx.booking.update({
          where: { id: bookingId },
          data: { status: BookingStatus.CONTRACT_SIGNED },
        });

        await tx.contract.create({
          data: {
            bookingId,
            contractType: 'LONG_FORM',
            documentUrl: payload.documentUrl || 'https://wme-vault.s3.amazonaws.com/contracts/long_form.pdf',
            isSigned: true,
            signedAt: new Date(),
            signerId: booking.buyerId,
          },
        });

        this.logger.log(`ACID state transitioned booking ${bookingId} to CONTRACT_SIGNED.`);
        return { success: true, message: 'Long form contract signed and logged' };
      }

      this.logger.warn(`Unrecognized webhook event type: ${event}`);
      return { success: false, message: 'Unrecognized event' };
    });

    return result;
  }
}
