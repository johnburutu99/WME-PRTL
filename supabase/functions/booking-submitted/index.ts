import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * booking-submitted Edge Function
 * Triggered after a new Booking row is inserted with status PENDING_REVIEW.
 * Advances status to OFFER_PENDING (simulates agent vetting + Stripe stub).
 * Called internally from the createBooking server action with service_role key.
 */
Deno.serve(async (req: Request) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { bookingId } = await req.json();
    if (!bookingId) {
      return new Response(JSON.stringify({ error: 'Missing bookingId' }), { status: 400 });
    }

    const { data: booking, error: fetchError } = await supabase
      .from('Booking')
      .select('id, status, guaranteedBudget, venueName')
      .eq('id', bookingId)
      .single();

    if (fetchError || !booking) {
      return new Response(JSON.stringify({ error: 'Booking not found' }), { status: 404 });
    }

    // Advance PENDING_REVIEW → OFFER_PENDING
    const { error: updateError } = await supabase
      .from('Booking')
      .update({ status: 'OFFER_PENDING', updatedAt: new Date().toISOString() })
      .eq('id', bookingId)
      .eq('status', 'PENDING_REVIEW');

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
    }

    console.log(`[booking-submitted] Booking ${bookingId} advanced to OFFER_PENDING`);
    return new Response(JSON.stringify({ success: true, step: 'offer_pending' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
