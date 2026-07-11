import { PrismaClient, Role, BookingStatus, TransactionType, TransactionStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with demo users and entries...');

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('password123', salt);

  // 1. Create Users
  const admin = await prisma.user.upsert({
    where: { email: 'admin@wme.com' },
    update: {},
    create: {
      email: 'admin@wme.com',
      password: hashedPassword,
      name: 'Super Agent Admin',
      role: Role.ADMIN,
    },
  });

  const agent = await prisma.user.upsert({
    where: { email: 'agent@wme.com' },
    update: {},
    create: {
      email: 'agent@wme.com',
      password: hashedPassword,
      name: 'John Agent',
      role: Role.AGENT,
    },
  });

  const buyer = await prisma.user.upsert({
    where: { email: 'buyer@b2b.com' },
    update: {},
    create: {
      email: 'buyer@b2b.com',
      password: hashedPassword,
      name: 'Alice Arena Buyer',
      role: Role.BUYER,
    },
  });

  const talent = await prisma.user.upsert({
    where: { email: 'talent@artist.com' },
    update: {},
    create: {
      email: 'talent@artist.com',
      password: hashedPassword,
      name: 'DJ Sparkle',
      role: Role.TALENT,
    },
  });

  console.log('Users created:', { admin: admin.email, agent: agent.email, buyer: buyer.email, talent: talent.email });

  // 2. Create Bookings (with multiple statuses for demonstration)
  // Booking 1: Pending review
  const bookingPending = await prisma.booking.create({
    data: {
      buyerId: buyer.id,
      talentId: talent.id,
      agentId: agent.id,
      eventTitle: 'Sparkle Summer Bash 2026',
      eventDate: new Date('2026-08-15T20:00:00Z'),
      venueName: 'Madison Square Garden',
      venueCapacity: 18000,
      guaranteedBudget: 150000.00,
      usageRights: 'Full live streaming and promotional rights.',
      status: BookingStatus.PENDING_REVIEW,
    },
  });

  // Booking 2: Offer Pending (Offer Desk)
  const bookingOffer = await prisma.booking.create({
    data: {
      buyerId: buyer.id,
      talentId: talent.id,
      agentId: agent.id,
      eventTitle: 'Vegas Sparkle Lights Festival',
      eventDate: new Date('2026-09-20T21:00:00Z'),
      venueName: 'Las Vegas Motor Speedway',
      venueCapacity: 45000,
      guaranteedBudget: 350000.00,
      usageRights: 'Commercial recording rights excluded.',
      status: BookingStatus.OFFER_PENDING,
    },
  });

  // Booking 3: Confirmed (Deposit cleared, active itinerary)
  const bookingConfirmed = await prisma.booking.create({
    data: {
      buyerId: buyer.id,
      talentId: talent.id,
      agentId: agent.id,
      eventTitle: 'DJ Sparkle World Tour - London',
      eventDate: new Date('2026-10-05T19:30:00Z'),
      venueName: 'The O2 Arena',
      venueCapacity: 20000,
      guaranteedBudget: 250000.00,
      usageRights: 'Broadcast rights negotiated separately.',
      status: BookingStatus.CONFIRMED,
      contracts: {
        create: [
          {
            contractType: 'NDA',
            documentUrl: 'https://wme-vault.s3.amazonaws.com/contracts/nda_london.pdf',
            isSigned: true,
            signedAt: new Date(),
            signerId: buyer.id,
          },
          {
            contractType: 'LONG_FORM',
            documentUrl: 'https://wme-vault.s3.amazonaws.com/contracts/longform_london.pdf',
            isSigned: true,
            signedAt: new Date(),
            signerId: buyer.id,
          },
        ],
      },
      transactions: {
        create: [
          {
            type: TransactionType.DEPOSIT,
            amount: 125000.00,
            status: TransactionStatus.CLEARED,
            reference: 'tx_stripe_london_dep_123',
            clearedAt: new Date(),
          },
        ],
      },
      ledgerEntries: {
        create: [
          {
            talentId: talent.id,
            grossEarnings: 250000.00,
            agencyCommission: 37500.00, // 15%
            taxWithholding: 50000.00, // 20%
            netPayout: 162500.00,
            payoutStatus: 'AWAITING_CLEARANCE',
          },
        ],
      },
    },
  });

  console.log('Bookings & Ledgers Seeded:', {
    pendingId: bookingPending.id,
    offerId: bookingOffer.id,
    confirmedId: bookingConfirmed.id,
  });

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
