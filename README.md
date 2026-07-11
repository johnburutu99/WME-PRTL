# WME Dual-Portal Talent & Booking Management System Scaffold

An enterprise-grade, secure, role-based client portal designed for elite entertainment agencies (WME-style). This system splits administrative agency workflows into two isolated, highly secure interfaces: the **Promoter / Buyer Portal (B2B)** and the **Artist / Talent Portal (Internal App)**.

---

## 🏗️ System Architecture & Stack

### Frontend (`/frontend`)
- **Framework**: Next.js 14 (App Router) + TypeScript + TailwindCSS.
- **State Management**: Persisted Local Authentication Context, dynamic UI tracking, and clean client-server state.
- **Dynamic Forms**: Handled via `react-hook-form` driven by NestJS schema validation.

### Backend (`/backend`)
- **Framework**: NestJS (TypeScript) utilizing a modular architecture.
- **Database Engine**: PostgreSQL connected via **Prisma ORM**.
- **Caching & Pipelines**: Redis-backed **BullMQ** job processors.
- **Visual Monitor**: Visual Queue Monitor dashboard loaded under `/queues`.
- **Security Protocols**: HMAC Signature cryptographically verified webhook receivers (`/webhooks/events`).

---

## 🔒 Non-Negotiable Security Operations

1. **Phishing Mitigation**: Escrow banking credentials, contract drafts, and performance riders are **never transmitted via email**. Promoters and artists must log in to their authenticated portal sessions to access sensitive details.
2. **ACID Transaction Enforcements**: All state switches—such as transitioning a booking hold to confirmed status upon deposit clearance—are bound by ACID-compliant atomic transactions to guarantee data ledger integrity.
3. **Roles Isolation**: Route and API actions are guarded by NestJS `@Roles(...)` metadata decorator and strict token claims analysis preventing cross-tenant leakage.

---

## 🚀 Quick Start Guide

### 1. Start Services (PostgreSQL & Redis)
From the repository root, start PostgreSQL and Redis using the workspace scripts (or your pre-configured local equivalents):
```bash
npm run db:up
```

### 2. Configure Database & Seed Default Entries
Run migrations to set up the tables and seed the database with demo logins, holds, and cleared ledgers:
```bash
npm run db:migrate
```

### 3. Spin Up Development Servers
Launch both the NestJS API (`http://localhost:3001`) and the Next.js Frontend (`http://localhost:3000`) concurrently with one simple command:
```bash
npm run dev
```

---

## 🔑 Demo Account Profiles

Navigate to `http://localhost:3000/login` and use one of the seeded profiles to experience the isolated interfaces:

| Portal Portal | Login Email | Password | Allowed Routing |
| :--- | :--- | :--- | :--- |
| **Buyer Portal** (B2B Promoter) | `buyer@b2b.com` | `password123` | `/buyer` |
| **Talent Portal** (Internal Artist) | `talent@artist.com` | `password123` | `/talent` |

---

## 🔀 Booking Lifecycle Demo Walkthrough

### Step 1: Submit Booking Intake Form
Log in as the **Buyer** (`buyer@b2b.com`) and navigate to **Booking Intake & Forms**. Fill out the details to book **DJ Sparkle** for a new festival and click submit.
- **Behind the Scenes**: The submission POSTs to `/bookings` on the backend, enqueuing a background task on the `bookings-pipeline` BullMQ queue.
- Check the console logs of the NestJS server to see the background processor triggering mock invoices and template discovery logs.
- Go to `http://localhost:3001/queues` to inspect job statuses visually in the Bull Board dashboard.

### Step 2: Approve the Deal Memo (Offer Desk)
Log out and log in as **Talent** (`talent@artist.com`). You will see a red notification indicating a new offer. Go to the **Agent Offer Desk** tab.
- Here, the artist can review the vetted deal memo and click **Approve Memo**. This calls the backend API and schedules a background contract generator worker.

### Step 3: Trigger a Simulated Webhook (Deposit Settlement / Signing)
For automated workflows, use `curl` to simulate cryptographically verified Stripe and DocuSign callback webhooks:

#### A. Trigger NDA Signature Callback
```bash
curl -X POST http://localhost:3001/webhooks/events \
  -H "Content-Type: application/json" \
  -H "x-wme-signature: 8352b2f6efba9830588665da9dfaee59346618beff141974ef5ebc0850257bf4" \
  -d '{
    "event": "esign.nda_signed",
    "bookingId": "REPLACE_WITH_PENDING_BOOKING_ID",
    "documentUrl": "https://wme-vault.s3.amazonaws.com/contracts/completed_nda.pdf"
  }'
```

#### B. Trigger 50% Escrow Wire / Deposit Cleared Callback
This transitions the status to `CONFIRMED` and registers active entries inside the **Financial Ledger**:
```bash
curl -X POST http://localhost:3001/webhooks/events \
  -H "Content-Type: application/json" \
  -H "x-wme-signature: b1b63e620572ebf8df142e0fa540d588da65481dbe2258fa727045b804fe6881" \
  -d '{
    "event": "payment.deposit_cleared",
    "bookingId": "REPLACE_WITH_PENDING_BOOKING_ID",
    "reference": "wire_chase_tr_9901A"
  }'
```
*(Note: To test with custom booking IDs, compute the HMAC-SHA256 signature of your JSON payload using the secret key `wme_hmac_webhook_secret_key` and pass it in the `x-wme-signature` header).*

---

## 🗄️ Database Table Schema Highlights

- **User**: ID, email, hashed password, name, and role (`BUYER`, `TALENT`, `AGENT`, `ADMIN`).
- **Booking**: Active status indicator (`PENDING_REVIEW`, `OFFER_PENDING`, `CONFIRMED`, etc.), targeted venue capacity, and guaranteed budget.
- **Contract**: PDF files, signed dates, signatures status, and 48-Hour lock indicators.
- **FinancialTransaction**: Payment ledger type (`DEPOSIT`, `FINAL_PAYMENT`, `COMMISSION`), wire reference codes, and transaction status.
- **FinancialLedger**: Tracks gross margins, 15% agency commissions, tax withholdings, net payouts, and wire transfers.
