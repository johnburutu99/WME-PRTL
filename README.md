# WME Dual-Portal — Talent & Booking Management System

Enterprise-grade, role-based client portal for entertainment agencies. Three isolated, authenticated interfaces: **Promoter/Buyer Portal (B2B)**, **Artist/Talent Portal**, and **Agent/Admin Dashboard**.

---

## System Architecture

### Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) · TypeScript · TailwindCSS |
| Auth | Supabase Auth (email/password, magic-link password reset) |
| Database | Supabase PostgreSQL with Row-Level Security (RLS) |
| Server Logic | Next.js Server Actions (`src/lib/actions/`) |
| Background Jobs | Supabase Edge Functions (Deno) |
| Payments | Stripe Checkout (50% deposit collection) |
| Deployment | Vercel (frontend) · Supabase hosted (DB + Edge Functions) |

### Portals

| Role | Route | Access |
|---|---|---|
| BUYER | `/buyer` | Submit bookings · sign contracts · pay deposits |
| TALENT | `/talent` | Review offer desk · view itinerary · financial ledger |
| AGENT / ADMIN | `/agent` | Full pipeline management · advance/reject bookings |

---

## Quick Start

### 1. Configure environment

Copy `.env.example` to `frontend/.env.local` and fill in your values:

```bash
cp .env.example frontend/.env.local
```

Required keys:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Supabase publishable key
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (server-side only)
- `STRIPE_SECRET_KEY` — Stripe secret key (`sk_test_...` for dev)
- `NEXT_PUBLIC_APP_URL` — Your app URL (e.g. `http://localhost:3000`)

### 2. Install and run

```bash
npm run install:all
npm run dev
```

Frontend runs at `http://localhost:3000`.

---

## Booking Lifecycle

```
PENDING_REVIEW → OFFER_PENDING → NEGOTIATING → NDA_PENDING → NDA_SIGNED
     → CONTRACT_PENDING → CONTRACT_SIGNED → AWAITING_DEPOSIT → CONFIRMED → COMPLETED
```

| Status | Who Triggers It |
|---|---|
| `PENDING_REVIEW` | Buyer submits intake form |
| `OFFER_PENDING` | `booking-submitted` Edge Function (auto) |
| `NEGOTIATING` | Agent advances in pipeline |
| `NDA_PENDING` | Talent approves offer → `offer-approved` Edge Function creates draft NDA |
| `NDA_SIGNED` | Buyer signs NDA in Contract Vault |
| `CONTRACT_PENDING` | Agent sends long-form contract |
| `CONTRACT_SIGNED` | Buyer signs contract |
| `AWAITING_DEPOSIT` | Agent requests deposit |
| `CONFIRMED` | Stripe deposit webhook (`payment.deposit_cleared`) |
| `COMPLETED` | Agent marks completed after event |

---

## Edge Functions

Located in `supabase/functions/`. Deployed to Supabase hosted environment.

| Function | Trigger | Action |
|---|---|---|
| `booking-submitted` | Called by `createBooking` server action | Advances `PENDING_REVIEW → OFFER_PENDING` |
| `offer-approved` | Called by `respondToOffer` server action | Creates draft NDA Contract record |
| `webhooks` | External HMAC-signed POST | Handles `payment.deposit_cleared`, `esign.nda_signed`, `esign.longform_signed` |

### Webhook testing

```bash
# Compute HMAC-SHA256 of your JSON payload using WEBHOOK_SECRET
# then POST to:
POST https://<project-ref>.supabase.co/functions/v1/webhooks
Headers: x-wme-signature: <hmac-hex>

# Deposit cleared
{"event":"payment.deposit_cleared","bookingId":"<id>","reference":"wire_ref_001"}

# NDA signed
{"event":"esign.nda_signed","bookingId":"<id>","documentUrl":"https://..."}
```

---

## Database

Tables: `User`, `Booking`, `Contract`, `FinancialLedger`, `FinancialTransaction`

All tables have RLS enabled. Role-based access is enforced via `get_app_role()` and `get_app_user_id()` helper functions.

Migration history is in `supabase/migrations/` (auto-fetched from hosted project).

### Regenerate TypeScript types

```bash
cd frontend
npx supabase gen types --linked > src/types/database.types.ts
```

---

## Security Notes

1. **Escrow credentials** and **contract documents** are only accessible inside authenticated portal sessions — never transmitted via email.
2. All webhook payloads are verified with HMAC-SHA256. Set `WEBHOOK_SECRET` in Supabase Edge Function secrets.
3. The Stripe secret key is server-side only and never bundled into the browser.
4. RLS policies ensure cross-tenant data isolation: buyers see their own bookings, talent sees their own offers.
