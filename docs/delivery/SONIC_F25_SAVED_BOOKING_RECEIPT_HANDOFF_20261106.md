# F25 — Owner saved booking & deposit evidence (2026-11-06)

**Repository:** SaamVR/ServiceDesk · **Feature Chat** · **Existing DRAFT successor PR #915 only**. **No new PR, no schema/live provider writes.**

## Full vertical journey

The owner opens **Quotes → an accepted saved quote**. A separate server-rendered panel displays **Saved booking evidence** ONLY after TWO independent, same-owner/tenant/ALL-branch database reads agree about all of these:

- Exact accepted quote and its saved source request, authorized active branch; valid quote revision and nonzero recorded deposit.
- Exactly ONE saved non-cancelled visit for this quote. Its request, quote, hold, slot, crew, start and end agree across source rows.
- The referenced slot hold is `CONFIRMED`, not `HELD` / `RELEASED` / `EXPIRED`.
- The saved capacity slot and crew exist in the same workspace and branch; visit times reconcile.
- Exactly ONE invoice for that quote, linked to the saved visit, same currency, with nonnegative/consistent balances, status `PAID` or `PARTIALLY_PAID`, and net applied balance not below the required quote deposit.
- Exactly ONE `verified_payment_applications` `DEPOSIT / APPLIED` application. Its quote, confirmed hold, invoice, deposit amount and currency reconcile exactly.
- The second authorized saved query has the same complete source fingerprint. Any row drift, ambiguity, cross-tenant reference, ownership loss, mixed currencies, unexplained refund, missing invoice, or payment in `REVIEW` returns a bounded unavailable result.

The visible receipt includes only saved visit start/status, quote revision, invoice status, and navigation to Schedule/Invoices. It **never exposes raw payment/provider credentials, transaction IDs, customer PII or a new customer message**. The panel is strictly read-only; it cannot create a booking or charge/payment.

## Files and lanes

- **Backend/tenant-security:** `src/server/ai/owner-saved-booking-receipt.ts`, real tenant-scoped Supabase PostgREST reads.
- **Owner UX:** `src/features/operations/OwnerSavedBookingReceiptPanel.tsx` and additive `src/app/app/[workspace]/quotes/page.tsx`.
- **QA/adversarial:** `tests/ai/f25-owner-saved-booking-receipt.test.ts` — path through simulated saved rows, mismatched tenant/branch, invalid quote, unconfirmed hold, stale visit, invoice refund, missing/misapplied deposit, duplicate visit and actor/source change.
- **Independent Critic:** `tests/ai/f25-owner-booking-receipt-critic.test.ts` — no payment mutation, provider calls or misleading temporary-hold claim.
- **Integrator:** extend existing exact-head IR21 workflow with ONLY changed tests/TS/lint/Next build, reusing prior unchanged PostgreSQL security fixtures. No duplicate CI on unchanged SHA.

## Booking security / release truth

The canonical `supabase/migrations/0010_e03_verified_payment_rpc.sql` **already** holds the accepted quote/slot, creates the invoice and visit, confirms the hold and records the applied provider deposit inside one PostgreSQL transaction. F24 independently fenced the unsafe old `confirmHold → insertVisit` repository path; its new atomic port remains **unimplemented in the live gateway** and fails closed without trusted configured support. F25 does **not** activate that port and instead verifies saved consequences of the original payment RPC.

A source-green or disposable PG17 check does not prove that an actual customer paid or that ServiceDesk was deployed. Payment data is treated as an internal verified-application record, not an independent bank/provider confirmation performed by this screen. Do not claim signed-in staging acceptance without authorized owners, real rows, app deployment, security review, and provider receipt.

**Blockers:** P02 #818 remains open; P03 #819 owner pricing/accepted quote and independent A/B identities depend on explicit owner permission; no Vercel creation/import/deploy or live SQL/tenant/payment action permitted.

**NEXT TASK:** Production Chat review the single #915 F24/F25 successor and the genuine verified-deposit booking RPC authority chain, then request precise P02 owner+DBA sign-off for two-owner staging. Feature Chat should stop adding booking PRs until this source integration decision and operational browser/DB acceptance; further tests must correspond to demonstrated defects.
