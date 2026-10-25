# ServiceDesk V4 F08 — Frozen Feature Candidate and Production Merge Handoff

**Date:** 2026-10-25 · **Authority:** #808 · **F08 acceptance:** #816 · **Track:** Feature Chat, source-only. **Release operator:** Production Readiness Chat. This document is an immutable *candidate snapshot*, not permission to merge, run SQL, contact customers, deploy, or announce production readiness.

## 1. Freeze declaration

**FEATURE_FROZEN_SOURCE_ONLY.** F01–F07 have closed source-level task checklists and independently tested draft PRs. The F08 combined bundle includes only the exact previously reviewed additive files plus this handoff, a machine-readable Git-blob manifest and one cross-batch regression test. No new nonessential feature scope is authorized before P12. An unavoidable security/CI repair must be tracked as a Production-approved exception with a new exact SHA and review.

**Authoritative machine manifest:** [f08-feature-freeze-manifest-20261025.json](./f08-feature-freeze-manifest-20261025.json). The integration test `tests/ai/f08-feature-freeze-combined.test.ts` checks all 30 expected PR file contents against the exact pinned Git **blob SHA-1**, rejects overlapping paths and tests the fourteen exported source API entrypoints simultaneously.

**Canonical at freeze:** `f745c5990b51b5ab239c789a8c8bdbb383443223` on `feat/servicedesk-v4-reconciled-qa-shell-20261012`. This is the base for the F08 bundle, not `main`.

## 2. Exact draft PR pins and recommended merge order

| Order | Scope and acceptance | Issue | Source PR | Immutable PR head | Full source CI |
|---|---|---|---|---|---|
| 1 | F01 persisted intake + saved quote alternative proposals | #809 | #830 | `1d1c498e30273e3c0e9220f280afd6d86316eb0a` | #40159093206 success |
| 2 | F02 saved staff availability + visit quality review | #810 | #831 | `aa8137a84c3f8dad8184a94055f3b579d70e3266` | #40165151046 success |
| 3 | F03 ledger explanations + bounded daily/weekly review | #811 | #832 | `c7221e69762d62417cfc52b350a2077a8bafd09b` | #40166303775 success |
| 4 | F04 consent-checked human review drafts + retention clues | #812 | #833 | `4a4a5793c405ce3f28d5fbb1ee56e06e0495fac4` | #40167442234 success |
| 5 | F05 deterministic versioned rule drafting + safe what-if | #813 | #836 | `e9e46c4e1d027e752f39bd8d3725cec84d4f723a` | #40172245299 success |
| 6 | F06 four extra *proposed* events + four *preview-only* internal actions | #814 | #837 | `f541ca22f21b18f467f89ff16003e375d2735e9e` | #40177007376 success |
| 7 | F07 read-only workflow failure critic + honest AI_ACTIONS warning | #815 | #840 | `dd4db66183f467fab5ebe93e6c642f25cb532ff7` | #40179526525 success |

**Seven distinct sets of added files:** 4 + 4 + 4 + 4 + 4 + 5 + 5 = **30**. Diff inventory proved no candidate path exists in the current canonical tree; no duplicate PR candidate path or cross-lane ownership conflict. All seven source PRs were open/draft/unmerged at the freeze audit, and exact-head source/parity/critic checks returned success. This is *not* mergeability proof for old-base PRs: six reported `mergeable:false` at audit because GitHub branch merge state may be stale or conflicting. Use a fresh compare and Production's review gate. The F08 combined branch deliberately overlays **file blobs** (not undocumented assumptions or automatic non-fast-forward merges) on the latest checked canonical tree. It is a new *candidate*, never a canonical branch write.

**Production must choose exactly ONE path:**

- **Preferred one-wave verification:** audit and merge the F08 consolidated draft PR once after Production's exact-sha staging, tenant/security and release gates. Preserve provenance to original PR SHA/blob manifest and close original draft PRs only after confirming commits/diffs were integrated.
- **Alternative sequential:** integrate #830 → #831 → #832 → #833 → #836 → #837 → #840, rebasing/reconciling each against the latest canonical source without force pushing, retesting the cumulative result. Do **not** merge F08 again after these seven or duplicate its source files; cherry-pick only the final freeze docs/test if appropriate.

## 3. Frozen sellable-V1 capability inventory, source truth

| Source component | Implemented in F01–F07 | What a merchant can depend on **today** |
|---|---|---|
| Intake and pricing adviser | saved classification and branch quote option *suggestions* | **Not yet a sellable AI-booking flow** without catalog, branch pricing and scoped action wiring |
| Crew dispatch and visit QC | owner-readable saved crew capacity and quality checks | **Not authoritative dispatch**; no atomic crew holds, photographic completion proof or write-time slot certification |
| Finance and BI | saved exception descriptions and bounded historical trends | **Not billing reconciliation or exhaustive reporting**; full settled ledger and uncapped historical sources not proven |
| Inbox and retention | owner-only safe draft/retention plans, channel consent checks | **Not automated messaging**; actual recipient and consent/quiet-hour/opt-out must be rechecked transactionally |
| Rules authoring | deterministic limited instruction → internal-attention draft and shipped PREVIEW evaluator | **Not live AI rule publication**; saved rule version, code uniqueness and owner publish need atomic verification |
| Proposed automation expansion | four new typed event *proposals* and four internal action *previews* | **Not shipped LIVE event types/actions**, no journal/scheduler/execution writer or idempotency authority |
| AI critic and spend | saved action/replay failure warnings; AI_ACTIONS limit observation | **Not provider delivery proof or token billing**; no durable delivery receipts or model cost invoice |

No feature above may be labeled `PRODUCTION_VERIFIED`, `DELIVERED`, `PAID`, `AUTO_SENT`, `CHURN_PREDICTED` or `READY_FOR_SALE` merely because source CI passed. All source-only functions preserve human review and explicitly deny provider/send/money side effects. Reuse the mature existing underlying operations product; these are advisory additions, not a replacement for required V1 customer journeys.

## 4. Mandatory Product/Production interface and risk gates

1. **Permission and tenancy:** immutable current user identity, active workspace membership, correct branch scope and resource owner, all revalidated transactionally before mutations. Two fully separate staging tenants, including negative cross-tenant tests and proper RLS enforcement.
2. **Pricing:** real service catalog, branch price books, quoted totals/expiry and rule version checks. Existing canonical quote issue #765 cannot be considered operationally closed without owner/live A/B acceptance.
3. **Dispatch:** current staff/crew assignment, capacity concurrency, shift edges and hold/confirmation journal; capped 300 workspace read is not a transaction authority.
4. **Consent and messaging:** latest verified customer contact, channel-purpose consent, revocation/suppression, quiet hours, rate limits, outbox idempotency, provider delivery callback. No AI model may approve a send.
5. **Finance:** saved invoice settlement/ledger, provider proof, refunds and customer invoice vs platform subscription segregation. No fabricated revenue/spend.
6. **Automation publication:** versioned saved rule, unique rule code, atomic write-time version conflict checks, owner approval and plan limits. F06 extra event/action names remain outside published contracts until separately approved schema, journal and writer implementation.
7. **Failure/critic:** use signed/authorized saved provider delivery and outbox receipts for factual delivery. Replay lineage must be checked against durable idempotency keys, not F06/F07 review hashes.
8. **AI billing and consent:** `workspace_usage_counters.AI_ACTIONS` is a platform quota count, *not* provider tokens/monetary spend. Paid model calls, new token-cost ledger, provider spend and outbound customer contact require explicit owner approval and accurate provider evidence.
9. **Supabase:** production project migrations 0063–0065 not approved by source work. Use separately approved migration plan, backup/rollback, PG17 tests, owner evidence and tenant verification.
10. **P12:** domain, approved deployment, support/monitoring, privacy/security, billing, rollback and go/no-go evidence. Without these, mark RELEASE_BLOCKED and never imply the SaaS is live.

**Existing provider/SQL and staging state are not modified by F08.** Historical SAMAI originals and shared device data remain untouched. No force push, reset, credential rotation, payments, production or customer messages.

## 5. Combined regression and exact-head evidence required

On the **F08 integrated source PR HEAD**, Production and Feature reviewers must preserve:

```bash
pnpm install --frozen-lockfile
pnpm exec vitest run tests/ai/f01-*.test.ts tests/ai/f02-*.test.ts tests/ai/f03-*.test.ts tests/ai/f04-*.test.ts tests/ai/f05-*.test.ts tests/ai/f06-*.test.ts tests/ai/f07-*.test.ts tests/ai/f08-feature-freeze-combined.test.ts
pnpm typecheck
pnpm check:rc
```

The actual source RC workflow runs `pnpm check:rc` (test, typecheck, lint and Next build); cited CI, Git SHA and **negative-case** logs are acceptance receipts. The F08 test validates exact frozen Git blobs before computing unit results. Review merge-tree source parity and critic integrity at the same final SHA. A passing PR source CI is necessary but never sufficient for two-tenant staging, PostgreSQL 17 migration validation, provider UAT or deployment.

## 6. Coordination and stopping rule

Feature track closes only after F08 issue #816 has all acceptance checkboxes and exact F08 candidate SHA, source PR, source CI, parity, critic evidence, file ownership and no-side-effect receipt. Add one aggregate receipt to #808 with **NEXT_BATCH: Production readiness (remaining P queue)**. If Production changes canonical again, reconcile its commits **into the F08 feature candidate only**, preserve original frozen 30 blob SHAs, repeat all gates and never merge canonical from Feature Chat. If any source blob changes, do not silently rewrite the manifest; explicitly re-review the source change as a security exception, update the hash and re-run acceptance.

**Feature freeze status is not product release status.** Feature Chat is not authorized to reopen nonessential feature expansion while Production completes P01–P12.
