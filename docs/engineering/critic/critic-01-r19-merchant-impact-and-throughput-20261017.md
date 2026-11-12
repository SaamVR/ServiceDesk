# CRITIC-01 R19 — independent product and integration audit

**Review mode:** independent adversarial *lane within this ChatGPT turn*, not another human, chat, model, live customer, or autonomous subagent. The reviewer did **not** author production files in R19A/B/C/D. This document is an assessment and action gate, not a test receipt.
**Pinned audit base:** `995277b13f55f8bec705418fb690d36d4e43f5c5`, full source RC [#39017242941](https://github.com/SaamVR/ServiceDesk/actions/runs/39017242941) PASS and PG17 [#39017242952](https://github.com/SaamVR/ServiceDesk/actions/runs/39017242952) PASS **for that historical SHA only**. During execution the canonical advanced independently to `68db47b10bc4c909b6e7d08134f37d6c156fa64e` with recurrence, outbox chronology and critic fixes; source paths do not overlap R19. Recheck HEAD before integration.

## Evidence gates, independent of author optimism

| Lane | Source/PR | Merchant failure prevented | Adversarial proof required | Critic verdict prior to completed exact-head checks |
| --- | --- | --- | --- | --- |
| Core R19A | [#596](https://github.com/SaamVR/ServiceDesk/pull/596) | A padded/synthetic-alias rate version or whitespace-normalized persisted currency could be treated as an approved owner denomination. | Invalid version/currency and branch mismatch fail before price-card selection; positive persisted USD/GBP and exact owner version retained; exact source CI + quote gate. | **REVIEW** (implemented, not merchant priced). |
| AI R19B | [#597](https://github.com/SaamVR/ServiceDesk/pull/597) | Owner AI can generate plausible operational priorities from host-local or impossible persisted snapshot clocks. | Two snapshot reads, timezone/civil validity, 30-minute source freshness and 5-minute future skew; AI stays OFF absent explicit opt-in; no tools/model/provider sends in tests. | **REVIEW** (clock contract only, no model or human efficacy evidence). |
| Product R19C | [#598](https://github.com/SaamVR/ServiceDesk/pull/598) | Inbox could show duplicate provider receipts as separate healthy deliveries or accept an impossible timestamp. | Duplicate message ID refused, offsets `+14:01`/year zero/invalid dates denied, legitimate microsecond/offset receipts accepted; read-only GET, no retry controls or provider sends. | **REVIEW** (synthetic staff triage only, not real delivery). |
| Connectors R19D | [#599](https://github.com/SaamVR/ServiceDesk/pull/599) | Recovered outbox template or freeform text may be a forged object, bidi-spoofed, or unbounded string which escapes type checks before provider dispatch. | Validate before any provider call, zero dispatcher invocations for invalid intent, legitimate multiline text/template remains allowed; failure is terminal and auditable. | **REVIEW** (provider mocked; no actual external delivery). |

**Independent residual review / veto criteria:**
- R19D text guard must also cover U+200B–U+200F, U+2060–U+206F and U+FEFF; a malformed payload must never be promoted to a provider call. If current PR omits these, request a focused corrective commit and rerun that PR head. Avoid diluting the guard to make a test green.
- R19A cannot repair absent tenant price-book prerequisites by parsing more string variants: source fail-closed is useful but not the saleable quote journey.
- R19C makes inconsistent provider evidence unavailable instead of showing a false success. User-facing error/retry affordance needs separate manual browser review; no customer delivery inferred.
- CI parity/prose lint passing is **not** Vitest/full-source/PG17 evidence. Require actual exact PR-head test logs and one pinned post-integration full RC + PG17; do not treat cancelled predecessor runs as successful.
- No independent authenticated cross-tenant / two-owner database write, accepted quote journal, invoice persistence or post-order attention artifact exists at current connected tenant state. Hold `OPERATIONS_VERIFIED`.

## Read-only merchant and infrastructure facts

- Connected project `cpmmgivhlkfbiwzhlcey` reports **69 listed migrations**, latest `sd_0062_v4_branch_trigger_rowtype_guard`; no `0063` applied. This is live metadata, not approval to migrate.
- Supabase public table metadata reports **1 workspace, 1 membership, 1 branch, 0 service_catalog, 0 rate_cards, 0 branch_price_books, 0 quotes, 0 invoices, 0 outbox_events**. Table row estimates/metadata are not an authenticated UAT.
- Isolated Render service `srv-db5p1s142hec739noohg` reports **LIVE** R13 pinned commit `3962aa5c84c3aa5f47ad72b62d51ae4382467708`, auto-deploy OFF. Neither R19 changes nor current canonical were deployed.
- Security issue #153 and real merchant acceptance #487 remain OPEN; neither a disposable PG17 run nor source-level quote fixtures discharges them.

## Practical acceptance plan (explicit authorization required)

1. Two independent authorized fictional owners in separate workspaces sign in using real authentication, confirm tenant separation and negative cross-workspace reads/writes.
2. Owner creates a USD branch/service, active bounded rate card and unique current price book, then staff creates a saved request and persists a calculated quote without synthetic rates.
3. Staff approves and intentionally sends the quote (provider dispatch disabled or explicitly sandboxed); separate authenticated fictional customer ACCEPTS. Assert saved version, consent, acceptance and any triggered internal attention against authoritative Postgres.
4. Inspect invoice creation and ledger persistence against the accepted quote, with retry/replay and cross-tenant denial; no charge, refund or real customer message.
5. Record exact source SHA, nonprod deployment URL/SHA, migration ledger, redacted DB evidence and rollback. If staging/write authorization is absent, mark `CONFIGURATION_BLOCKED`, never fabricate UAT PASS.

## Throughput and development-workflow correction

- Four source branches have **eight mutually exclusive paths**, all based on the same pinned SHA. One bounded source/test commit per lane. This prevents conflicts but is *not* proof of four autonomous engineers.
- During this cycle canonical advanced by five unrelated commits while R19 PRs were authored. The control tower must pin the exact new integration SHA, compare all four PR ranges, and integrate **once** rather than restart full canonical checks on every review note.
- PR-specific source/full checks are executing under GitHub; do not trigger redundant manual full builds or duplicate PG17 runs. PG17 is required for a candidate release but not for every independent documentation-only critic PR.
- A docs-only critic change is a review receipt; keep it on a separate DRAFT PR so full source CI need not be paid for prose. Before merging, require focused negative tests and measured full source checks at exact source SHAs.
- Track real operator capability unblocked (zero without an authorized two-owner merchant chain), defects detected before send/charge, full CI pass per candidate, cancellations from premature canonical pushes, and runner minutes spent on duplicate checks. Raw commit count, number of “lanes” and synthetic green screenshots are not throughput.
- Independent reviewer will withhold acceptance on any PR-head CI failure, unreviewed newer canonical conflicts, disabled AI/provider safety bypass or unproven merchant completion. **Release: CONFIGURATION_BLOCKED** until authorized two-owner UAT, PG17 parity, security and signed review.

**Next critic action:** inspect the exact PR-head logs; record pass/fail/cancelled separately. Comment on development PRs with actionable corrections and maintain release hold. Never self-approve the production deploy or owner-only database actions.
