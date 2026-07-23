# Requirements Document

## Introduction

The Agent Dashboard is the primary control center for WME agents working within the WME Portal. Agents are responsible for managing the full lifecycle of a booking — from initial buyer submission through talent assignment, deal negotiation, NDA and contract execution, deposit confirmation, and final completion.

The existing `/agent/page.tsx` is a stub implementation. This feature replaces and significantly extends it with a complete, production-ready dashboard. Agents have elevated visibility (they see all bookings across all buyers and all talent) and elevated permissions (they can advance any booking through every status transition). The dashboard must also expose financial summaries, contract management workflows, and a consolidated pending-actions view to help agents keep deals moving.

The system already has working portals at `/buyer` and `/talent`. The Agent Dashboard follows the same Next.js 14 App Router + Supabase + Tailwind CSS pattern and reuses existing server actions where they exist, adding new ones as needed.

---

## Glossary

- **Agent_Dashboard**: The React page and its constituent client components rendered at `/agent`, accessible only to users with the `AGENT` or `ADMIN` role.
- **Booking**: A deal record in the `Booking` table representing a buyer's request to engage a talent for an event, progressing through the defined status workflow.
- **Booking_Status**: One of the enumerated states in the booking lifecycle: `PENDING_REVIEW → OFFER_PENDING → OFFER_REJECTED → NEGOTIATING → NDA_PENDING → NDA_SIGNED → CONTRACT_PENDING → CONTRACT_SIGNED → AWAITING_DEPOSIT → CONFIRMED → COMPLETED`.
- **Deal_Pipeline**: The set of bookings currently in an in-progress status (all statuses except `COMPLETED` and `OFFER_REJECTED`).
- **Contract**: A record in the `Contract` table with fields `contractType` (`NDA` or `LONG_FORM`), `isSigned`, `documentUrl`, `signedAt`, and `lockExpiration`.
- **Financial_Ledger**: Records in the `FinancialLedger` table containing `grossEarnings`, `agencyCommission`, `taxWithholding`, `netPayout`, and `payoutStatus` for each completed or active booking.
- **Pending_Actions**: A consolidated list of bookings requiring an agent's immediate input: unsigned contracts, unconfirmed deposits, and bookings stuck in `PENDING_REVIEW`.
- **RLS**: Row Level Security policies enforced by Supabase on the database layer.
- **Server_Action**: A Next.js server action (`'use server'`) in `src/lib/actions/` validated with Zod and calling Supabase.
- **Status_Transition**: Moving a booking from its current `Booking_Status` to a specified next status via the `advanceBookingStatus` server action.
- **Talent_Roster**: The set of all `User` records with `role = 'TALENT'` along with their booking metrics derived from the `Booking` table.
- **RoleGuard**: The existing `RoleGuard` component that redirects unauthenticated or unauthorised users away from protected pages.

---

## Requirements

### Requirement 1: Role-Based Access Control

**User Story:** As a WME platform administrator, I want only authenticated users with the `AGENT` or `ADMIN` role to access the Agent Dashboard, so that sensitive deal data and control actions remain protected.

#### Acceptance Criteria

1. THE `Agent_Dashboard` SHALL wrap its content in the existing `RoleGuard` component configured to allow only `['AGENT', 'ADMIN']` roles.
2. WHEN an unauthenticated user navigates to `/agent`, THE `Agent_Dashboard` SHALL redirect the user to `/login`.
3. WHEN a user with a role of `BUYER` or `TALENT` navigates to `/agent`, THE `Agent_Dashboard` SHALL redirect the user to `/login`.
4. WHILE the `AuthContext` is loading the session, THE `Agent_Dashboard` SHALL display a full-screen loading spinner using the blue colour token (`border-blue-500`) consistent with the existing stub.
5. THE `Agent_Dashboard` SHALL display the authenticated agent's name, email, and role badge in the sidebar user section.

---

### Requirement 2: Navigation and Layout

**User Story:** As an agent, I want a clearly structured dashboard with named sections, so that I can quickly switch between the deal pipeline, financial overview, contracts, pending actions, and talent roster.

#### Acceptance Criteria

1. THE `Agent_Dashboard` SHALL render a persistent sidebar on desktop (≥ `md` breakpoint) and a collapsible overlay sidebar on mobile (< `md` breakpoint) using the same pattern as the existing buyer and talent portals.
2. THE `Agent_Dashboard` SHALL provide exactly five navigation tabs: `Pipeline`, `Pending Actions`, `Contracts`, `Financials`, and `Roster`.
3. WHEN a navigation tab is active, THE `Agent_Dashboard` SHALL apply the `bg-blue-500 text-slate-950` active styles to that tab button, consistent with the existing stub design.
4. THE `Agent_Dashboard` sidebar SHALL display live numeric badges on the `Pipeline` and `Pending Actions` tabs reflecting the current count of items in each section.
5. THE `Agent_Dashboard` sidebar SHALL display a summary grid of four deal-count statistics: In Pipeline, Confirmed, Completed, and Rejected — updated every time the booking data refreshes.
6. WHEN the mobile sidebar overlay is open, THE `Agent_Dashboard` SHALL render a backdrop overlay that closes the sidebar when clicked.

---

### Requirement 3: Global Booking Visibility

**User Story:** As an agent, I want to see all bookings across every buyer and every talent in the system, so that I have full portfolio visibility without any ownership filtering.

#### Acceptance Criteria

1. THE `Agent_Dashboard` SHALL call the existing `getAllBookings` server action to load all bookings regardless of `buyerId` or `talentId`.
2. THE `getAllBookings` server action SHALL return bookings with joined `buyer` (name, email), `talent` (name), and `contracts` (id, contractType, documentUrl, isSigned, signedAt, lockExpiration) fields.
3. WHEN `getAllBookings` returns an error, THE `Agent_Dashboard` SHALL display a dismissible error banner with a Retry button that re-invokes data loading.
4. THE `Agent_Dashboard` SHALL expose a manual Refresh button in the main content area header that re-invokes the full data load sequence.
5. WHEN data is loading, THE `Agent_Dashboard` SHALL display a full-page centred blue spinner in the main content area and SHALL hide the spinner when a loading error occurs so that the error banner is visible instead.

---

### Requirement 4: Deal Pipeline Management

**User Story:** As an agent, I want to see all in-progress bookings in a deal pipeline view and advance each booking to the next status with a single click, so that I can keep deals moving efficiently.

#### Acceptance Criteria

1. THE `Agent_Dashboard` Pipeline tab SHALL display all bookings whose status is one of: `PENDING_REVIEW`, `OFFER_PENDING`, `NEGOTIATING`, `NDA_PENDING`, `NDA_SIGNED`, `CONTRACT_PENDING`, `CONTRACT_SIGNED`, or `AWAITING_DEPOSIT`.
2. WHEN an agent clicks the advance action button on a booking, THE `Agent_Dashboard` SHALL call `advanceBookingStatus` with the booking's ID and the next status determined by the defined `STATUS_FLOW` mapping.
3. THE `STATUS_FLOW` mapping SHALL define the following transitions: `PENDING_REVIEW → OFFER_PENDING`, `OFFER_PENDING → NEGOTIATING`, `NEGOTIATING → NDA_PENDING`, `NDA_SIGNED → CONTRACT_PENDING`, `CONTRACT_SIGNED → AWAITING_DEPOSIT`, `AWAITING_DEPOSIT → CONFIRMED`, `CONFIRMED → COMPLETED`.
4. WHILE an advance action is genuinely in flight for a specific booking, THE `Agent_Dashboard` SHALL disable that booking's action buttons and display an "Updating…" label only for that booking.
5. THE `Agent_Dashboard` Pipeline tab SHALL display each booking card showing: status badge with colour coding, event title, venue name, event date, buyer name, talent name, guaranteed budget, and venue capacity.
6. WHEN a booking is in `PENDING_REVIEW`, `OFFER_PENDING`, or `NEGOTIATING` status, THE `Agent_Dashboard` SHALL render a Reject button alongside the advance button that sets the status to `OFFER_REJECTED` via `advanceBookingStatus`. THE `Agent_Dashboard` SHALL NOT render a Reject button for bookings in any other status.
7. IF a booking has associated `Contract` records, THEN THE `Agent_Dashboard` SHALL render a Documents section within that booking card listing each contract's type and signed status, with a View link for signed contracts.
8. THE `Agent_Dashboard` Pipeline tab SHALL display the next status label as a secondary indicator beside the current status badge so agents can preview the upcoming transition.
9. WHEN the pipeline is empty, THE `Agent_Dashboard` SHALL display an empty-state card with an appropriate message.

---

### Requirement 5: Talent Assignment

**User Story:** As an agent, I want to assign or reassign a talent to a booking that has no talent yet, so that I can match the right artist to incoming buyer requests.

#### Acceptance Criteria

1. WHEN a booking has no `talentId` assigned (talent is null), THE `Agent_Dashboard` SHALL render an "Assign Talent" button on that booking's pipeline card.
2. WHEN the agent clicks "Assign Talent", THE `Agent_Dashboard` SHALL display an inline talent selector populated by calling the existing `getTalents` server action.
3. WHEN the agent confirms the talent selection, THE `Agent_Dashboard` SHALL call the `assignTalentToBooking` server action with the booking ID and selected talent ID.
4. THE `assignTalentToBooking` server action SHALL validate that the caller has `AGENT` or `ADMIN` role, validate both IDs as UUIDs, update the `talentId` on the `Booking` row, and return an `ActionResult`.
5. IF the `assignTalentToBooking` server action is called with an invalid booking ID or talent ID, THEN THE server action SHALL return an `ActionResult` with a descriptive error string and `data: null`.
6. AFTER a successful talent assignment, THE `Agent_Dashboard` SHALL refresh booking data and dismiss the talent selector.

---

### Requirement 6: Pending Actions Center

**User Story:** As an agent, I want a single view of all items requiring my immediate attention, so that I do not miss critical deal-blocking actions.

#### Acceptance Criteria

1. THE `Agent_Dashboard` Pending Actions tab SHALL aggregate and display three categories of pending items: (a) bookings in `PENDING_REVIEW` status, (b) bookings with at least one unsigned `Contract` record, and (c) bookings in `AWAITING_DEPOSIT` status.
2. EACH pending item SHALL display the booking title, buyer name, status, and the specific action required labelled clearly (e.g. "Review Booking", "Contract Awaiting Signature", "Deposit Unconfirmed").
3. WHEN there are zero pending items across all three categories, THE `Agent_Dashboard` SHALL display an empty-state card with a "All clear — no pending actions" message.
4. THE numeric badge on the `Pending Actions` sidebar navigation item SHALL equal the total count of all pending items across the three categories.
5. WHEN the agent clicks an advance action from the Pending Actions tab, THE `Agent_Dashboard` SHALL call `advanceBookingStatus` and refresh data, identical in behaviour to the Pipeline tab action.

---

### Requirement 7: Contract Management

**User Story:** As an agent, I want to view and manage all contracts across the portfolio, so that I can track NDA and long-form contract status, generate new contracts, and ensure nothing is blocking a booking's progress.

#### Acceptance Criteria

1. THE `Agent_Dashboard` Contracts tab SHALL display a list of all `Contract` records joined across all bookings, showing: contract type, associated booking title, buyer name, signed status, signed date (if signed), and lock expiration date (if present).
2. THE `Agent_Dashboard` Contracts tab SHALL support filtering the contracts list by status: All, Pending Signature, and Signed.
3. WHEN a contract is unsigned and a View Document URL is available, THE `Agent_Dashboard` SHALL render a View button that opens the `documentUrl` in a new tab.
4. THE `Agent_Dashboard` Contracts tab SHALL render a "Generate NDA" and "Generate Long-Form Contract" action for bookings that have reached `NDA_PENDING` or `CONTRACT_PENDING` status respectively but have no corresponding `Contract` record yet.
5. WHEN the agent clicks "Generate NDA" or "Generate Long-Form Contract", THE `Agent_Dashboard` SHALL call the `generateContract` server action with the booking ID and contract type.
6. THE `generateContract` server action SHALL validate that the caller has `AGENT` or `ADMIN` role, validate the booking ID as a UUID, validate that the booking ID references an existing `Booking` row (returning an error if the booking is not found), validate that the `contractType` is either `NDA` or `LONG_FORM`, insert a new `Contract` record with `isSigned = false` and a 48-hour `lockExpiration`, and return an `ActionResult<{ id: string }>`.
7. IF a `Contract` record already exists for the same booking and contract type, THEN THE `generateContract` server action SHALL return an `ActionResult` with error `'Contract already exists for this booking and type'` and `data: null`.
8. WHEN an agent attempts to generate both an `NDA` and a `LONG_FORM` contract for the same booking simultaneously, THE `generateContract` server action SHALL process each request independently and create two separate `Contract` records if validation passes for each type.
9. THE `Agent_Dashboard` Contracts tab SHALL display a global NDA policy notice: "WME contracts are never distributed via email. All signatures must be completed inside this portal."

---

### Requirement 8: Financial Summary

**User Story:** As an agent, I want to see aggregated financial data across my portfolio, so that I can track total guaranteed budgets, agency commissions earned, and outstanding payments.

#### Acceptance Criteria

1. THE `Agent_Dashboard` Financials tab SHALL display four summary metric cards: Total Guaranteed Budget (sum of `guaranteedBudget` across all non-rejected bookings), Total Agency Commission (sum of `agencyCommission` from `FinancialLedger`), Total Net Payouts (sum of `netPayout` from `FinancialLedger`), and Outstanding Deposits (count of bookings in `AWAITING_DEPOSIT` status).
2. THE `Agent_Dashboard` Financials tab SHALL display a ledger table of all `FinancialLedger` records joined with booking details (eventTitle, eventDate, venueName, talentName), showing: gross earnings, agency commission, tax withholding, net payout, and payout status.
3. THE `getAgentFinancials` server action SHALL validate that the caller has `AGENT` or `ADMIN` role and return all `FinancialLedger` rows joined with their `Booking` (eventTitle, eventDate, venueName) and `Booking.talent` (name) fields, ordered by `createdAt` descending.
4. IF no `FinancialLedger` records exist, THEN THE `Agent_Dashboard` Financials tab SHALL display an empty-state message: "No financial records yet. Records appear here once bookings are completed."
5. ALL currency values in the Financials tab SHALL be formatted as USD with thousand separators (e.g. `$12,500`).

---

### Requirement 9: Talent Roster

**User Story:** As an agent, I want to view all talent in the system along with their booking metrics, so that I can monitor which artists are active, how many deals they have in the pipeline, and their confirmed engagement count.

#### Acceptance Criteria

1. THE `Agent_Dashboard` Roster tab SHALL derive the talent roster from the loaded booking data: for each unique `talentId`, aggregate total bookings, pipeline count (statuses not `COMPLETED` or `OFFER_REJECTED`), confirmed count, and completed count.
2. THE `Agent_Dashboard` Roster tab SHALL always call `getTalents` in addition to using booking data, so that talent users who have no bookings yet are included in the roster with zero counts.
3. EACH talent entry in the roster SHALL display: the talent's name initial avatar, full name, total booking count, pipeline count, confirmed count, and completed count.
4. WHEN the talent roster is empty, THE `Agent_Dashboard` SHALL display an empty-state card with a message indicating no talent is in the system.
5. THE `Agent_Dashboard` Roster tab SHALL display the roster as a full-width list panel with a heading showing the total number of talent records.

---

### Requirement 10: Error Handling and Data Refresh

**User Story:** As an agent, I want clear error feedback and the ability to retry failed data loads without a full page refresh, so that temporary network or server issues do not block my workflow.

#### Acceptance Criteria

1. WHEN any server action called by the `Agent_Dashboard` returns a non-null `error` field, THE `Agent_Dashboard` SHALL display a dismissible error banner at the top of the main content area containing the error message and a Retry button.
2. WHEN the Retry button is clicked, THE `Agent_Dashboard` SHALL re-invoke only the specific data loading action that failed rather than the full data loading sequence.
3. IF an action (advance, reject, assign talent, generate contract) fails, THEN THE `Agent_Dashboard` SHALL display the error inline in the error banner and keep all other data unchanged.
4. THE `Agent_Dashboard` SHALL use `useCallback` for the data-loading function to prevent unnecessary re-renders, consistent with the pattern in the existing buyer portal.
5. WHEN any write action completes successfully (advance, reject, assign talent, generate contract), THE `Agent_Dashboard` SHALL automatically refresh all booking data without requiring a manual page reload.
