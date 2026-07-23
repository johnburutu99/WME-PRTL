'use server';

import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from './bookings.actions';

/**
 * Creates a Stripe Checkout Session for a booking deposit (50% of guaranteedBudget).
 * Returns the checkout URL to redirect the buyer to.
 *
 * Requires STRIPE_SECRET_KEY env var to be set.
 * On success, Stripe redirects back to /buyer?deposit_success=1
 * On cancel, Stripe redirects back to /buyer?deposit_cancelled=1
 */
export async function createDepositCheckout(
  bookingId: string,
): Promise<ActionResult<{ url: string }>> {
  if (!bookingId) return { data: null, error: 'Missing booking ID' };

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return { data: null, error: 'Payment system is not configured. Please contact support.' };
  }

  const supabase = await createClient();

  // Verify booking exists and is in AWAITING_DEPOSIT status
  const { data: booking, error: fetchErr } = await supabase
    .from('Booking')
    .select('id, status, guaranteedBudget, eventTitle, buyerId')
    .eq('id', bookingId)
    .single();

  if (fetchErr || !booking) return { data: null, error: 'Booking not found' };
  if (booking.status !== 'AWAITING_DEPOSIT') {
    return { data: null, error: `Booking is not ready for deposit (status: ${booking.status})` };
  }

  const depositAmount = Math.round(Number(booking.guaranteedBudget) * 0.5 * 100); // Stripe uses cents
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const formBody = new URLSearchParams({
    'mode': 'payment',
    'payment_method_types[]': 'card',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(depositAmount),
    'line_items[0][price_data][product_data][name]': `50% Deposit — ${booking.eventTitle}`,
    'line_items[0][price_data][product_data][description]': `WME Agency non-refundable booking deposit for booking ID ${bookingId}`,
    'metadata[bookingId]': bookingId,
    'success_url': `${appUrl}/buyer?deposit_success=1&booking_id=${bookingId}`,
    'cancel_url': `${appUrl}/buyer?deposit_cancelled=1`,
  });

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formBody.toString(),
  });

  if (!res.ok) {
    const err = await res.json();
    return { data: null, error: err?.error?.message ?? 'Payment session creation failed' };
  }

  const session = await res.json();
  return { data: { url: session.url }, error: null };
}
