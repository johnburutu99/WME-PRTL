// ─── Shared portal types derived from the Prisma schema ───────────────────────

export type BookingStatus =
  | 'PENDING_REVIEW'
  | 'OFFER_PENDING'
  | 'OFFER_REJECTED'
  | 'NEGOTIATING'
  | 'NDA_PENDING'
  | 'NDA_SIGNED'
  | 'CONTRACT_PENDING'
  | 'CONTRACT_SIGNED'
  | 'AWAITING_DEPOSIT'
  | 'CONFIRMED'
  | 'COMPLETED';

export interface Talent {
  id: string;
  name: string;
  email: string;
}

export interface Booking {
  id: string;
  status: BookingStatus;
  eventTitle: string;
  eventDate: string;
  venueName: string;
  venueCapacity: number;
  guaranteedBudget: string | number;
  usageRights: string;
  createdAt: string;
  buyer?: { name: string; email: string };
  talent?: { name: string };
}

export interface LedgerEntry {
  id: string;
  grossEarnings: string | number;
  agencyCommission: string | number;
  taxWithholding: string | number;
  netPayout: string | number;
  payoutStatus: string;
  payoutDate?: string;
  createdAt: string;
  booking?: {
    eventTitle: string;
    eventDate: string;
    venueName: string;
  };
}

export interface JsonSchemaField {
  type: string;
  title?: string;
  description?: string;
  format?: string;
  minimum?: number;
  minLength?: number;
  maxLength?: number;
}

export interface BookingFormSchema {
  type: string;
  required: string[];
  properties: Record<string, JsonSchemaField>;
}
