# F21 — Inbox saved first-quote calculation (Source-only, 2026-10-30)

**Owner operating contract:** https://github.com/SaamVR/ServiceDesk/issues/808#issuecomment-6510726968.
**Candidate:** existing DRAFT #915 only; NO new PR or separate base. Last verified source at planning: `3ae5fd9fced8fbb6d65a4b7f296e54596e2d8d5e`.

## Concrete owner journey

For an explicitly selected saved Inbox thread with an authorized READY or NEEDS_REVIEW cleaning request and a verified active owner-approved branch price book, the owner can click **Calculate saved first quote**. The action accepts ONLY workspace slug and conversation UUID. It resolves the trusted saved conversation→request and reauthorizes OWNER+ALL branch twice before the write; it reads confirmed service/rooms and refuses **any** earlier saved quote for the request (including historical/superseded). The already-reviewed `calculateOperationalQuote` is invoked with `oven:false`: existing tenant-scoped price-book loader + source/persistence RPC produce the quote, never an AI default price. Finally, a third authenticated owner session independently checks one saved `quotes` row and exact workspace/request/status/version/USD-or-valid-currency, reconciled subtotal/tax/deposit/balance/duration, before revealing a staff-only Quotes link.

**No customer message, quote-send, AI inference, booking, charge, provider delivery, or crew dispatch.** The source receives only the saved quote UUID and revision and requires separate staff approval/quote send. The adjacent protected F15 saved-SLA, F15 attention-link, F18 consents, F19 request-rule execution, F20 retention and finance functions are unchanged.

## Deliberate boundaries / genuine limitations

1. Initial quote only: if `quotes` already contains any record for the request, refuse and direct owner to the Quotes renewal workflow. No silent overwriting, contact or quote supersession.
2. **Concurrent first-quote DB write safety is not proven by this app-side double read.** A second owner clicking at the same instant can race the existing `servicedesk_persist_quote_snapshot` RPC unless its installed version serializes this operation. The action verifies exactly one saved quote after writing; any 2-row result is `QUOTE_READBACK_UNVERIFIED`, never success. Production DBA must inspect the actual quote RPC locking/preimage before enabling in staging/production. No SQL change is implicitly approved.
3. Real owner pricing may be missing because P03 #819 is blocked behind P02 #818. UI eligibility requires source-backed `ownerPricingBookProof`; server quote pricing independently fails without real saved rates. The ability to click or see a green test does NOT establish a live book or quoted customer.
4. All errors are bounded to a generic unavailable status; after a readback failure the UI warns that **a quote may already have saved** and never auto-retries. This avoids duplicate quote issuance.
5. No direct client-supplied request ID, price, currency, deposit, add-on, staff identity or tenant access. No live Supabase/Auth/Vercel/provider calls.

## Work lanes and critic
- **Backend + saved source:** `src/server/ai/owner-inbox-first-quote.ts`
- **Server action:** `src/features/operations/inbox-first-quote-action.ts`
- **Client + UX gate:** `InboxFirstQuoteAction.tsx`, `inbox-first-quote-gate.ts`, additive `InboxRequestRulesPanel.tsx`.
- **QA + independent security critic:** `tests/ai/f21-inbox-first-quote.test.ts`, `f21-inbox-first-quote-critic.test.ts`. Negative tests for wrong role/tenant/branch, unready source, missing rooms, existing quote, source revision drift, forged saved-row money, two concurrent quotes, calculator crash, bad mode, UI gate.
- **Integration:** update existing IR21 focused workflow, one TS/lint/build + existing disposable PG17. Do not redo full legacy RC without source-risk justification. Source SHA exact acceptance, not claims of real saved business acceptance.

**Next batch:** Production integration review one #915 successor with P02 two-owner staging approvals, then validate actual `servicedesk_persist_quote_snapshot` concurrent first-quote collision protection, P03 saved active branch book and a real owner saved Inbox→first saved quote readback→approval→booking flow. Without approvals, keep rollout blocked and report the missing authorization.
