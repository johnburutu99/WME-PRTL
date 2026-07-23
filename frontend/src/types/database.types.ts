// AUTO-GENERATED — do not edit manually.
// Regenerate with: npx supabase gen types --linked > src/types/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      Booking: {
        Row: {
          agentId: string | null
          buyerId: string
          createdAt: string
          eventDate: string
          eventTitle: string
          guaranteedBudget: number
          hospitalityRider: string | null
          id: string
          radiusExclusivity: string | null
          status: Database['public']['Enums']['BookingStatus']
          talentId: string
          technicalRider: string | null
          updatedAt: string
          usageRights: string
          venueCapacity: number
          venueName: string
        }
        Insert: {
          agentId?: string | null
          buyerId: string
          createdAt?: string
          eventDate: string
          eventTitle: string
          guaranteedBudget: number
          hospitalityRider?: string | null
          id: string
          radiusExclusivity?: string | null
          status?: Database['public']['Enums']['BookingStatus']
          talentId: string
          technicalRider?: string | null
          updatedAt: string
          usageRights: string
          venueCapacity: number
          venueName: string
        }
        Update: {
          agentId?: string | null
          buyerId?: string
          createdAt?: string
          eventDate?: string
          eventTitle?: string
          guaranteedBudget?: number
          hospitalityRider?: string | null
          id?: string
          radiusExclusivity?: string | null
          status?: Database['public']['Enums']['BookingStatus']
          talentId?: string
          technicalRider?: string | null
          updatedAt?: string
          usageRights?: string
          venueCapacity?: number
          venueName?: string
        }
      }
      Contract: {
        Row: {
          bookingId: string
          contractType: string
          createdAt: string
          documentUrl: string
          id: string
          isSigned: boolean
          lockExpiration: string | null
          signedAt: string | null
          signerId: string
          updatedAt: string
        }
        Insert: {
          bookingId: string
          contractType: string
          createdAt?: string
          documentUrl: string
          id: string
          isSigned?: boolean
          lockExpiration?: string | null
          signedAt?: string | null
          signerId: string
          updatedAt: string
        }
        Update: {
          bookingId?: string
          contractType?: string
          createdAt?: string
          documentUrl?: string
          id?: string
          isSigned?: boolean
          lockExpiration?: string | null
          signedAt?: string | null
          signerId?: string
          updatedAt?: string
        }
      }
      FinancialLedger: {
        Row: {
          agencyCommission: number
          bookingId: string
          createdAt: string
          grossEarnings: number
          id: string
          netPayout: number
          payoutDate: string | null
          payoutStatus: string
          talentId: string
          taxWithholding: number
          updatedAt: string
        }
        Insert: {
          agencyCommission: number
          bookingId: string
          createdAt?: string
          grossEarnings: number
          id: string
          netPayout: number
          payoutDate?: string | null
          payoutStatus?: string
          talentId: string
          taxWithholding: number
          updatedAt: string
        }
        Update: {
          agencyCommission?: number
          bookingId?: string
          createdAt?: string
          grossEarnings?: number
          id?: string
          netPayout?: number
          payoutDate?: string | null
          payoutStatus?: string
          talentId?: string
          taxWithholding?: number
          updatedAt?: string
        }
      }
      FinancialTransaction: {
        Row: {
          amount: number
          bookingId: string
          clearedAt: string | null
          createdAt: string
          id: string
          reference: string | null
          status: Database['public']['Enums']['TransactionStatus']
          type: Database['public']['Enums']['TransactionType']
          updatedAt: string
        }
        Insert: {
          amount: number
          bookingId: string
          clearedAt?: string | null
          createdAt?: string
          id: string
          reference?: string | null
          status?: Database['public']['Enums']['TransactionStatus']
          type: Database['public']['Enums']['TransactionType']
          updatedAt: string
        }
        Update: {
          amount?: number
          bookingId?: string
          clearedAt?: string | null
          createdAt?: string
          id?: string
          reference?: string | null
          status?: Database['public']['Enums']['TransactionStatus']
          type?: Database['public']['Enums']['TransactionType']
          updatedAt?: string
        }
      }
      User: {
        Row: {
          auth_user_id: string | null
          createdAt: string
          email: string
          id: string
          name: string
          password: string
          role: Database['public']['Enums']['Role']
          updatedAt: string
        }
        Insert: {
          auth_user_id?: string | null
          createdAt?: string
          email: string
          id: string
          name: string
          password: string
          role?: Database['public']['Enums']['Role']
          updatedAt: string
        }
        Update: {
          auth_user_id?: string | null
          createdAt?: string
          email?: string
          id?: string
          name?: string
          password?: string
          role?: Database['public']['Enums']['Role']
          updatedAt?: string
        }
      }
    }
    Enums: {
      BookingStatus:
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
        | 'COMPLETED'
      Role: 'BUYER' | 'TALENT' | 'AGENT' | 'ADMIN'
      TransactionStatus: 'PENDING' | 'CLEARED' | 'FAILED'
      TransactionType:
        | 'DEPOSIT'
        | 'FINAL_PAYMENT'
        | 'COMMISSION'
        | 'WITHHOLDING'
        | 'PAYOUT'
    }
  }
}
