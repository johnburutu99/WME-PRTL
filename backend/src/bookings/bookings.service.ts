import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateBookingDto, NegotiateBookingDto } from './dto/booking.dto';
import { Role, BookingStatus, TransactionType, TransactionStatus } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('bookings-pipeline') private readonly bookingsQueue: Queue,
  ) {}

  // 1. Dynamic Intake Form Schema
  getSchema() {
    return {
      type: 'object',
      required: [
        'talentId',
        'eventTitle',
        'eventDate',
        'venueName',
        'venueCapacity',
        'guaranteedBudget',
        'usageRights',
      ],
      properties: {
        talentId: {
          type: 'string',
          title: 'Select Artist / Talent',
          description: 'The talent you want to book.',
        },
        eventTitle: {
          type: 'string',
          title: 'Event Title',
          minLength: 3,
          maxLength: 100,
        },
        eventDate: {
          type: 'string',
          format: 'date-time',
          title: 'Event Date & Time',
        },
        venueName: {
          type: 'string',
          title: 'Venue Name',
        },
        venueCapacity: {
          type: 'integer',
          title: 'Venue Capacity',
          minimum: 1,
        },
        guaranteedBudget: {
          type: 'number',
          title: 'Guaranteed Budget ($)',
          minimum: 1000,
        },
        usageRights: {
          type: 'string',
          title: 'Usage / Promotional Rights',
          description: 'Specify recording or commercial usage.',
        },
      },
    };
  }

  // 2. Submit booking (Buyer intake)
  async createBooking(buyerId: string, dto: CreateBookingDto) {
    // Standard validation
    const talent = await this.prisma.user.findFirst({
      where: { id: dto.talentId, role: Role.TALENT },
    });
    if (!talent) {
      throw new BadRequestException('Target Talent not found or user is not a Talent role.');
    }

    // Default to first agent if any exists, or null
    const agent = await this.prisma.user.findFirst({
      where: { role: Role.AGENT },
    });

    const booking = await this.prisma.$transaction(async (tx) => {
      return tx.booking.create({
        data: {
          buyerId,
          talentId: dto.talentId,
          agentId: agent ? agent.id : undefined,
          eventTitle: dto.eventTitle,
          eventDate: new Date(dto.eventDate),
          venueName: dto.venueName,
          venueCapacity: dto.venueCapacity,
          guaranteedBudget: dto.guaranteedBudget,
          usageRights: dto.usageRights,
          status: BookingStatus.PENDING_REVIEW,
        },
      });
    });

    // Enqueue job for background processing (Stripe & e-sign stubs)
    await this.bookingsQueue.add('booking_submitted', {
      bookingId: booking.id,
      buyerId,
      talentId: dto.talentId,
    });

    return booking;
  }

  // 3. List bookings for RBAC scopes (Agents see all, Buyer sees theirs, Talent sees theirs)
  async getBookingsForUser(user: { id: string; role: Role }) {
    if (user.role === Role.AGENT || user.role === Role.ADMIN) {
      return this.prisma.booking.findMany({
        orderBy: { createdAt: 'desc' },
        include: { buyer: { select: { name: true, email: true } }, talent: { select: { name: true } } },
      });
    }

    if (user.role === Role.BUYER) {
      return this.prisma.booking.findMany({
        where: { buyerId: user.id },
        orderBy: { createdAt: 'desc' },
        include: { talent: { select: { name: true } } },
      });
    }

    if (user.role === Role.TALENT) {
      return this.prisma.booking.findMany({
        where: { talentId: user.id },
        orderBy: { createdAt: 'desc' },
        include: { buyer: { select: { name: true } } },
      });
    }

    return [];
  }

  // 4. Offer Desk: Talent approves/declines a deal memo
  async respondToOffer(bookingId: string, talentId: string, status: 'CONFIRMED' | 'OFFER_REJECTED') {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, talentId },
    });

    if (!booking) {
      throw new BadRequestException('Booking not found or not assigned to you.');
    }

    if (booking.status !== BookingStatus.OFFER_PENDING) {
      throw new BadRequestException(`Cannot approve/decline an offer in "${booking.status}" status.`);
    }

    const updatedStatus = status === 'CONFIRMED' ? BookingStatus.NDA_PENDING : BookingStatus.OFFER_REJECTED;

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: { status: updatedStatus },
      });

      // If approved, seed a draft ledger and transactional entries
      if (updatedStatus === BookingStatus.NDA_PENDING) {
        // Enqueue background processing for NDA/contracts generator
        await this.bookingsQueue.add('offer_approved', {
          bookingId: booking.id,
        });
      }

      return updated;
    });

    return result;
  }

  // 5. Secure Financial Vault & Ledger Retrieve
  async getLedgerForTalent(talentId: string) {
    return this.prisma.financialLedger.findMany({
      where: { talentId },
      include: {
        booking: {
          select: {
            eventTitle: true,
            eventDate: true,
            venueName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Helper: Force Booking Status Update (used for agent flow & demo triggers)
  async updateStatus(bookingId: string, status: BookingStatus) {
    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { status },
    });
  }
}
