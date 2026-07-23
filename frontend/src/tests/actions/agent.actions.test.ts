import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}));

import { advanceBookingStatus, getAllBookings, signContract } from '@/lib/actions/agent.actions';

const BOOKING_ID  = 'aaaa0000-0000-0000-0000-000000000001';
const CONTRACT_ID = 'bbbb0000-0000-0000-0000-000000000002';

// ─── advanceBookingStatus ─────────────────────────────────────────────────────
describe('advanceBookingStatus', () => {
  beforeEach(() => vi.clearAllMocks());
  it('errors on empty bookingId', async () => {
    expect((await advanceBookingStatus('', 'CONFIRMED')).error).toBeTruthy();
  });
  it('errors on invalid status', async () => {
    // @ts-expect-error runtime guard
    expect((await advanceBookingStatus(BOOKING_ID, 'BAD_STATUS')).error).toBeTruthy();
  });
  it('updates successfully', async () => {
    mockFrom.mockReturnValue({ update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) });
    expect((await advanceBookingStatus(BOOKING_ID, 'OFFER_PENDING')).error).toBeNull();
  });
  it('returns DB error', async () => {
    mockFrom.mockReturnValue({ update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: { message: 'RLS' } }) });
    expect((await advanceBookingStatus(BOOKING_ID, 'CONFIRMED')).error).toBe('RLS');
  });
  it('accepts all 10 non-PENDING_REVIEW statuses', async () => {
    const statuses = ['OFFER_PENDING','NEGOTIATING','NDA_PENDING','NDA_SIGNED','CONTRACT_PENDING',
      'CONTRACT_SIGNED','AWAITING_DEPOSIT','CONFIRMED','COMPLETED','OFFER_REJECTED'] as const;
    for (const s of statuses) {
      vi.clearAllMocks();
      mockFrom.mockReturnValue({ update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) });
      expect((await advanceBookingStatus(BOOKING_ID, s)).error, `failed for: ${s}`).toBeNull();
    }
  });
});

// ─── getAllBookings ───────────────────────────────────────────────────────────
describe('getAllBookings', () => {
  beforeEach(() => vi.clearAllMocks());
  it('returns bookings on success', async () => {
    const bookings = [{ id: BOOKING_ID, status: 'OFFER_PENDING' }];
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue({ data: bookings, error: null }) });
    const r = await getAllBookings();
    expect(r.error).toBeNull();
    expect(r.data).toEqual(bookings);
  });
  it('returns error on failure', async () => {
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue({ data: null, error: { message: 'Timeout' } }) });
    const r = await getAllBookings();
    expect(r.error).toBe('Timeout');
  });
});

// ─── signContract ─────────────────────────────────────────────────────────────
describe('signContract', () => {
  beforeEach(() => vi.clearAllMocks());
  it('errors on empty contractId', async () => {
    expect((await signContract('')).error).toBe('Missing contract ID');
  });
  it('errors when contract not found', async () => {
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: { message: 'nf' } }) });
    expect((await signContract(CONTRACT_ID)).error).toBe('Contract not found');
  });
  it('errors when already signed', async () => {
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: CONTRACT_ID, isSigned: true, bookingId: BOOKING_ID }, error: null }) });
    expect((await signContract(CONTRACT_ID)).error).toBe('Contract already signed');
  });
  it('signs NDA → NDA_SIGNED', async () => {
    let n = 0;
    mockFrom.mockImplementation(() => {
      n++;
      if (n === 1) return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: CONTRACT_ID, isSigned: false, bookingId: BOOKING_ID }, error: null }) };
      if (n === 2) return { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
      if (n === 3) return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { contractType: 'NDA' }, error: null }) };
      return { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
    });
    expect((await signContract(CONTRACT_ID)).error).toBeNull();
  });
  it('signs LONG_FORM → CONTRACT_SIGNED', async () => {
    let n = 0;
    mockFrom.mockImplementation(() => {
      n++;
      if (n === 1) return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: CONTRACT_ID, isSigned: false, bookingId: BOOKING_ID }, error: null }) };
      if (n === 2) return { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
      if (n === 3) return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { contractType: 'LONG_FORM' }, error: null }) };
      return { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
    });
    expect((await signContract(CONTRACT_ID)).error).toBeNull();
  });
  it('returns error when update fails', async () => {
    let n = 0;
    mockFrom.mockImplementation(() => {
      n++;
      if (n === 1) return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: CONTRACT_ID, isSigned: false, bookingId: BOOKING_ID }, error: null }) };
      return { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: { message: 'update err' } }) };
    });
    expect((await signContract(CONTRACT_ID)).error).toBe('update err');
  });
});
