import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BookingStatus } from '@prisma/client';

@Processor('bookings-pipeline')
export class BookingsProcessor extends WorkerHost {
  private readonly logger = new Logger(BookingsProcessor.name);

  constructor(private prisma: PrismaService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing BullMQ Job [${job.id}] of type [${job.name}]`);

    const { bookingId } = job.data;
    if (!bookingId) {
      this.logger.warn(`Job ${job.id} missing bookingId, skipping.`);
      return { success: false, reason: 'missing bookingId' };
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      this.logger.warn(`Booking with ID ${bookingId} not found, skipping.`);
      return { success: false, reason: 'booking not found' };
    }

    if (job.name === 'booking_submitted') {
      this.logger.log(`Job [booking_submitted] for booking ${bookingId}`);

      // Simulate external operations (Stripe & e-sign stubs)
      this.logger.log(`>> SIMULATING STRIPE INVOICE & PAYOUT PIPELINE CREATION`);
      this.logger.log(`>> Created Stripe Invoice Draft for: $${booking.guaranteedBudget}`);

      this.logger.log(`>> SIMULATING DOCUSIGN / PANDADOC TEMPLATE DISCOVERY`);
      this.logger.log(`>> Found NDA and Long-form rider templates for venue: "${booking.venueName}"`);

      // Advance status from PENDING_REVIEW to OFFER_PENDING automatically for demo
      await this.prisma.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.OFFER_PENDING },
      });
      this.logger.log(`>> Automatically advanced booking ${bookingId} status to [OFFER_PENDING] for Demo Offer Desk vetting.`);

      return { success: true, step: 'booking_submitted_processed' };
    }

    if (job.name === 'offer_approved') {
      this.logger.log(`Job [offer_approved] for booking ${bookingId}`);
      this.logger.log(`>> Generating NDA signature URL via mock DocuSign SDK...`);

      // Seed a draft Contract of type NDA in the system
      await this.prisma.contract.create({
        data: {
          bookingId,
          contractType: 'NDA',
          documentUrl: 'https://wme-vault.s3.amazonaws.com/contracts/draft_nda.pdf',
          signerId: booking.buyerId,
          isSigned: false,
        },
      });

      // Advance to NDA_PENDING (already set or verified)
      this.logger.log(`>> Contract record created and NDA signature pending inside portal vault.`);
      return { success: true, step: 'offer_approved_processed' };
    }

    this.logger.warn(`Unknown job name: ${job.name}`);
    return { success: false, reason: 'unknown job name' };
  }
}
