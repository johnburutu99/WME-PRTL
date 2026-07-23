'use server';

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import type { ActionResult } from './bookings.actions';
import type { Booking } from '@/types/portal';

// ─── Advance booking status (AGENT / ADMIN only — RLS enforces) ──────────────

const AdvanceStatusSchema = z.object({
  bookingId: z.string().min(1),
  newStatus: z.enum([
    'PENDING_REVIEW',
    'OFFER_PENDING',
    'NEGOTIATING',
    'NDA_PENDING',
    'NDA_SIGNED',
    'CONTRACT_PENDING',
    'CONTRACT_SIGNED',
    'AWAITING_DEPOSIT',
    'CONFIRMED',
    'COMPLETED',
    'OFFER_REJECTED',
  ] as const),
});

export async function advanceBookingStatus(
  bookingId: string,
  newStatus: z.infer<typeof AdvanceStatusSchema>['newStatus'],
): Promise<ActionResult> {
  const parsed = AdvanceStatusSchema.safeParse({ bookingId, newStatus });
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('Booking')
    .update({ status: newStatus, updatedAt: new Date().toISOString() })
    .eq('id', bookingId);

  if (error) return { data: null, error: error.message };
  return { data: undefined, error: null };
}

// ─── Get all bookings with full detail (AGENT / ADMIN view) ──────────────────

export async function getAllBookings(): Promise<ActionResult<Booking[]>> {
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

// ─── Sign a contract on behalf of portal (marks isSigned = true) ─────────────

export async function signContract(contractId: string): Promise<ActionResult> {
  if (!contractId) return { data: null, error: 'Missing contract ID' };

  const supabase = await createClient();

  const { data: contract, error: fetchErr } = await supabase
    .from('Contract')
    .select('id, isSigned, bookingId')
    .eq('id', contractId)
    .single();

  if (fetchErr || !contract) return { data: null, error: 'Contract not found' };
  if (contract.isSigned) return { data: null, error: 'Contract already signed' };

  const { error: updateErr } = await supabase
    .from('Contract')
    .update({
      isSigned: true,
      signedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .eq('id', contractId);

  if (updateErr) return { data: null, error: updateErr.message };

  // Determine next booking status based on contract type
  const { data: fullContract } = await supabase
    .from('Contract')
    .select('contractType')
    .eq('id', contractId)
    .single();

  if (fullContract?.contractType === 'NDA') {
    await supabase
      .from('Booking')
      .update({ status: 'NDA_SIGNED', updatedAt: new Date().toISOString() })
      .eq('id', contract.bookingId);
  } else if (fullContract?.contractType === 'LONG_FORM') {
    await supabase
      .from('Booking')
      .update({ status: 'CONTRACT_SIGNED', updatedAt: new Date().toISOString() })
      .eq('id', contract.bookingId);
  }

  return { data: undefined, error: null };
}
