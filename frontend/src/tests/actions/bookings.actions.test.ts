import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoisted ensures these are available before vi.mock hoisting runs
const { mockGetUser, mockFrom, mockFetch } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom:    vi.fn(),
  mockFetch:   vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/supabase/server', () => ({
  // Wrap in arrow functions so mockFrom/mockGetUser are looked up at call time,
  // not captured at mock-creation time. This survives beforeEach resets.
  createClient: vi.fn().mockImplementation(() =>
    Promise.resolve({
      auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
      from:  (...args: unknown[]) => mockFrom(...args),
    })
  ),
}));

vi.stubGlobal('fetch', mockFetch);

import {
  getBookingSchema, getTalents, getBookings,
  createBooking, respondToOffer, getLedger,
} from '@/lib/actions/bookings.actions';

// Reset call-count only (not implementations) between tests
afterEach(() => {
  mockFrom.mockClear();
  mockGetUser.mockClear();
  mockFetch.mockClear();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a fluent Supabase query chain stub.
 * All chainable methods return `chain` itself.
 * Terminal methods (single, maybeSingle, order, insert, update) resolve to `resolved`.
 * `in` is chaining-only so that `.in(...).order(...)` keeps working.
 */
function makeChain(resolved: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  ['select','eq','order','limit','insert','update','single','maybeSingle','in'].forEach(m => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.single.mockResolvedValue(resolved);
  chain.maybeSingle.mockResolvedValue(resolved);
  chain.order.mockResolvedValue(resolved);
  chain.insert.mockResolvedValue(resolved);
  chain.update.mockResolvedValue(resolved);
  // chain.in stays as mockReturnValue(chain) — chaining only
  return chain;
}

/** Stub auth for a user with the given role */
function stubAuth(role: string, userId = 'stub-user-id', authId = `auth-${userId}`) {
  mockGetUser.mockResolvedValue({ data: { user: { id: authId } } });
  return { id: userId, role, authId };
}

/** Return a from() stub that handles getCurrentAppUser (call 1) then passes through `impl` for subsequent calls */
function withAppUser(
  role: string,
  userId: string,
  impl: (callN: number) => unknown,
) {
  let n = 0;
  mockFrom.mockImplementation(() => {
    n++;
    if (n === 1) {
      // getCurrentAppUser: User table maybeSingle
      return {
        select:      vi.fn().mockReturnThis(),
        eq:          vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: userId, role }, error: null }),
      };
    }
    return impl(n);
  });
}

// ─── RFC-4122 compliant test UUIDs ────────────────────────────────────────────
const VALID_TALENT_ID  = '1cd38438-db90-4138-8edf-960bb4ce215c';
const VALID_BOOKING_ID = 'fad32d99-95fa-4cdb-b72d-f8bc4389426e';
const VALID_BUYER_ID   = '9b1da2e2-aabd-45fc-b802-ccfc7f245af3';
const VALID_AGENT_ID   = '86ca9e56-ec2e-40d3-8b84-936de7fcdd46';

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
  it('returns talent list on success', async () => {
    const talents = [{ id: VALID_TALENT_ID, name: 'DJ Sparkle', email: 'dj@wme.com' }];
    stubAuth('BUYER', 'buyer-1');
    withAppUser('BUYER', 'buyer-1', () => makeChain({ data: talents, error: null }));
    const r = await getTalents();
    expect(r.error).toBeNull();
    expect(r.data).toEqual(talents);
  });
  it('returns error on DB failure', async () => {
    stubAuth('BUYER', 'buyer-1');
    withAppUser('BUYER', 'buyer-1', () => makeChain({ data: null, error: { message: 'DB error' } }));
    const r = await getTalents();
    expect(r.data).toBeNull();
    expect(r.error).toBe('DB error');
  });
  it('filters by TALENT role', async () => {
    stubAuth('BUYER', 'buyer-1');
    const talentChain = makeChain({ data: [], error: null });
    withAppUser('BUYER', 'buyer-1', () => talentChain);
    await getTalents();
    expect(mockFrom).toHaveBeenCalledWith('User');
    expect(talentChain.eq).toHaveBeenCalledWith('role', 'TALENT');
  });
});

// ─── getBookings ──────────────────────────────────────────────────────────────
describe('getBookings', () => {
  it('returns bookings array', async () => {
    const bookings = [{ id: VALID_BOOKING_ID, status: 'OFFER_PENDING' }];
    stubAuth('BUYER', 'buyer-1');
    withAppUser('BUYER', 'buyer-1', () => makeChain({ data: bookings, error: null }));
    const r = await getBookings();
    expect(r.error).toBeNull();
    expect(r.data).toEqual(bookings);
  });
  it('returns error on failure', async () => {
    stubAuth('BUYER', 'buyer-1');
    withAppUser('BUYER', 'buyer-1', () => makeChain({ data: null, error: { message: 'Timeout' } }));
    const r = await getBookings();
    expect(r.data).toBeNull();
    expect(r.error).toBe('Timeout');
  });
  it('orders by createdAt descending', async () => {
    stubAuth('BUYER', 'buyer-1');
    const bookingsChain = makeChain({ data: [], error: null });
    withAppUser('BUYER', 'buyer-1', () => bookingsChain);
    await getBookings();
    expect(bookingsChain.order).toHaveBeenCalledWith('createdAt', { ascending: false });
  });
});

// ─── createBooking — input validation ────────────────────────────────────────
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
  it('returns "Not authenticated" with no session', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const r = await createBooking(VALID_INPUT);
    expect(r.error).toBe('Not authenticated');
  });
  it('returns "Not authenticated" when app row missing', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'auth-x' } } });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    const r = await createBooking(VALID_INPUT);
    expect(r.error).toBe('Not authenticated');
  });
});

// ─── createBooking — success ──────────────────────────────────────────────────
describe('createBooking — success', () => {
  it('creates booking and fires edge function', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'auth-ok' } } });
    let n = 0;
    mockFrom.mockImplementation(() => {
      n++;
      // 1: getCurrentAppUser (BUYER)
      if (n === 1) return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: VALID_BUYER_ID, role: 'BUYER' }, error: null }) };
      // 2: agent lookup
      if (n === 2) return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: VALID_AGENT_ID }, error: null }) };
      // 3: insert booking
      return { insert: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: VALID_BOOKING_ID }, error: null }) };
    });
    const r = await createBooking(VALID_INPUT);
    expect(r.data).toEqual({ id: VALID_BOOKING_ID });
    expect(r.error).toBeNull();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('booking-submitted'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
  it('returns DB error when insert fails', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'auth-ok' } } });
    let n = 0;
    mockFrom.mockImplementation(() => {
      n++;
      if (n === 1) return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: VALID_BUYER_ID, role: 'BUYER' }, error: null }) };
      if (n === 2) return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: VALID_AGENT_ID }, error: null }) };
      return { insert: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: { message: 'unique violation' } }) };
    });
    const r = await createBooking(VALID_INPUT);
    expect(r.error).toBe('unique violation');
  });
});

// ─── respondToOffer ───────────────────────────────────────────────────────────
describe('respondToOffer', () => {
  it('errors on empty bookingId', async () => {
    expect((await respondToOffer('', 'CONFIRMED')).error).toBe('Missing booking ID');
  });
  it('errors on invalid action', async () => {
    // @ts-expect-error runtime guard
    expect((await respondToOffer(VALID_BOOKING_ID, 'BAD')).error).toBe('Invalid action');
  });
  it('errors when booking not found', async () => {
    stubAuth('TALENT', 'talent-1');
    withAppUser('TALENT', 'talent-1', () => ({
      select: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'nf' } }),
    }));
    expect((await respondToOffer(VALID_BOOKING_ID, 'CONFIRMED')).error).toBe('Booking not found');
  });
  it('errors when booking not OFFER_PENDING', async () => {
    stubAuth('TALENT', 'talent-1');
    withAppUser('TALENT', 'talent-1', () => ({
      select: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: VALID_BOOKING_ID, status: 'CONFIRMED', buyerId: VALID_BUYER_ID, talentId: 'talent-1' }, error: null }),
    }));
    expect((await respondToOffer(VALID_BOOKING_ID, 'CONFIRMED')).error).toContain('Cannot respond');
  });
  it('CONFIRMED sets NDA_PENDING and fires edge function', async () => {
    stubAuth('TALENT', 'talent-1');
    let n = 0;
    mockFrom.mockImplementation(() => {
      n++;
      if (n === 1) return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'talent-1', role: 'TALENT' }, error: null }) };
      if (n === 2) return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: VALID_BOOKING_ID, status: 'OFFER_PENDING', buyerId: VALID_BUYER_ID, talentId: 'talent-1' }, error: null }) };
      return { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
    });
    const r = await respondToOffer(VALID_BOOKING_ID, 'CONFIRMED');
    expect(r.error).toBeNull();
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('offer-approved'), expect.any(Object));
  });
  it('OFFER_REJECTED does NOT fire edge function', async () => {
    stubAuth('TALENT', 'talent-1');
    let n = 0;
    mockFrom.mockImplementation(() => {
      n++;
      if (n === 1) return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'talent-1', role: 'TALENT' }, error: null }) };
      if (n === 2) return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: VALID_BOOKING_ID, status: 'OFFER_PENDING', buyerId: VALID_BUYER_ID, talentId: 'talent-1' }, error: null }) };
      return { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
    });
    const r = await respondToOffer(VALID_BOOKING_ID, 'OFFER_REJECTED');
    expect(r.error).toBeNull();
    expect(mockFetch).not.toHaveBeenCalledWith(expect.stringContaining('offer-approved'), expect.any(Object));
  });
  it('returns error when update fails', async () => {
    stubAuth('TALENT', 'talent-1');
    let n = 0;
    mockFrom.mockImplementation(() => {
      n++;
      if (n === 1) return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'talent-1', role: 'TALENT' }, error: null }) };
      if (n === 2) return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: VALID_BOOKING_ID, status: 'OFFER_PENDING', buyerId: VALID_BUYER_ID, talentId: 'talent-1' }, error: null }) };
      return { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: { message: 'update failed' } }) };
    });
    expect((await respondToOffer(VALID_BOOKING_ID, 'CONFIRMED')).error).toBe('update failed');
  });
});

// ─── getLedger ────────────────────────────────────────────────────────────────
describe('getLedger', () => {
  it('returns entries on success', async () => {
    const ledger = [{ id: 'l1', grossEarnings: 250000, netPayout: 162500, payoutStatus: 'AWAITING_CLEARANCE', createdAt: '2026-07-14T00:00:00Z' }];
    stubAuth('TALENT', 'talent-1');
    let n = 0;
    mockFrom.mockImplementation(() => {
      n++;
      if (n === 1) return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'talent-1', role: 'TALENT' }, error: null }) };
      if (n === 2) return makeChain({ data: [{ id: VALID_BOOKING_ID }], error: null });
      return makeChain({ data: ledger, error: null });
    });
    const r = await getLedger();
    expect(r.error).toBeNull();
    expect(r.data).toEqual(ledger);
  });
  it('returns error on failure', async () => {
    stubAuth('TALENT', 'talent-1');
    let n = 0;
    mockFrom.mockImplementation(() => {
      n++;
      if (n === 1) return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'talent-1', role: 'TALENT' }, error: null }) };
      if (n === 2) return makeChain({ data: [{ id: VALID_BOOKING_ID }], error: null });
      return makeChain({ data: null, error: { message: 'denied' } });
    });
    const r = await getLedger();
    expect(r.error).toBe('denied');
  });
});
