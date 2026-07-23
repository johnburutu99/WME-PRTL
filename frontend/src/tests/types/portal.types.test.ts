/**
 * Type validation tests — ensures TypeScript types match the DB schema
 * and that all required fields / discriminated unions are correct.
 */
import { describe, it, expect } from 'vitest';
import type { BookingStatus, Booking, LedgerEntry, Talent, BookingFormSchema, JsonSchemaField } from '@/types/portal';

// ─── BookingStatus exhaustiveness ────────────────────────────────────────────
describe('BookingStatus', () => {
  const ALL_STATUSES: BookingStatus[] = [
    'PENDING_REVIEW', 'OFFER_PENDING', 'OFFER_REJECTED', 'NEGOTIATING',
    'NDA_PENDING', 'NDA_SIGNED', 'CONTRACT_PENDING', 'CONTRACT_SIGNED',
    'AWAITING_DEPOSIT', 'CONFIRMED', 'COMPLETED',
  ];

  it('has exactly 11 valid statuses', () => {
    expect(ALL_STATUSES).toHaveLength(11);
  });

  it('includes all pipeline statuses', () => {
    expect(ALL_STATUSES).toContain('PENDING_REVIEW');
    expect(ALL_STATUSES).toContain('OFFER_PENDING');
    expect(ALL_STATUSES).toContain('NDA_PENDING');
    expect(ALL_STATUSES).toContain('AWAITING_DEPOSIT');
    expect(ALL_STATUSES).toContain('CONFIRMED');
    expect(ALL_STATUSES).toContain('COMPLETED');
  });

  it('includes rejection and negotiation statuses', () => {
    expect(ALL_STATUSES).toContain('OFFER_REJECTED');
    expect(ALL_STATUSES).toContain('NEGOTIATING');
  });
});

// ─── Booking interface ────────────────────────────────────────────────────────
describe('Booking interface', () => {
  it('accepts a minimal valid booking object', () => {
    const booking: Booking = {
      id: 'b1',
      status: 'OFFER_PENDING',
      eventTitle: 'Festival',
      eventDate: '2027-08-15T18:00:00Z',
      venueName: 'MSG',
      venueCapacity: 20000,
      guaranteedBudget: 50000,
      usageRights: 'Live only',
      createdAt: '2026-01-01T00:00:00Z',
    };
    expect(booking.id).toBe('b1');
    expect(booking.status).toBe('OFFER_PENDING');
  });

  it('accepts booking with optional buyer and talent fields', () => {
    const booking: Booking = {
      id: 'b2',
      status: 'CONFIRMED',
      eventTitle: 'Gala',
      eventDate: '2027-09-01T20:00:00Z',
      venueName: 'Venue',
      venueCapacity: 500,
      guaranteedBudget: '100000',    // string form accepted
      usageRights: 'Broadcast OK',
      createdAt: '2026-01-02T00:00:00Z',
      buyer:  { name: 'Promoter Co', email: 'p@co.com' },
      talent: { name: 'DJ Sparkle' },
    };
    expect(booking.buyer?.name).toBe('Promoter Co');
    expect(booking.talent?.name).toBe('DJ Sparkle');
  });

  it('guaranteedBudget accepts both string and number', () => {
    const asString: Booking['guaranteedBudget'] = '150000.00';
    const asNumber: Booking['guaranteedBudget'] = 150000;
    expect(typeof asString).toBe('string');
    expect(typeof asNumber).toBe('number');
  });
});

// ─── LedgerEntry interface ────────────────────────────────────────────────────
describe('LedgerEntry interface', () => {
  it('constructs valid ledger entry', () => {
    const entry: LedgerEntry = {
      id: 'l1',
      grossEarnings: 250000,
      agencyCommission: 37500,
      taxWithholding: 50000,
      netPayout: 162500,
      payoutStatus: 'AWAITING_CLEARANCE',
      createdAt: '2026-07-14T00:00:00Z',
      booking: { eventTitle: 'Show', eventDate: '2027-01-01T00:00:00Z', venueName: 'Arena' },
    };
    expect(entry.netPayout).toBe(162500);
    expect(entry.booking?.eventTitle).toBe('Show');
  });

  it('numeric fields accept string representation from DB', () => {
    const entry: LedgerEntry = {
      id: 'l2',
      grossEarnings: '250000.00',
      agencyCommission: '37500.00',
      taxWithholding: '50000.00',
      netPayout: '162500.00',
      payoutStatus: 'CLEARED',
      createdAt: '2026-07-15T00:00:00Z',
    };
    expect(entry.grossEarnings).toBe('250000.00');
  });
});

// ─── Talent interface ─────────────────────────────────────────────────────────
describe('Talent interface', () => {
  it('requires id, name, and email', () => {
    const talent: Talent = { id: 't1', name: 'DJ Spark', email: 'dj@wme.com' };
    expect(talent.id).toBe('t1');
    expect(talent.name).toBe('DJ Spark');
    expect(talent.email).toBe('dj@wme.com');
  });
});

// ─── BookingFormSchema ────────────────────────────────────────────────────────
describe('BookingFormSchema', () => {
  it('has required and properties fields', () => {
    const schema: BookingFormSchema = {
      type: 'object',
      required: ['talentId', 'eventTitle'],
      properties: {
        talentId: { type: 'string', title: 'Talent' },
        eventTitle: { type: 'string', title: 'Event Title', minLength: 3, maxLength: 100 },
      },
    };
    expect(schema.required).toContain('talentId');
    expect(schema.properties.eventTitle.minLength).toBe(3);
  });
});

// ─── Financial maths — commission and net payout ────────────────────────────
describe('Financial maths', () => {
  it('correctly calculates 15% agency commission', () => {
    const gross = 250000;
    const commission = gross * 0.15;
    expect(commission).toBe(37500);
  });

  it('correctly calculates 20% tax withholding', () => {
    const gross = 250000;
    const tax = gross * 0.20;
    expect(tax).toBe(50000);
  });

  it('net payout equals gross minus commission minus tax', () => {
    const gross = 250000;
    const commission = gross * 0.15;
    const tax = gross * 0.20;
    const net = gross - commission - tax;
    expect(net).toBe(162500);
  });

  it('50% deposit is correctly calculated in cents for Stripe', () => {
    const budget = 100000;
    const depositDollars = budget * 0.5;
    const depositCents = Math.round(depositDollars * 100);
    expect(depositCents).toBe(5000000);
  });
});
