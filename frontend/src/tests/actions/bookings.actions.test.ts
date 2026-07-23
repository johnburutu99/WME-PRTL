import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted ensures these are available before vi.mock hoisting runs
const { mockGetUser, mockFrom, mockFetch } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom:    vi.fn(),
  mockFetch:   vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

vi.stubGlobal('fetch', mockFetch);

import {
  getBookingSchema, getTalents, getBookings,
  createBooking, respondToOffer, getLedger,
} from '@/lib/actions/bookings.actions';

function makeChain(resolved: unknown) {
  const chain: Record<string, unknown> = {};
  ['select','eq','order','limit','insert','update','single'].forEach(m => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue(resolved);
  (chain.order  as ReturnType<typeof vi.fn>).mockResolvedValue(resolved);
  (chain.insert as ReturnType<typeof vi.fn>).mockResolvedValue(resolved);
  (chain.update as ReturnType<typeof vi.fn>).mockResolvedValue(resolved);
  return chain;
}

const VALID_TALENT_ID  = '11111111-1111-1111-1111-111111111111';
const VALID_BOOKING_ID = '22222222-2222-2222-2222-222222222222';
const VALID_BUYER_ID   = '33333333-3333-3333-3333-333333333333';
const VALID_AGENT_ID   = '44444444-4444-4444-4444-444444444444';

const VALID_INPUT = {
  talentId: VALID_TALENT_ID, eventTitle: 'Summer Music Fest',
  eventDate: '2027-08-15T18:00:00.000Z', venueName: 'Madison Square Garden',
  venueCapacity: 20000, guaranteedBudget: 50000, usageRights: 'Live only',
};

// ─── getBookingSchema ─────────────────────────────────────────────────────────
describe('getBookingSchema', () => {
  it('returns object schema with all 7 required fields', async () => {
    const s = await getBookingSchema();
    expect(s.type).toBe('object');
    expect(s.required).toHaveLength(7);
    ['talentId','eventTitle','eventDate','venueName','venueCapacity','guaranteedBudget','usageRights']
      .forEach(f => expect(s.required).toContain(f));
  });
  it('has correct constraints on key fields', async () => {
    const s = await getBookingSchema();
    expect(s.properties.guaranteedBudget.minimum).toBe(1000);
    expect(s.properties.eventDate.format).toBe('date-time');
    expect(s.properties.eventTitle.maxLength).toBe(100);
  });
});

// ─── getTalents ───────────────────────────────────────────────────────────────
describe('getTalents', () => {
  beforeEach(() => vi.clearAllMocks());
  it('returns talent list on success', async () => {
    const talents = [{ id: VALID_TALENT_ID, name: 'DJ Sparkle', email: 'dj@wme.com' }];
    mockFrom.mockReturnValue(makeChain({ data: talents, error: null }));
    const r = await getTalents();
    expect(r.error).toBeNull();
    expect(r.data).toEqual(talents);
  });
  it('returns error on DB failure', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'DB error' } }));
    const r = await getTalents();
    expect(r.data).toBeNull();
    expect(r.error).toBe('DB error');
  });
  it('filters by TALENT role', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);
    await getTalents();
    expect(mockFrom).toHaveBeenCalledWith('User');
    expect(chain.eq).toHaveBeenCalledWith('role', 'TALENT');
  });
});

// ─── getBookings ──────────────────────────────────────────────────────────────
describe('getBookings', () => {
  beforeEach(() => vi.clearAllMocks());
  it('returns bookings array', async () => {
    const bookings = [{ id: VALID_BOOKING_ID, status: 'OFFER_PENDING' }];
    mockFrom.mockReturnValue(makeChain({ data: bookings, error: null }));
    const r = await getBookings();
    expect(r.error).toBeNull();
    expect(r.data).toEqual(bookings);
  });
  it('returns error on failure', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'Timeout' } }));
    const r = await getBookings();
    expect(r.data).toBeNull();
    expect(r.error).toBe('Timeout');
  });
  it('orders by createdAt descending', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);
    await getBookings();
    expect(chain.order).toHaveBeenCalledWith('createdAt', { ascending: false });
  });
});

// ─── createBooking — validation ───────────────────────────────────────────────
describe('createBooking — input validation', () => {
  it('rejects non-UUID talentId', async () => {
    const r = await createBooking({ ...VALID_INPUT, talentId: 'not-a-uuid' });
    expect(r.error).toBeTruthy();
  });
  it('rejects eventTitle < 3 chars', async () => {
    const r = await createBooking({ ...VALID_INPUT, eventTitle: 'AB' });
    expect(r.error).toBeTruthy();
  });
  it('rejects budget < 1000', async () => {
    const r = await createBooking({ ...VALID_INPUT, guaranteedBudget: 500 });
    expect(r.error).toBeTruthy();
  });
  it('rejects non-ISO eventDate', async () => {
    const r = await createBooking({ ...VALID_INPUT, eventDate: '2027/08/15' });
    expect(r.error).toBeTruthy();
  });
  it('rejects venueCapacity 0', async () => {
    const r = await createBooking({ ...VALID_INPUT, venueCapacity: 0 });
    expect(r.error).toBeTruthy();
  });
});

// ─── createBooking — auth checks ─────────────────────────────────────────────
describe('createBooking — auth', () => {
  beforeEach(() => vi.clearAllMocks());
  it('returns "Not authenticated" with no session', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    mockFrom.mockReturnValue(makeChain({ data: null, error: null }));
    const r = await createBooking(VALID_INPUT);
    expect(r.error).toBe('Not authenticated');
  });
  it('returns "User profile not found" when app row missing', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'auth-x' } } });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    const r = await createBooking(VALID_INPUT);
    expect(r.error).toBe('User profile not found');
  });
});

// ─── createBooking — success ──────────────────────────────────────────────────
describe('createBooking — success', () => {
  beforeEach(() => vi.clearAllMocks());
  it('creates booking and fires edge function', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'auth-ok' } } });
    let n = 0;
    mockFrom.mockImplementation(() => {
      n++;
      if (n === 1) return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: VALID_BUYER_ID }, error: null }) };
      if (n === 2) return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: VALID_AGENT_ID }, error: null }) };
      return { insert: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: VALID_BOOKING_ID }, error: null }) };
    });
    const r = await createBooking(VALID_INPUT);
    expect(r.data).toEqual({ id: VALID_BOOKING_ID });
    expect(r.error).toBeNull();
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('booking-submitted'), expect.objectContaining({ method: 'POST' }));
  });
  it('returns DB error when insert fails', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'auth-ok' } } });
    let n = 0;
    mockFrom.mockImplementation(() => {
      n++;
      if (n === 1) return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: VALID_BUYER_ID }, error: null }) };
      if (n === 2) return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: VALID_AGENT_ID }, error: null }) };
      return { insert: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: { message: 'unique violation' } }) };
    });
    const r = await createBooking(VALID_INPUT);
    expect(r.error).toBe('unique violation');
  });
});

// ─── respondToOffer ───────────────────────────────────────────────────────────
describe('respondToOffer', () => {
  beforeEach(() => vi.clearAllMocks());
  it('errors on empty bookingId', async () => { expect((await respondToOffer('', 'CONFIRMED')).error).toBe('Missing booking ID'); });
  it('errors on invalid action', async () => {
    // @ts-expect-error runtime guard
    expect((await respondToOffer(VALID_BOOKING_ID, 'BAD')).error).toBe('Invalid action');
  });
  it('errors when booking not found', async () => {
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: { message: 'nf' } }) });
    expect((await respondToOffer(VALID_BOOKING_ID, 'CONFIRMED')).error).toBe('Booking not found');
  });
  it('errors when booking not OFFER_PENDING', async () => {
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: VALID_BOOKING_ID, status: 'CONFIRMED', buyerId: VALID_BUYER_ID }, error: null }) });
    expect((await respondToOffer(VALID_BOOKING_ID, 'CONFIRMED')).error).toContain('Cannot respond');
  });
  it('CONFIRMED sets NDA_PENDING and fires edge function', async () => {
    let n = 0;
    mockFrom.mockImplementation(() => {
      n++;
      if (n === 1) return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: VALID_BOOKING_ID, status: 'OFFER_PENDING', buyerId: VALID_BUYER_ID }, error: null }) };
      return { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
    });
    const r = await respondToOffer(VALID_BOOKING_ID, 'CONFIRMED');
    expect(r.error).toBeNull();
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('offer-approved'), expect.any(Object));
  });
  it('OFFER_REJECTED does NOT fire edge function', async () => {
    let n = 0;
    mockFrom.mockImplementation(() => {
      n++;
      if (n === 1) return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: VALID_BOOKING_ID, status: 'OFFER_PENDING', buyerId: VALID_BUYER_ID }, error: null }) };
      return { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
    });
    const r = await respondToOffer(VALID_BOOKING_ID, 'OFFER_REJECTED');
    expect(r.error).toBeNull();
    expect(mockFetch).not.toHaveBeenCalledWith(expect.stringContaining('offer-approved'), expect.any(Object));
  });
  it('returns error when update fails', async () => {
    let n = 0;
    mockFrom.mockImplementation(() => {
      n++;
      if (n === 1) return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: VALID_BOOKING_ID, status: 'OFFER_PENDING', buyerId: VALID_BUYER_ID }, error: null }) };
      return { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: { message: 'update failed' } }) };
    });
    expect((await respondToOffer(VALID_BOOKING_ID, 'CONFIRMED')).error).toBe('update failed');
  });
});

// ─── getLedger ────────────────────────────────────────────────────────────────
describe('getLedger', () => {
  beforeEach(() => vi.clearAllMocks());
  it('returns entries on success', async () => {
    const ledger = [{ id: 'l1', grossEarnings: 250000, netPayout: 162500, payoutStatus: 'AWAITING_CLEARANCE', createdAt: '2026-07-14T00:00:00Z' }];
    mockFrom.mockReturnValue(makeChain({ data: ledger, error: null }));
    const r = await getLedger();
    expect(r.error).toBeNull();
    expect(r.data).toEqual(ledger);
  });
  it('returns error on failure', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'denied' } }));
    const r = await getLedger();
    expect(r.error).toBe('denied');
  });
});
