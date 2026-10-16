# ServiceDesk V4 R7 — Independent Critic Wave Acceptance
Date: 2026-10-16. Reviewer lane: D / separate `qa/v4-r7-critic-practical-acceptance-20261016` branch. This is an independently scoped QA workstream executed in the same conversation, **not evidence of a second human or autonomous agent**.

## Four-lane execution ledger
| Lane | PR / exact source | Intended business behavior | Critic evidence | Verdict |
|---|---|---|---|---|
| A Product | [#492](https://github.com/SaamVR/ServiceDesk/pull/492), initial `b72d8cb...`, corrected `a532aea5...` | A saved SENT/APPROVED quote must not count complete when validity is missing, corrupt or elapsed; ACCEPTED remains accepted | Exact initial CI failed (1/2892 tests; stale-unverified priority expectation); source correction prioritizes corrupt financial proof ahead of expiry. Runtime `validUntil` readback is sourced from `quotes.valid_until`; deterministic negative tests check boundary. | REVIEW — exact corrected-head CI pending |
| B Core | [#493](https://github.com/SaamVR/ServiceDesk/pull/493), `16e538fb...` | Staff handover RPC success must match actual saved active state, default assignee and deactivation clearing | Read-only connected SQL function definition confirms nested `conversation` JSON, literal boolean, implicit calling-staff assignment on activation and NULL on deactivation. Critic identified extra omitted default-assignee risk; author corrected before acceptance, noted in PR comment. | REVIEW — exact corrected-head CI pending; real signed-in write/readback BLOCKED |
| C AI | [#494](https://github.com/SaamVR/ServiceDesk/pull/494), `9dd4fa86...` | Human-reviewed AI quote checklist must not invent completed sends, approvals, bookings or charges | Adversarial first-person/passive text tests, safe advisory positive controls, full exact PR-head CI [38917566402](https://github.com/SaamVR/ServiceDesk/actions/runs/38917566402) SUCCESS, source integrated via `8ce13f8df5ad1a640160fd65bb3e127481f48e99`. | CONTRACT_TESTED — source PASS, live paid model not verified |
| D Critic | this report + PR comments | Discover defects early, challenge source claims against actual database contracts, feed fixes to workers | B database function read-only check, A initial CI failure analysis, C independent source acceptance comment | INTEGRATED REVIEW WORK; not independent real-user UAT |

## Practical effectiveness and business release vetoes
Current connected Supabase staging has no approved owner-entered service catalog or branch price books, no quotes/invoices, no completed workflow actions, and no authenticated two-tenant acceptance. A real quote lifecycle cannot be marked fully operational in this environment. Migration 0063 remains uninstalled and not authorized for application. Source builds and disposable PG17 CI cannot prove real email/WhatsApp sends or live model quality. Render review last observed LIVE SHA `5b876a7a806b5b63eca8e1b9396a3a7509240ec6`, older than R6 review branch; do not claim latest code live without exact `/health.sourceSha` proof and safe guest/authenticated Chrome evidence.

## Critic-directed corrections
- A: prevent a valid saved SENT status and reconciled monetary lines from implying a customer-actionable quote when `valid_until` is missing or expired. Never downgrade a corrupt ledger to a mere expiry warning; preserve both fail-closed states. Verify positive ACCEPTED history does not regress.
- B: **do not trust the RPC success envelope alone**. Installed SQL `servicedesk_set_conversation_handover` auto-selects `actorUserId` when active and assignee omitted, and clears it when inactive. Require exact readback including these implicit semantics. An independent signed-in two-owner negative test remains needed.
- C: block assertions like 'we already sent the quote' and 'the offer has been delivered' while retaining staff review instructions. Do not confuse quality-review text with provider delivery.

## Throughput and operational process
Three disjoint code areas allow integration without shared-file races: A `src/features/operations/cleaning-request-next-steps.ts` and test; B `src/server/core/conversation-postgres.ts` and test; C `src/server/ai/quote-review-safety.ts` and test. Critic owns documentation and PR findings. Focused tests and exact-head CI are necessary; no assertion is made that three separate agents ran simultaneously or that full PR CI provides authenticated UAT. Keep older overlapping PRs (e.g., #375) off canonical unless exact file-level reconciliation protects newer behavior.

## Release sign-off matrix (as of this wave)
- IMPLEMENTED/source: C merged; A/B candidates.
- CONTRACT_TESTED: C verified exact-head source; A/B need corrected-head results.
- OPERATIONS_VERIFIED: **BLOCKED** for merchant quote/handover and AI real session.
- PROVIDER_VERIFIED: **BLOCKED**, no live provider evidence.
- COMMERCIAL_READY: **BLOCKED**.
- No production `main`, Render manual deploy, migration 0063, provider sends, customer data or paid AI actions authorized by this report.

Every unresolved finding remains OPEN until a linked exact-head test or separately authorized real-world receipt closes it. 