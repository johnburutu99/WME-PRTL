import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * offer-approved Edge Function
 * Triggered after talent approves an offer (status → NDA_PENDING).
 * Creates a draft NDA Contract record in the vault.
 * Called internally from the respondToOffer server action with service_role key.
 */
Deno.serve(async (req: Request) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { bookingId, buyerId } = await req.json();
    if (!bookingId || !buyerId) {
      return new Response(JSON.stringify({ error: 'Missing bookingId or buyerId' }), { status: 400 });
    }

    // Create draft NDA contract record
    const { error: contractError } = await supabase
      .from('Contract')
      .insert({
        id: crypto.randomUUID(),
        bookingId,
        contractType: 'NDA',
        documentUrl: 'https://wme-vault.s3.amazonaws.com/contracts/draft_nda.pdf',
        signerId: buyerId,
        isSigned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

    if (contractError) {
      return new Response(JSON.stringify({ error: contractError.message }), { status: 500 });
    }

    console.log(`[offer-approved] NDA contract created for booking ${bookingId}`);
    return new Response(JSON.stringify({ success: true, step: 'nda_contract_created' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
