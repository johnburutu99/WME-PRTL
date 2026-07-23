import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * webhooks Edge Function
 * Receives HMAC-signed events from payment providers (Stripe) and
 * e-signature platforms (DocuSign/PandaDoc).
 * Performs ACID-style DB state transitions via service_role.
 *
 * Security: HMAC-SHA256 verified against raw body bytes using
 * WEBHOOK_SECRET env var set in Supabase dashboard secrets.
 */

async function verifyHmac(rawBody: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');

  // Constant-length compare to prevent timing attacks
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  try {
    const signature = req.headers.get('x-wme-signature');
    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing x-wme-signature header' }), { status: 401 });
    }

    const rawBody = await req.text();
    if (!rawBody) {
      return new Response(JSON.stringify({ error: 'Empty body' }), { status: 400 });
    }

    const secret = Deno.env.get('WEBHOOK_SECRET');
    if (!secret) {
      console.error('WEBHOOK_SECRET env var not set');
      return new Response(JSON.stringify({ error: 'Server misconfiguration' }), { status: 500 });
    }

    const valid = await verifyHmac(rawBody, signature, secret);
    if (!valid) {
      console.warn('Webhook HMAC signature mismatch');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const { event, bookingId } = payload;

    if (!bookingId) {
      return new Response(JSON.stringify({ error: 'Missing bookingId' }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: booking, error: bookingErr } = await supabase
      .from('Booking')
      .select('id, guaranteedBudget, talentId, buyerId')
      .eq('id', bookingId)
      .single();

    if (bookingErr || !booking) {
      return new Response(JSON.stringify({ error: 'Booking not found' }), { status: 404 });
    }

    const gross = Number(booking.guaranteedBudget);

    // ── payment.deposit_cleared ──────────────────────────────────────────
    if (event === 'payment.deposit_cleared') {
      const { error: e1 } = await supabase.from('Booking').update(
        { status: 'CONFIRMED', updatedAt: new Date().toISOString() }
      ).eq('id', bookingId);
      if (e1) throw e1;

      const { error: e2 } = await supabase.from('FinancialTransaction').insert({
        id: crypto.randomUUID(), bookingId,
        type: 'DEPOSIT', amount: gross * 0.5,
        status: 'CLEARED',
        reference: payload.reference ?? 'webhook_deposit',
        clearedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      if (e2) throw e2;

      const commission = gross * 0.15;
      const withholding = gross * 0.20;
      const { error: e3 } = await supabase.from('FinancialLedger').insert({
        id: crypto.randomUUID(), bookingId,
        talentId: booking.talentId,
        grossEarnings: gross, agencyCommission: commission,
        taxWithholding: withholding, netPayout: gross - commission - withholding,
        payoutStatus: 'AWAITING_CLEARANCE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      if (e3) throw e3;

      console.log(`[webhooks] Booking ${bookingId} → CONFIRMED, ledger created`);
      return new Response(JSON.stringify({ success: true, message: 'Deposit cleared and booking confirmed' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ── esign.nda_signed ─────────────────────────────────────────────────
    if (event === 'esign.nda_signed') {
      const { error: e1 } = await supabase.from('Booking').update(
        { status: 'NDA_SIGNED', updatedAt: new Date().toISOString() }
      ).eq('id', bookingId);
      if (e1) throw e1;

      const { error: e2 } = await supabase.from('Contract').insert({
        id: crypto.randomUUID(), bookingId, contractType: 'NDA',
        documentUrl: payload.documentUrl ?? 'https://wme-vault.s3.amazonaws.com/contracts/nda.pdf',
        isSigned: true, signedAt: new Date().toISOString(),
        signerId: booking.buyerId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      if (e2) throw e2;

      console.log(`[webhooks] Booking ${bookingId} → NDA_SIGNED`);
      return new Response(JSON.stringify({ success: true, message: 'NDA signed and logged' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ── esign.longform_signed ────────────────────────────────────────────
    if (event === 'esign.longform_signed') {
      const { error: e1 } = await supabase.from('Booking').update(
        { status: 'CONTRACT_SIGNED', updatedAt: new Date().toISOString() }
      ).eq('id', bookingId);
      if (e1) throw e1;

      const { error: e2 } = await supabase.from('Contract').insert({
        id: crypto.randomUUID(), bookingId, contractType: 'LONG_FORM',
        documentUrl: payload.documentUrl ?? 'https://wme-vault.s3.amazonaws.com/contracts/long_form.pdf',
        isSigned: true, signedAt: new Date().toISOString(),
        signerId: booking.buyerId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      if (e2) throw e2;

      console.log(`[webhooks] Booking ${bookingId} → CONTRACT_SIGNED`);
      return new Response(JSON.stringify({ success: true, message: 'Long form contract signed and logged' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.warn(`[webhooks] Unrecognised event: ${event}`);
    return new Response(JSON.stringify({ success: false, message: 'Unrecognised event' }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[webhooks] Unhandled error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
