# V4 Real Owner Operational Acceptance — Evidence-First Runbook

**Status:** planning artifact, NOT a passing test, staging authorization, synthetic evidence, or permission to activate providers.
**Scope:** ServiceDesk cleaning-vertical SaaS, isolated authorized QA environment only. Never execute on `main` production without separately approved change control.

## Baseline and invariants

- Verify GitHub controller exact HEAD, review deploy SHA, locked full RC, and the connected Supabase **project reference** before testing. Record SHA and timestamp in a private operator evidence log; do not post customer/session data.
- `0061` owner first-run pricing RPC and `0062` seven-table branch guards have been seen installed on the connected ServiceDesk project. Repeat read-only verification against the **designated QA target** before each test. The optional transactional quote-source journal `0063` is **NOT** proven installed and MUST NOT be presumed.
- Do not change sandbox/customer records until a verified staging owner and explicit test-data scope are established. Do not use realistic but invented pricing as if it belonged to the business; the owner enters approved test rates.
- No automatic WhatsApp/email delivery, Stripe live charge, Google Calendar mutation or AI provider inference is part of this runbook unless that specific connector test is authorized.
- Treat a visible dashboard, passing fixture, green PR, and a provider-configured badge as **source proof only**, never owner-operational acceptance.

## Lanes, parallel ownership, and integration dependencies

| Lane | Independence | Closure evidence |
| --- | --- | --- |
| A — Identity and tenancy | May run with existing sessions, no pricing write required | Confirmed email owner, one-tenant session, separate tenant denied, saved role and branch scope |
| B — Owner commercial setup | Depends on A's authorized owner; separate scoped branch | Approved cleaning service and actual USD rates persisted and read back, quote-currency policy checked |
| C — Request to invoice | Depends on B's verified rate card | Saved request → real quote → customer ACCEPTED → scheduled visit/job → invoice, with the exact same scoped record IDs privately correlated |
| D — Internal automation | Depends on A/B and an owner-published matching rule; `0063` requires separate migration authorization | OFF means no trigger, tenant A opt-in does not trigger tenant B, accepted quote causes saved internal attention, replay idempotency and controlled retry only |
| E — Provider boundaries | May be reviewed in parallel as read-only diagnostics; live sends separately authorized | Provider-specific verified sandbox receipts, webhook deduplication and explicit approval records |
| Integrator | Waits for all required independent lane evidence | Final exact review deploy SHA, no uncommitted loss, merged PRs, DB migration ledger, security advisors and accepted release decision |

Use **GitHub Runtime and CI** for immutable source tests and disposable PostgreSQL rehearsals. Prefer batched, targeted device checks only where browser sign-in/audio/real provider behavior requires them; preserve any staged/untracked samai worktrees.

## Operator execution order

1. **Identity/authorization (Lane A).** Open a new private window, sign into the explicitly approved QA owner, confirm email/session and workspace choice. Attempt a second workspace with a separately invited QA owner, and ensure cross-tenant requests, pricing, rules and customer records are denied by their RLS policies. Explicitly test suspended/unauthorized role and stale session. Capture only redacted role/scope/result codes.
2. **Commercial setup (Lane B).** From Owner onboarding, confirm the actual catalog and price-book checklist begins **not ready** for an empty business. Enter an approved non-production cleaning service and price through the protected owner Settings editor. Verify the returned service, active USD branch price-book and price minor units **match the owner's input exactly**, and an unrelated branch remains unaffected. Never claim that a mere active service verifies a quote price.
3. **Operational journey (Lane C).** Create one authorized test request from an actual customer route, generate and review the quote using the saved price book, confirm branch currency and amount, deliver through a separate approved channel only if required, have the authorized customer accept it, assign/schedule a visit and create an invoice. Audit quote/visit/invoice relationships and statuses without copying contact details into GitHub.
4. **Automation activation (Lane D).** Start with both server global switch and workspace flag OFF. Verify an owner cannot opt in with absent pricing/rule/journal. After approved migration `0063` deployment to isolated staging, publish a same-branch `QUOTE_ACCEPTED` internal `CREATE_ATTENTION` rule, opt in only tenant A, accept one actual test quote and verify journal + execution + action receipt + attention record. Confirm tenant B is still OFF. Test a controlled worker lease expiration and replay with no second attention action. External email/WhatsApp actions remain approval-required.
5. **Connectors (Lane E).** For AI, show a real authorized inference receipt only when the provider is actually configured and an owner-approved test is performed; otherwise show blocked/unverified. For WhatsApp, Calendar, email and Stripe sandbox, capture request/webhook processing and actual provider response separately. Never call a configured token a successful delivery.
6. **Integrator.** Use the exact SHA of the deployed candidate. Run full CI, browser responsive, authenticated owner route matrix, migration checksum/ledger, Supabase security advisers, and rollback rehearsal. Accept only evidence from matching build, target and tenant scopes.

## Required evidence schema (redacted, per lane)

Store a private entry for each lane containing: `testedAt` (ISO timestamp), `buildSha`, `reviewDeployId`, `databaseProjectRef` (not password/secret), `scope` (e.g. tenant A or B pseudonym), `sourceAction`, `savedReadback`, `securityDecision`, `result = PASS|BLOCKED|FAIL`, `evidenceLocation` (access-controlled), and `operatorReview`. Never include bearer tokens, cookies, service-role keys, phone numbers, customer names, payment details or personal contact addresses.

Record a **BLOCKED** result, not PASS, if a required source record is missing, schema state is unknown, the branch-currency guard denies an action, an owner is not authorized, or a provider's actual response is absent. Any simulated fixture must be explicitly labelled `SYNTHETIC_ONLY` and is not a closure receipt.

## Stop conditions

- Unknown or unexpected tenant/session ownership or security advisor regression.
- Migration journal/privilege state differs from the approved SQL plan.
- Price book readback differs from owner-entered test values.
- Quote acceptance reports success but saved state or internal source event is missing.
- A foreign tenant obtains even a read-only row it should not see.
- A provider sends a message, event, charge or calendar action without explicit approved scope.

On STOP: disable the internal worker kill switch, avoid retries that could duplicate external effects, preserve logs/evidence privately, and open a scoped P0 issue. Do not reset shared branches, force-push, discard samai worktrees, or run unchecked SQL to make a gate appear green.

## Honest release states

- **SOURCE_TESTED:** code/CI/disposable PG17 passed; no owner acceptance asserted.
- **SCHEMA_VERIFIED:** exact target's installed migrations/RPC/privileges are independently checked; no business flow asserted.
- **OPERATIONAL_ACCEPTED:** actual authorized owner/customer record journey read back, same build and scope, two-tenant denial proven.
- **PROVIDER_VERIFIED:** separately authorized provider response and webhook/delivery evidence is recorded, not inferred.
- **RELEASE_READY:** all required gates for the intended scope are accepted and an operator signs off.

Current connected ServiceDesk workspace's operational records were previously measured as zero. These baseline counts are not evidence of a product defect alone; they explain why owner-generated real acceptance is still missing. Treat the product as **configuration/operational-evidence blocked** until independently verified.
