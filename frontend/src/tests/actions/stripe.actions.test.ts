import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDepositCheckout } from '@/lib/actions/stripe.actions';

const { mockFrom, mockFetch } = vi.hoisted(() => ({
  mockFrom:  vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(() =>
    Promise.resolve({ from: (...args: unknown[]) => mockFrom(...args) })
  ),
}));

vi.stubGlobal('fetch', mockFetch);

const BOOKING_ID = 'cccc0000-0000-0000-0000-000000000001';

const makeBookingChain = (booking: unknown) => ({
  select: vi.fn().mockReturnThis(),
  eq:     vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: booking, error: booking ? null : { message: 'not found' } }),
});

// ─── createDepositCheckout ────────────────────────────────────────────────────
describe('createDepositCheckout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.STRIPE_SECRET_KEY;
  });

  it('returns error for empty bookingId', async () => {
    const result = await createDepositCheckout('');
    expect(result.error).toBe('Missing booking ID');
  });

  it('returns error when STRIPE_SECRET_KEY is not set', async () => {
    const result = await createDepositCheckout(BOOKING_ID);
    expect(result.data).toBeNull();
    expect(result.error).toContain('not configured');
  });

  it('returns error when booking not found', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    mockFrom.mockReturnValue(makeBookingChain(null));
    const result = await createDepositCheckout(BOOKING_ID);
    expect(result.error).toBe('Booking not found');
  });

  it('returns error when booking is not AWAITING_DEPOSIT', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    mockFrom.mockReturnValue(makeBookingChain({ id: BOOKING_ID, status: 'OFFER_PENDING', guaranteedBudget: 50000, eventTitle: 'Festival', buyerId: 'buyer-1' }));
    const result = await createDepositCheckout(BOOKING_ID);
    expect(result.error).toContain('not ready for deposit');
    expect(result.error).toContain('OFFER_PENDING');
  });

  it('calls Stripe API with correct deposit amount (50% in cents)', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    mockFrom.mockReturnValue(makeBookingChain({ id: BOOKING_ID, status: 'AWAITING_DEPOSIT', guaranteedBudget: 100000, eventTitle: 'Big Show', buyerId: 'buyer-1' }));
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ url: 'https://checkout.stripe.com/pay/cs_test_123' }) });
    const result = await createDepositCheckout(BOOKING_ID);
    expect(result.error).toBeNull();
    expect(result.data?.url).toBe('https://checkout.stripe.com/pay/cs_test_123');
    // Verify 50% of 100000 = 50000 dollars = 5000000 cents
    const fetchCall = mockFetch.mock.calls[0];
    expect(fetchCall[0]).toBe('https://api.stripe.com/v1/checkout/sessions');
    expect(fetchCall[1].body).toContain('5000000');
  });

  it('returns error when Stripe API responds with failure', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    mockFrom.mockReturnValue(makeBookingChain({ id: BOOKING_ID, status: 'AWAITING_DEPOSIT', guaranteedBudget: 50000, eventTitle: 'Concert', buyerId: 'buyer-1' }));
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: { message: 'Your card was declined' } }) });
    const result = await createDepositCheckout(BOOKING_ID);
    expect(result.data).toBeNull();
    expect(result.error).toBe('Your card was declined');
  });

  it('uses success_url pointing to /buyer with deposit params', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    process.env.NEXT_PUBLIC_APP_URL = 'https://wme.example.com';
    mockFrom.mockReturnValue(makeBookingChain({ id: BOOKING_ID, status: 'AWAITING_DEPOSIT', guaranteedBudget: 20000, eventTitle: 'Show', buyerId: 'buyer-1' }));
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ url: 'https://stripe.com' }) });
    await createDepositCheckout(BOOKING_ID);
    const body = mockFetch.mock.calls[0][1].body as string;
    expect(body).toContain('deposit_success%3D1');
    expect(body).toContain('wme.example.com');
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it('includes booking metadata in the Stripe request', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    mockFrom.mockReturnValue(makeBookingChain({ id: BOOKING_ID, status: 'AWAITING_DEPOSIT', guaranteedBudget: 50000, eventTitle: 'Gala', buyerId: 'buyer-1' }));
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ url: 'https://stripe.com' }) });
    await createDepositCheckout(BOOKING_ID);
    const body = mockFetch.mock.calls[0][1].body as string;
    expect(body).toContain(BOOKING_ID);
    expect(body).toContain('50%25+Deposit');
  });
});
