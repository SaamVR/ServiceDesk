# F22 — Accepted quote → verified temporary capacity hold

**Batch:** F22 / IR21 existing successor #915. **Owner chat:** Feature Development. **Parent planned:** `b83a66b097b3ee43693b4c2b0bc69fb28f2c9e84`. **State:** source-only, not deployed or signed-in UAT.

## Business capability

An authenticated OWNER in ALL-branch scope can open Quotes, select a current accepted saved quote, inspect candidate saved capacity slots of active crews within that quote's request branch, and **explicitly request one temporary hold**. Candidates are labeled as *unverified until click*. The server performs two fresh owner/tenant/branch/source reads of quote, source request, current quote version, crew, slot capacity, existing holds and visits. It then uses the previously reviewed `holdOperationalSlot` command, which performs its own quote/slot resource authorization and calls the existing `servicedesk_hold_slot` protected database RPC. A fresh third owner authentication and saved `slot_holds` row readback must show exactly one HELD row for the same tenant, quote and slot, with a future expiry. Only then is a hold ID/expiry returned.

**A hold is NOT a booking, visit, payment, crew assignment, or customer/provider delivery.** No quote status change or billing action is performed. Underlying PostgreSQL exclusive active-slot hold index is in `supabase/migrations/0003_capacity_visits.sql`, but live RPC/migration installation is not confirmed.

## Lanes

- Backend/security: `src/server/workflows/owner-verified-quote-slot-hold.ts` — strict input, OWNER/ALL branch, source drift checks, preserve external concurrency semantics and fail closed on uncertain write result.
- Action boundary: `src/features/operations/verified-quote-slot-action.ts` — sanitized status and exact saved receipt only.
- UI: `OwnerQuoteCapacityHoldPanel.tsx`, `VerifiedQuoteSlotHoldControls.tsx`, additive `quotes/page.tsx`; explicit click, no auto-retry if a hold may have committed, and a link to Schedule.
- QA: `tests/ai/f22-verified-quote-slot-hold.test.ts`; source/tenant/branch drift, quote lifecycle, slot validity/capacity, duplicates and forged receipts.
- Independent Critic: `tests/ai/f22-verified-quote-slot-critic.test.ts`; preserve existing Schedule, F21 Inbox quote, F15/18/19 UI and avoid fake booking/send.
- Integration: single existing IR21 focused CI with TypeScript, lint, Next build, and reusable disposable F15 PG17 jobs.

**Limits:** A source snapshot may truncate capacity and holds. The UI only presents candidates; backend re-queries exact records and never treats missing snapshot rows as proof. Two concurrent owner actions may race the duplicate precheck but the pre-existing DB RPC and index must enforce locking; the source adapter never promises release/rollback if post-write readback fails. DBA must verify actual installed schema before staging acceptance.

**Production blockers:** P02 #818 authenticated two-tenant onboarding and owner approval, P03 #819 real branch pricing/service, a real accepted quote, crew capacity data, existing booking RPC installed and branch isolation verified. No Vercel deploy or Supabase SQL/credentials/provider/payment/customer mutation authorized. Production Chat owns the merge, owner-scope test environment and actual saved receipt acceptance.

**Next batch:** Confirm an approved held slot transitions to a scheduled visit only through the existing authenticated customer/owner booking and deposit/consent contracts; add reliable saved-visit readback only if an actual missing authorized command exists. Do not invent an automatic conversion from HOLD to BOOKED.
