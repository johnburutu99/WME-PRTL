import {
  Controller,
  Post,
  Headers,
  Body,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Logger,
  UnauthorizedException,
  RawBody,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { BookingStatus, TransactionType, TransactionStatus } from '@prisma/client';
import * as crypto from 'crypto';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);
  private readonly webhookSecret: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    const secret = this.configService.get<string>('WEBHOOK_SECRET');
    if (!secret) {
      throw new Error('FATAL: WEBHOOK_SECRET is not configured.');
    }
    this.webhookSecret = secret;
  }

  @Post('events')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('x-wme-signature') signature: string,
    @RawBody() rawBody: Buffer,
    @Body() payload: any,
  ) {
    if (!signature) {
      throw new UnauthorizedException('Missing x-wme-signature header');
    }

    if (!rawBody || rawBody.length === 0) {
      throw new BadRequestException('Empty request body');
    }

    // Verify HMAC against the raw body bytes — not a re-serialized object
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      this.logger.warn(`Webhook HMAC signature mismatch — potential forgery attempt.`);
      throw new UnauthorizedException('Invalid HMAC signature');
    }

    this.logger.log(`Verified webhook event received: ${payload.event}`);

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
        await tx.booking.update({
          where: { id: bookingId },
          data: { status: BookingStatus.CONFIRMED },
        });

        await tx.financialTransaction.create({
          data: {
            bookingId,
            type: TransactionType.DEPOSIT,
            amount: booking.guaranteedBudget.mul(0.5),
            status: TransactionStatus.CLEARED,
            reference: payload.reference || 'webhook_wire_deposit',
            clearedAt: new Date(),
          },
        });

        const commission = booking.guaranteedBudget.mul(0.15);
        const withholding = booking.guaranteedBudget.mul(0.20);
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

        this.logger.log(`Booking ${bookingId} → CONFIRMED with ledger entries created.`);
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

        this.logger.log(`Booking ${bookingId} → NDA_SIGNED.`);
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

        this.logger.log(`Booking ${bookingId} → CONTRACT_SIGNED.`);
        return { success: true, message: 'Long form contract signed and logged' };
      }

      this.logger.warn(`Unrecognized webhook event type: ${event}`);
      return { success: false, message: 'Unrecognized event' };
    });

    return result;
  }
}
