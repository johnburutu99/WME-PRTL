'use server';

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import type { Booking, LedgerEntry, Talent, BookingFormSchema } from '@/types/portal';

// ─── Validation ───────────────────────────────────────────────────────────────

const CreateBookingSchema = z.object({
  talentId: z.string().uuid(),
  eventTitle: z.string().min(3).max(100),
  eventDate: z.string().datetime(),
  venueName: z.string().min(1),
  venueCapacity: z.number().int().min(1),
  guaranteedBudget: z.number().min(1000),
  usageRights: z.string().min(1),
});

export type ActionResult<T = void> =
  | { data: T; error: null }
  | { data: null; error: string };

// ─── Booking intake form schema (static — no DB round-trip needed) ─────────────

export async function getBookingSchema(): Promise<BookingFormSchema> {
  return {
    type: 'object',
    required: ['talentId', 'eventTitle', 'eventDate', 'venueName', 'venueCapacity', 'guaranteedBudget', 'usageRights'],
    properties: {
      talentId:         { type: 'string', title: 'Select Artist / Talent', description: 'The talent you want to book.' },
      eventTitle:       { type: 'string', title: 'Event Title', minLength: 3, maxLength: 100 },
      eventDate:        { type: 'string', format: 'date-time', title: 'Event Date & Time' },
      venueName:        { type: 'string', title: 'Venue Name' },
      venueCapacity:    { type: 'integer', title: 'Venue Capacity', minimum: 1 },
      guaranteedBudget: { type: 'number', title: 'Guaranteed Budget ($)', minimum: 1000 },
      usageRights:      { type: 'string', title: 'Usage / Promotional Rights', description: 'Specify recording or commercial usage.' },
    },
  };
}

// ─── Get talents list ─────────────────────────────────────────────────────────

export async function getTalents(): Promise<ActionResult<Talent[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('User')
    .select('id, name, email')
    .eq('role', 'TALENT')
    .order('name');

  if (error) return { data: null, error: error.message };
  return { data: data as Talent[], error: null };
}

// ─── Get bookings for current user (RBAC handled by RLS) ──────────────────────

export async function getBookings(): Promise<ActionResult<Booking[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('Booking')
    .select(`
      id, status, eventTitle, eventDate, venueName,
      venueCapacity, guaranteedBudget, usageRights, createdAt,
      buyer:User!Booking_buyerId_fkey(name, email),
      talent:User!Booking_talentId_fkey(name),
      contracts:Contract(id, contractType, documentUrl, isSigned, signedAt, lockExpiration)
    `)
    .order('createdAt', { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data: data as unknown as Booking[], error: null };
}

// ─── Create booking (BUYER only — RLS enforces role) ─────────────────────────

export async function createBooking(
  input: z.infer<typeof CreateBookingSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = CreateBookingSchema.safeParse(input);
  if (!parsed.success) {
    return { data: null, error: parsed.error.errors[0].message };
  }

  const supabase = await createClient();

  // Get the current app user id from our User table
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return { data: null, error: 'Not authenticated' };

  const { data: appUser } = await supabase
    .from('User')
    .select('id')
    .eq('auth_user_id', authUser.id)
    .single();

  if (!appUser) return { data: null, error: 'User profile not found' };

  // Find first available agent
  const { data: agent } = await supabase
    .from('User')
    .select('id')
    .eq('role', 'AGENT')
    .limit(1)
    .single();

  const { data: booking, error } = await supabase
    .from('Booking')
    .insert({
      id: crypto.randomUUID(),
      buyerId: appUser.id,
      talentId: parsed.data.talentId,
      agentId: agent?.id ?? null,
      eventTitle: parsed.data.eventTitle,
      eventDate: parsed.data.eventDate,
      venueName: parsed.data.venueName,
      venueCapacity: parsed.data.venueCapacity,
      guaranteedBudget: parsed.data.guaranteedBudget,
      usageRights: parsed.data.usageRights,
      status: 'PENDING_REVIEW',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) return { data: null, error: error.message };

  // Trigger the booking_submitted Edge Function asynchronously (fire-and-forget)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  fetch(`${supabaseUrl}/functions/v1/booking-submitted`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ bookingId: booking.id, buyerId: appUser.id, talentId: parsed.data.talentId }),
  }).catch(() => {}); // non-blocking

  return { data: { id: booking.id }, error: null };
}

// ─── Respond to offer (TALENT only — RLS enforces) ────────────────────────────

export async function respondToOffer(
  bookingId: string,
  action: 'CONFIRMED' | 'OFFER_REJECTED',
): Promise<ActionResult> {
  if (!bookingId) return { data: null, error: 'Missing booking ID' };
  if (action !== 'CONFIRMED' && action !== 'OFFER_REJECTED') {
    return { data: null, error: 'Invalid action' };
  }

  const supabase = await createClient();

  // Fetch booking to validate status
  const { data: booking, error: fetchError } = await supabase
    .from('Booking')
    .select('id, status, buyerId')
    .eq('id', bookingId)
    .single();

  if (fetchError || !booking) return { data: null, error: 'Booking not found' };
  if (booking.status !== 'OFFER_PENDING') {
    return { data: null, error: `Cannot respond to a booking in "${booking.status}" status` };
  }

  const newStatus = action === 'CONFIRMED' ? 'NDA_PENDING' : 'OFFER_REJECTED';

  const { error: updateError } = await supabase
    .from('Booking')
    .update({ status: newStatus, updatedAt: new Date().toISOString() })
    .eq('id', bookingId);

  if (updateError) return { data: null, error: updateError.message };

  // If approved, trigger offer_approved Edge Function
  if (newStatus === 'NDA_PENDING') {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    fetch(`${supabaseUrl}/functions/v1/offer-approved`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ bookingId, buyerId: booking.buyerId }),
    }).catch(() => {});
  }

  return { data: undefined, error: null };
}

// ─── Get ledger for current talent ────────────────────────────────────────────

export async function getLedger(): Promise<ActionResult<LedgerEntry[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('FinancialLedger')
    .select(`
      id, grossEarnings, agencyCommission, taxWithholding,
      netPayout, payoutStatus, payoutDate, createdAt,
      booking:Booking(eventTitle, eventDate, venueName)
    `)
    .order('createdAt', { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data: data as unknown as LedgerEntry[], error: null };
}
