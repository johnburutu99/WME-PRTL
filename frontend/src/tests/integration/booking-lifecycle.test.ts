/**
 * Booking Lifecycle Integration Tests
 *
 * Tests the full booking state machine flow:
 * PENDING_REVIEW → OFFER_PENDING → NDA_PENDING → NDA_SIGNED
 * → CONTRACT_PENDING → CONTRACT_SIGNED → AWAITING_DEPOSIT → CONFIRMED → COMPLETED
 *
 * Each step uses the real server action logic with mocked Supabase client.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { respondToOffer } from '@/lib/actions/bookings.actions';
import { advanceBookingStatus, signContract } from '@/lib/actions/agent.actions';

const mockFrom    = vi.fn();
const mockGetUser = vi.fn();
vi.stubGlobal('fetch', vi.fn().mockResolvedValue(undefined));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

const BOOKING_ID  = 'lifecycle-booking-0000-000000000001';
const CONTRACT_ID = 'lifecycle-contract-000-000000000001';
const BUYER_ID    = 'lifecycle-buyer-00000-000000000001';

describe('Booking Lifecycle — Full State Machine', () => {
  beforeEach(() => vi.clearAllMocks());

  it('Step 1: Agent advances PENDING_REVIEW → OFFER_PENDING', async () => {
    const chain = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
    mockFrom.mockReturnValue(chain);
    const result = await advanceBookingStatus(BOOKING_ID, 'OFFER_PENDING');
    expect(result.error).toBeNull();
  });

  it('Step 2: Talent approves offer → NDA_PENDING + edge function fired', async () => {
    let call = 0;
    mockFrom.mockImplementation(() => {
      call++;
      if (call === 1) return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: BOOKING_ID, status: 'OFFER_PENDING', buyerId: BUYER_ID }, error: null }) };
      return { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
    });
    const result = await respondToOffer(BOOKING_ID, 'CONFIRMED');
    expect(result.error).toBeNull();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(expect.stringContaining('offer-approved'), expect.any(Object));
  });

  it('Step 3: Agent triggers NDA → NDA_PENDING (already set) → send contract', async () => {
    const chain = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
    mockFrom.mockReturnValue(chain);
    const result = await advanceBookingStatus(BOOKING_ID, 'CONTRACT_PENDING');
    expect(result.error).toBeNull();
  });

  it('Step 4: Buyer signs NDA contract → NDA_SIGNED', async () => {
    let call = 0;
    mockFrom.mockImplementation(() => {
      call++;
      if (call === 1) return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: CONTRACT_ID, isSigned: false, bookingId: BOOKING_ID }, error: null }) };
      if (call === 2) return { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
      if (call === 3) return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { contractType: 'NDA' }, error: null }) };
      return { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
    });
    const result = await signContract(CONTRACT_ID);
    expect(result.error).toBeNull();
  });

  it('Step 5: Buyer signs LONG_FORM contract → CONTRACT_SIGNED', async () => {
    let call = 0;
    mockFrom.mockImplementation(() => {
      call++;
      if (call === 1) return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: CONTRACT_ID, isSigned: false, bookingId: BOOKING_ID }, error: null }) };
      if (call === 2) return { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
      if (call === 3) return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { contractType: 'LONG_FORM' }, error: null }) };
      return { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
    });
    const result = await signContract(CONTRACT_ID);
    expect(result.error).toBeNull();
  });

  it('Step 6: Agent requests deposit → AWAITING_DEPOSIT', async () => {
    const chain = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
    mockFrom.mockReturnValue(chain);
    const result = await advanceBookingStatus(BOOKING_ID, 'AWAITING_DEPOSIT');
    expect(result.error).toBeNull();
  });

  it('Step 7: Agent confirms after deposit → CONFIRMED', async () => {
    const chain = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
    mockFrom.mockReturnValue(chain);
    const result = await advanceBookingStatus(BOOKING_ID, 'CONFIRMED');
    expect(result.error).toBeNull();
  });

  it('Step 8: Agent marks completed → COMPLETED', async () => {
    const chain = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
    mockFrom.mockReturnValue(chain);
    const result = await advanceBookingStatus(BOOKING_ID, 'COMPLETED');
    expect(result.error).toBeNull();
  });

  it('Alternative: Talent rejects offer → OFFER_REJECTED (no edge function)', async () => {
    vi.clearAllMocks();
    let call = 0;
    mockFrom.mockImplementation(() => {
      call++;
      if (call === 1) return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: BOOKING_ID, status: 'OFFER_PENDING', buyerId: BUYER_ID }, error: null }) };
      return { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
    });
    const result = await respondToOffer(BOOKING_ID, 'OFFER_REJECTED');
    expect(result.error).toBeNull();
    expect(vi.mocked(fetch)).not.toHaveBeenCalledWith(expect.stringContaining('offer-approved'), expect.any(Object));
  });

  it('Guard: cannot respond to a booking that is already CONFIRMED', async () => {
    const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: BOOKING_ID, status: 'CONFIRMED', buyerId: BUYER_ID }, error: null }) };
    mockFrom.mockReturnValue(chain);
    const result = await respondToOffer(BOOKING_ID, 'CONFIRMED');
    expect(result.error).toContain('Cannot respond');
  });

  it('Guard: cannot sign a contract that is already signed', async () => {
    const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: CONTRACT_ID, isSigned: true, bookingId: BOOKING_ID }, error: null }) };
    mockFrom.mockReturnValue(chain);
    const result = await signContract(CONTRACT_ID);
    expect(result.error).toBe('Contract already signed');
  });
});
