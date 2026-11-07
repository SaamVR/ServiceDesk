# SONIC 72-workflow reconciliation — execution waves and source reality

**Date:** 2026-10-25 · **Read-only audit of [#173](https://github.com/SaamVR/ServiceDesk/issues/173)** · **Control:** [#808](https://github.com/SaamVR/ServiceDesk/issues/808) · **Gap issue:** [#846](https://github.com/SaamVR/ServiceDesk/issues/846) · **Feature freeze:** [#816](https://github.com/SaamVR/ServiceDesk/issues/816). This document does **not** authorize any feature scope beyond approved Production P01–P12.

## Exactly 72 original workflow tasks: three distinct implementation states

| Original domain | Tasks | Identifiable canonical component | Partial source | No matching task-specific automation found |
|---|---:|---:|---:|---:|
| Inbound & lead intake | 1–10 | 1 | 5 | 4 |
| Estimates & quotes | 11–20 | 2 | 7 | 1 |
| Scheduling & dispatch | 21–30 | 3 | 5 | 2 |
| On-site execution & quality | 31–40 | 3 | 5 | 2 |
| Billing & collections | 41–50 | 3 | 7 | 0 |
| Aftercare & growth | 51–60 | 3 | 4 | 3 |
| Owner control, providers & AI | 61–72 | 8 | 3 | 1 |
| **TOTAL** | **72** | **23** | **36** | **13** |

**Scope of these labels:** `BUILT_COMPONENT` means a particular relevant canonical source module exists and is reviewed as a reusable building block; the *workflow outcome* is **not proven live**. `PARTIAL` means an adjacent source/preview/guard exists but the specified automated business result needs additional wiring/evidence. `MISSING_AUTOMATION` means this audit found no matching dedicated task-specific automation writer/trigger; it does not prove all business code is absent anywhere in the repository. Every one of the 72 records is `acceptedOperationalReceipt:false` and `liveAutonomousExecutionVerified:false`. No item in #173 has been checked by this audit.

**13 task-specific automation gaps to triage only after change control:** #4 duplicate lead merge review, #5 spam/abuse suppression, #7 property-to-branch routing, #10 unanswered lead SLA escalation, #18 quote-open reminder, #24 expired dispatch hold release, #27 crew dispatch notification, #31 crew check-in overdue escalation, #35 on-site add-on approval, #53 owner-approved review request, #54 complaint recovery case, #56 subscription renewal review, #67 RLS violation alert. Each needs a new explicit event source/action and idempotent, tenant-scoped saved receipt before it can be called delivered. Retain useful existing email/WhatsApp/outbox, crew, price, finance and retention modules; don't rebuild proven foundations.

**Canonical source and backlog provenance:** `ac78ff7737c95aa1b29b679d2b8ede57e5dfcae4`. The full row-by-row evidence and acceptance caveats live in:
- `72-workflows-lane-a-inbound-dispatch-20261025.json` (#1–30)
- `72-workflows-lane-b-field-finance-20261025.json` (#31–60)
- `72-workflows-lane-c-ops-ai-20261025.json` (#61–72)

`tests/ai/sonic-72-workflow-source-gap.test.ts` checks the **exact 72 labels** from issue #173 (FNV-1a of newline-joined original titles `a1c05903`), distinct IDs, current canonical source-path existence, mutually exclusive status classifications, 23/36/13 counts, no invented provider/tenant/operational success, and rejection of tampered records.

## Critical path — deadline-oriented, but no unsupported parallelism claims

| Wave | Outcome and why first | Disjoint Production lanes | Objective acceptance gates |
|---|---|---|---|
| 0 (immediate) | Preserve F08 feature freeze while producing actionable source audit and fixing P02 risk | Principal/release guardian, P02 auth/RLS, independent QA, Studio conflict investigator and finance inventory analyst (read-only) | #818 P02 first: owner-authorized 0065 security fix, controlled fictional OWNER A/B, authenticated readbacks and denial probes; no unsafe shared DB edits |
| 1 | Revenue critical: service catalog, branch price, inbound request → approved quote | Catalog/pricing, request/quote, owner UX, critic | #819–#820 real workspace price book, saved totals, quote acceptance with foreign-tenant/stale-version denial |
| 2 | Reliable automation and dispatch: transactional accepted-quote event, idempotent replay, crew slot → visit | Workflow journal/worker, dispatch/crew, calendar integrity, critic | #821/#199 atomic accepted-quote journal, duplicate/crash/backoff proofs; #822 confirmed crew assignment and QA saved evidence |
| 3 | Actual billing: invoice issued → sandbox payment proof → settled ledger | Invoicing/ledger, sandbox provider, exception QA | #823 valid invoice/provider receipt; no accidental charge/customer send/refund |
| 4 | Integration and owner AI value: frozen F08 selective merge, merged Studio UX, 1 controlled model call | P08 AI Studio UX, provider transport, source PR reconciliation, security critic | #824 only approved commercial key/gateway, bounded budget, real signed-in owner suggestion/readback; original 30 pinned feature blobs rechecked against newer canonical |
| 5 | Approved communication/operations: contact consent, Calendar, WhatsApp/email, quota vs real token-cost | P09 outbox provider, P10 monitoring/backup, consent/quiet-hours critic | #825 authenticated template/send callbacks; #826 actual provider-billing evidence or honest UNKNOWN; no auto-send from a draft |
| 6 | Two-tenant acceptance and sellable release | P11 Chrome/PG17/guardian, P12 release/rollback monitor | #827 two independent tenant full journeys, #828 owner go/no-go, monitored deploy + rollback; never skip gates |

**Only after separate approval to reopen feature scope:** Implement task-specific gaps in new isolated source PRs ordered by merchant consequence, beginning with critical lead-to-quote and operational reliability, then follow-up/retention monitoring. Source-only proposals are insufficient for LIVE. No automatic event/action expansion before authoritative source journals and transactional writer design. In particular, F06's four event proposals/four action previews are **not** shipped workflow contract types; original twelve new events/eight actions are not all implemented.

## Efficient multilane ownership (logical lanes until actual workers are independently launched)

- **LEAD/GUARDIAN:** compare canonical, original plan and current PR heads, protect freeze and merge/publish authority.
- **P02 SECURITY:** RLS, default-branch-function 0065 authorization/rollback, two fictional owners, negative tenant probes.
- **INGRESS:** inbound email/WhatsApp/webhook, dedupe/abuse and consent; no provider sends without approved sandbox.
- **QUOTE:** current branch catalog, rate-book, authorization and quote lifecycle (avoid hallucinated amounts).
- **WORKFLOW:** event journal, replay/lease, documented internal action writer, durable receipts.
- **DISPATCH/QC:** crew capacity/holds, calendar collision, photo/checklist and QA.
- **LEDGER:** sandbox charges/settlement, invoice and refunds with separate user approval.
- **MODEL/STUDIO:** current UI source, PR #631/#633/#645 conflicts, owned provider budget and cancellation.
- **CRITIC:** cross-tenant denial, prompt injection, hidden PII, replay duplication, mistaken `sent`/`paid` and genuine saved source proof.

Parallelize **only file-disjoint owner-scoped work that an actual execution worker is carrying out**; stop duplicating broad CI on every microchange. One exact-head combined test suite after a meaningful integration wave, plus PG17/Chrome/guardian and real saved business receipts where applicable. Record run SHA, PR, critical negative cases and blockers in [#808](https://github.com/SaamVR/ServiceDesk/issues/808); no fiction about runtime minutes, extra autonomous agents or full release completion.

## Exactly what this audit does NOT do

No source implementation or integration of a new event/writer, no F08 source freeze modification, no canonical merge, no Supabase migrations 0063–0065 or tenant writes, no paid model/provider call, no message to customers, no payment/refund, no Render staging/production deploy, no device deletion or shared dependency change. Any change to these requires the applicable separate owner/security authorization and Production release gate.
