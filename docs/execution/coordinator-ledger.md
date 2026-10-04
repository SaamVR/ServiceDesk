# ServiceDesk AI — Dedicated Coordinator Ledger

Date: 2026-10-04  
Coordinator branch: `feat/servicedesk-v1-integrate`  
Coordinator role: dedicated GPT-5.6 Sol planning/integration controller.  
Execution rule: GPT Runtime Machine only; no samai, samvr, SSH/local devices, self-hosted runners, or GitHub Actions without separate owner authorization.

## Governing sources read
Repository:
- `AGENTS.md`
- `docs/execution/coordinator-four-chat-20261004.md`
- `docs/execution/throughput-recovery-20261004.md`
- `docs/taskboard.md`
- `docs/contracts-v1.md`
- current lane ledgers/plans and current source needed for Cycle 1

Approved project artifacts:
- ServiceDesk AI Product Specification V2.0
- ServiceDesk AI V1 Implementation Plan

The approved scope remains a real V1 cleaning-operations product from enquiry through quote, scheduling, crew execution, payment and recurrence. PostgreSQL is business authority; provider/AI/UI layers do not grant authorization or mutate business truth directly.

## Latest reconciled branch heads before final Cycle 1 pin
| Ref | SHA | Coordinator ruling |
| --- | --- | --- |
| `feat/servicedesk-v1-integrate` | `71e0579869694bf6db8de5660e16f21df390a3e3` before Worker-2 packet revision | coordinator docs only beyond prior application state |
| `feat/servicedesk-v1-core` | `4704a48eadd912f38ce9c981b583c9924bb62c79` | no Cycle 1 receipt yet |
| `feat/servicedesk-v1-connectors` | `3f1214cac4fdb4ebf0ac3128197d4e5c7d442a5a` | legitimate newer connector repair/source must be preserved; historical samvr PASS is not accepted for current Runtime gate |
| `feat/servicedesk-v1-product` | `1345ed36455e415cc4acc7a0c9fb145866dc95bc` | no Cycle 1 receipt yet; current props-only work remains unverified |

No `docs/execution/receipts/` directory was present on any of the three worker branches at this reconciliation point.

## GPT Runtime failure observed by coordinator
The coordinator attempted a fresh Runtime checkout and package-manager recovery. Observed failures include:

```text
git clone / git ls-remote:
Could not resolve host: github.com

getent hosts github.com:
no result

getent hosts registry.npmjs.org:
no result

corepack prepare pnpm@10.17.1 --activate:
failed while requesting https://registry.npmjs.org/pnpm/-/pnpm-10.17.1.tgz

curl https://registry.npmjs.org/pnpm:
Could not resolve host: registry.npmjs.org
```

Runtime toolchain observed:
- Node `v22.16.0`
- npm `10.9.2`
- Corepack `0.32.0`
- global TypeScript available, but no usable project checkout/dependency tree/test runner

Therefore this coordinator pass executed no project typecheck, Vitest, lint, build, database reset, or browser proof. This is `CONFIGURATION_BLOCKED` execution evidence, not PASS.

## Fresh lane evidence inventory

### Worker 1 / Core
Current core work includes request/quote/capacity/visit/ledger-outbox-attention implementation and tests. The global/core historical taskboard records those features as implementation-rich but missing a current full Runtime gate and real DB reset proof.

Cycle 1 therefore prioritizes:
1. Runtime install/typecheck/domain/db verification;
2. repair only reproduced Core-owned failures;
3. operations repository idempotency/retry/attention seam hardening;
4. an exact receipt.

No later field/quality/subscription expansion is authorized in Cycle 1.

### Worker 2 / Connectors/AI
The connector branch moved after the initial packet draft to `3f1214cac4fdb4ebf0ac3128197d4e5c7d442a5a`.

Its lane ledger records a historical `samvr` run reporting:
- typecheck PASS;
- provider fixture suite PASS;
- AI fixture suite PASS;
after connector-owned repairs.

Because `docs/execution/coordinator-four-chat-20261004.md` now mandates GPT Runtime only, that local-device execution is not accepted as the current integration gate. The repaired source itself is legitimate and must not be discarded.

Current WhatsApp source inspection confirms:
- stable inbound `receiptKey`;
- normalization for text/media/unsupported;
- durable inbox store/persistence batch;
- durable provider handler that verifies, parses, persists and ACKs;
- no explicit idempotent processor handoff after persistence.

Worker-2 Cycle 1 was revised at integration commit `c5acbb9270a0a8cb6d0a3f466479d990eb087cb7` to:
1. re-prove current head in GPT Runtime;
2. repair only reproduced Worker-2 failures;
3. if green, add the idempotent inbound processor port;
4. compose persistence → processor → ACK;
5. run provider/AI regression and publish a receipt.

### Worker 3 / Product/UI
Product ledger records E01 and props-only E02 as authored but unverified:
- `RequestSummaryPreview` is DTO-driven;
- fixture ownership is isolated in the fixture wrapper;
- enquiry/request actions remain disabled preview state;
- no server wiring has been introduced;
- tests/build/browser proof were not executed because the prior Runtime had no checkout/pnpm/DNS.

Cycle 1 keeps server actions blocked until exact shared facade/read signatures are accepted.

## Cycle 1 canonical packets
| Worker | Packet path | Packet publication/revision commit | First task |
| --- | --- | --- | --- |
| Worker 1 Core | `docs/execution/batches/cycle-1-worker-1.md` | `ec8ca692b5cde4e535cb9e18a9f139660a73abc8` | `CYCLE-1-W1-T1` |
| Worker 2 Connectors/AI | `docs/execution/batches/cycle-1-worker-2.md` | `c5acbb9270a0a8cb6d0a3f466479d990eb087cb7` | `CYCLE-1-W2-T1` |
| Worker 3 Product/UI | `docs/execution/batches/cycle-1-worker-3.md` | `8cab090347c011845154287fd714d6892f5ab0d7` | `CYCLE-1-W3-T1` |

Workers must retrieve the packet at the final pinned integration ref supplied by the coordinator, not from an earlier moving branch snapshot.

## Coordinator decisions
1. No application lane is integrated yet. No Cycle 1 worker receipt exists, and this coordinator Runtime cannot execute the required review tests.
2. Existing worker source is preserved. No reset/rebase/force-push.
3. Worker 2 historical samvr evidence remains historical only and cannot satisfy the Runtime-only gate.
4. Missing live provider credentials do not block compilation/unit/provider-contract review. Missing executable compile/test proof does block accepted integration.
5. Worker 3 must keep fixture actions visibly disabled until accepted server signatures exist.
6. Worker 1 must finish the core verification/operations seam batch before later scope.
7. When any receipt arrives, review/integrate that worker immediately and issue its next batch without waiting for the other two.

## Ten-batch horizon candidates
Only Cycle 1 is frozen. Later candidates remain dependency-gated:
- Worker 1: C2 shared read/facade decisions; C3 payment ledger/outbox integration; C4 jobs/retry; C5 inbox/takeover storage; C6 field/crew; C7 recurrence; C8 invoice/quality/attention; C9 reports/billing; C10 release regression.
- Worker 2: C2 durable inbound completion; C3 outbound/status composition; C4 Google Calendar store/reconcile; C5 payment bridge; C6 email receipts; C7 AI guarded facade; C8 webhook/n8n retries; C9 controlled provider proof; C10 cross-provider closure.
- Worker 3: C2 server-backed request/quote after accepted signatures; C3 inbox/takeover UI; C4 quote approval/checkout UI; C5 portal/calendar; C6 crew checklist/evidence; C7 CRM/recurrence/preferences; C8 invoice/recovery/quality; C9 reports/settings/mobile; C10 tour/presentation/browser evidence.

## Receipt handling protocol
When a worker receipt arrives:
1. Refresh worker branch head and compare it to receipt final SHA.
2. Verify range and owned paths.
3. Review risky semantics from actual source.
4. Execute the focused gate in GPT Runtime.
5. If Runtime remains blocked, keep the candidate unaccepted and record exact failure.
6. If adequate executable proof exists, merge sequentially into integration, run combined checks as needed, record worker SHA → integration SHA, and push.
7. Immediately publish that worker's next source-derived packet; do not wait for the other workers unless a real shared dependency requires it.

## Current integration state
- Coordinator planning packets are durable on GitHub.
- No worker application range has been accepted or integrated in this Cycle 1 coordinator pass.
- No current Runtime PASS, provider proof, DB proof, build proof, or browser proof is claimed.


## Cycle 1 receipt reconciliation — 2026-10-04

All three Cycle 1 worker receipts were received and verified against their supplied final SHAs.

| Worker | Final SHA | Range from observed start | Application/source delta | Receipt state |
| --- | --- | --- | --- | --- |
| Worker 1 Core | `971225ef8f6fb1b93e26139fb66259373c6557f2` | 1 commit ahead of `4704a48eadd912f38ce9c981b583c9924bb62c79` | none; receipt only | `BLOCKED` |
| Worker 2 Connectors/AI | `a9fc2de46ce63b44b394718edc98e0dc07a4a354` | 1 commit ahead of `3f1214cac4fdb4ebf0ac3128197d4e5c7d442a5a` | none; receipt only | `BLOCKED` |
| Worker 3 Product/UI | `7857818c57634bb925549ea52fd380b031d426e1` | 1 commit ahead of `1345ed36455e415cc4acc7a0c9fb145866dc95bc` | none; receipt only | `BLOCKED` |

The only changed file in each worker range is its corresponding `docs/execution/receipts/worker-*-cycle-1.md`. No Cycle 1 application code, tests, migrations, provider code, or Product/UI source was produced.

Coordinator independently reproduced the shared GPT Runtime blocker after receipt arrival:

```text
git ls-remote https://github.com/SaamVR/ServiceDesk.git feat/servicedesk-v1-integrate
fatal: unable to access 'https://github.com/SaamVR/ServiceDesk.git/': Could not resolve host: github.com

corepack prepare pnpm@10.17.1 --activate
Internal Error: request to https://registry.npmjs.org/pnpm/-/pnpm-10.17.1.tgz failed

pnpm --version
command unavailable
```

Therefore the three receipts represent one shared infrastructure condition: `GPT_RUNTIME_GIT_DNS_AND_PACKAGE_MANAGER_BLOCKED`. They are not evidence of three independent code failures.

Coordinator rulings:
1. No worker application range is accepted or merged from Cycle 1 because there is no new application range to merge and no executable Runtime gate.
2. The three receipt documents are copied onto the integration branch as durable evidence.
3. Existing legitimate Core, Connectors/AI, and Product/UI source remains preserved on each worker branch.
4. Historical samvr proof remains non-qualifying for the current Runtime-only gate.
5. Cycle 2 is a recovery continuation: retry the Runtime gate from each latest worker head; only after it becomes executable may the deferred substantive slices continue.
6. Do not burn repeated worker cycles on identical DNS-only checks if the Runtime environment is unchanged. A fresh worker run may proceed only when it can at least establish source/package access or when a new Runtime instance is being tested for recovery.


## Cycle 2 recovery continuation packets

Published after Cycle 1 closeout:
- Worker 1 Core: `docs/execution/batches/cycle-2-worker-1.md` — publication commit `022316675987a2ee8c9c1ad5e745482c64755336`
- Worker 2 Connectors/AI: `docs/execution/batches/cycle-2-worker-2.md` — publication commit `466f36da3a133353875875f184793ce00288f15b`
- Worker 3 Product/UI: `docs/execution/batches/cycle-2-worker-3.md` — publication commit `7cfe0ae7d506d1c44a198cc0e1296682680a590a`

Cycle 2 is intentionally recovery-gated. If a fresh GPT Runtime can establish GitHub and npm access, each worker continues immediately into its deferred substantive work. If the same infrastructure failure persists, workers must not create untestable application changes; they perform the packet's bounded static readiness fallback and publish a receipt.


## Cycle 2 closeout and Runtime outage pivot

Cycle 2 receipts were received from all three workers:

| Worker | Cycle 2 final SHA | Result |
| --- | --- | --- |
| Worker 1 Core | `c8f6239db5062a6e7306de1c70686b3e0ac7dfd0` | `BLOCKED`; receipt-only; static operations map completed |
| Worker 2 Connectors/AI | `a43840d8e1f3d3da6ab0c212966bb2064de837a1` | `BLOCKED`; receipt-only; detailed WhatsApp implementation map completed |
| Worker 3 Product/UI | `739a60b9c170f97cc67137744e9aaf0927c2852d` | `BLOCKED`; receipt-only; Product route/view-model readiness map completed |

The same infrastructure failure persisted across two complete cycles. Repeating the same DNS/package-manager gate is no longer the default execution strategy.

### Outage-mode capability verified by coordinator

GPT Runtime still provides:
- Node 22;
- global TypeScript;
- global `ts-node`;
- writable `/mnt/data`.

Connected GitHub access can read exact branch files and recursive Git trees and can perform durable branch writes.

The coordinator executed package-free scratch harnesses in GPT Runtime and observed:
- `OFFLINE_CORE_HARNESS_PASS`;
- `OFFLINE_WHATSAPP_HARNESS_PASS`;
- corrected retry-safe WhatsApp design: `OFFLINE_WHATSAPP_RETRY_SAFE_PASS`;
- `OFFLINE_PRODUCT_REPORTING_HARNESS_PASS`.

The WhatsApp review found and corrected a material design flaw before implementation: processing only persistence-`INSERTED` records would lose downstream work after a processor failure because the provider retry would persist as `DUPLICATE` and could be falsely ACKed. Cycle 3 therefore requires an idempotent processor keyed by the existing durable `receiptKey` and processing of every durably persisted processable record, including provider duplicates.

### New governing outage document

`docs/execution/runtime-outage-mode-20261004.md`

Outage-mode Runtime harness proof may support `IMPLEMENTED` for bounded pure TypeScript logic. It does not independently support `CONTRACT_TESTED`, `PROVIDER_VERIFIED`, or `OPERATIONS_VERIFIED`. The canonical pnpm/Vitest/typecheck/build/browser gate remains `CONFIGURATION_BLOCKED` until normal source/package access returns.

## Cycle 3 packets

- Worker 1 Core: `docs/execution/batches/cycle-3-worker-1.md`
- Worker 2 Connectors/AI: `docs/execution/batches/cycle-3-worker-2.md`
- Worker 3 Product/UI: `docs/execution/batches/cycle-3-worker-3.md`

Cycle 3 is substantive outage-mode work, not another DNS-only recovery cycle.


## Cycle 3 partial reconciliation — Workers 1 and 3

Received and reviewed:
- Worker 1 Core final SHA `ef19a54e325d4e9ed9baa390a4316e097dbba923`
- Worker 3 Product/UI final SHA `caea4ba4bc7e7a3ebb1cedd30e25de044179542d`

Both reported `IMPLEMENTED` with canonical gate `CONFIGURATION_BLOCKED`.

Coordinator review:
- Worker 1 range is ownership-clean: only `tests/db/operations-commands.test.ts`, `tests/db/runtime-outage-operations-harness.ts`, and its receipt changed.
- Worker 3 range is ownership-clean: `src/features/reports/view-models.ts`, reporting canonical tests, Product outage harness, and its receipt changed.
- Coordinator independently executed Worker 1 operations semantics under Runtime ts-node: PASS.
- Coordinator independently executed the Worker 3 reporting truth-boundary behavior under Runtime ts-node: PASS.
- Canonical pnpm/Vitest/typecheck/lint/build/browser proof remains unavailable and therefore no `CONTRACT_TESTED`, `OPERATIONS_VERIFIED`, or browser/build claim is promoted.

### Canonical integration prerequisite finding

The canonical integration branch does not yet contain the historical Core/Product lane baseline files required by these Cycle 3 deltas. Copying only the Cycle 3 files would create incomplete/dangling source and test dependencies.

Therefore the bounded Cycle 3 implementations are accepted at lane proof level `IMPLEMENTED`, but are not copied piecemeal into canonical integration.

### Outage integration candidate

Created provisional branch:
`feat/servicedesk-v1-outage-candidate`

Candidate checkpoint:
`6d74ea7d74f87525df73bc72367c7084b77e86b3`

Construction:
- based on coordinator integration checkpoint `df20d4c0fb17b5e5ab7df59b6bd25bf7f7ce8d58`;
- overlays only Worker 1-owned Core paths from `ef19a54e325d4e9ed9baa390a4316e097dbba923`;
- overlays only Worker 3-owned Product/UI paths from `caea4ba4bc7e7a3ebb1cedd30e25de044179542d`;
- coordinator/shared contracts/package/deployment/docs paths are not taken from worker branches.

Key Cycle 3 blobs on the candidate were compared to worker final heads and match exactly.

This candidate is explicitly provisional/unverified. It is the place to reconcile lane baselines during the Runtime outage without falsely marking canonical integration as fully tested.

Worker 2 remains independent and was not blocked or rewritten by this reconciliation.


## Cycle 3 complete reconciliation

Worker 2 final receipt was subsequently published at:
`af47a5623232c96062a06323b884b35801f41f0b`

Coordinator ownership review from `a43840d8e1f3d3da6ab0c212966bb2064de837a1` to Worker 2 final head:
- only Worker-2-owned durable WhatsApp source, provider tests, outage harness, and receipt changed;
- no shared contracts, package files, shared barrels, Core, Product/UI, or coordinator docs changed.

Coordinator independently executed the retry-safe durable inbound semantics in GPT Runtime with ts-node:
`coordinator whatsapp retry-safe harness PASS`.

Worker 2 is accepted at outage proof level `IMPLEMENTED`.
Canonical provider/AI/typecheck gate remains `CONFIGURATION_BLOCKED`.
No `CONTRACT_TESTED` or `PROVIDER_VERIFIED` claim is made.

The provisional outage candidate was extended with the complete Worker-2-owned Connector/AI snapshot.

Current outage candidate checkpoint:
`f77f18ca2fe06a744398bcc4ba5dd6804d06b1e5`

The candidate now carries complete owned snapshots for:
- Worker 1 Core at Cycle 3 final;
- Worker 2 Connectors/AI at Cycle 3 final;
- Worker 3 Product/UI at Cycle 3 final;
while retaining coordinator-owned shared files from the integration branch.

This branch remains provisional and must pass the canonical catch-up gate before promotion.

## Cycle 4 dispatch

Published:
- Worker 1: `docs/execution/batches/cycle-4-worker-1.md` — DST-safe weekly recurrence.
- Worker 2: `docs/execution/batches/cycle-4-worker-2.md` — durable WhatsApp backend error-detail redaction.
- Worker 3: `docs/execution/batches/cycle-4-worker-3.md` — invoice progress/final-receipt truth hardening.

All three remain bounded Runtime Outage Mode slices and require only one quick normal network recovery probe before package-free execution.


## Cycle 3 integration — outage-mode IMPLEMENTED slices

All three Cycle 3 workers returned `STATE=IMPLEMENTED` with `CANONICAL_GATE=CONFIGURATION_BLOCKED`.

Coordinator reviewed the exact worker ranges and integrated only the minimal dependency closures exercised by the outage-mode harnesses. Whole historical worker branches were not merged.

| Worker | Worker final SHA | Accepted integration completion SHA | Proof ruling |
| --- | --- | --- | --- |
| Worker 1 Core | `ef19a54e325d4e9ed9baa390a4316e097dbba923` | `431abc17dfebdf3e5685f6f3acf84f6551de6dfa` | `IMPLEMENTED`; canonical Vitest/typecheck/DB gate still `CONFIGURATION_BLOCKED` |
| Worker 2 Connectors/AI | `af47a5623232c96062a06323b884b35801f41f0b` | `33fc991c095871dc935a821fee2cb90b03136001` | `IMPLEMENTED`; canonical provider/AI/typecheck gate still `CONFIGURATION_BLOCKED`; no `PROVIDER_VERIFIED` |
| Worker 3 Product/UI | `caea4ba4bc7e7a3ebb1cedd30e25de044179542d` | `b585ad94d73c0ac43a95edf8369bcf7e4c618d5c` | `IMPLEMENTED`; canonical Product/build/browser gate still `CONFIGURATION_BLOCKED` |

Blob-for-blob verification:
- Worker 1 integrated closure matched Worker 1 final evidence.
- Worker 2 integrated connector/handler/test closure matched Worker 2 final evidence.
- Worker 3 integrated pure view-model/test closure matched Worker 3 final evidence.

### Integrated Cycle 3 behavior

Worker 1:
- operations domain/repository seam added to integration;
- canonical regression cases for ledger idempotency, terminal outbox failure, attention idempotency and repository failure propagation;
- package-free outage harness.

Worker 2:
- durable WhatsApp inbox persistence record outcomes;
- idempotent inbound processor keyed by existing durable receipt identity;
- retry-safe persist → process → ACK composition;
- processor failure is retryable and not acknowledged;
- provider duplicate still reaches idempotent processor so failed processing can recover on retry;
- canonical provider tests + package-free outage harness.

Worker 3:
- pure request/operations/schedule/reporting view-model closure;
- reporting conversion bounded by supplied request truth;
- orphan visit request IDs cannot inflate conversion;
- duplicate visits cannot double-count request conversion;
- scheduled capacity still derives from supplied visit records;
- canonical regression cases + package-free outage harness.

No Cycle 3 slice is promoted to `CONTRACT_TESTED`, `PROVIDER_VERIFIED`, or `OPERATIONS_VERIFIED` while the canonical pnpm/Vitest/typecheck/build/browser stack remains unavailable.

## Cycle 4 source-derived targets

Published:
- `docs/execution/batches/cycle-4-worker-1.md` — Core capacity temporal/hold safety.
- `docs/execution/batches/cycle-4-worker-2.md` — WhatsApp delivery FAILED terminal-state monotonicity.
- `docs/execution/batches/cycle-4-worker-3.md` — Product checkout/invoice receipt truth boundaries.

Workers make one quick normal recovery probe and then use Runtime Outage Mode if the same infrastructure condition remains. Cycle 4 is substantive implementation work, not another DNS-only cycle.


## Cycle 4 integration and High-Throughput Mode v2

Cycle 4 worker finals:
- W1 Core: `6c062755a8d5f5e75051527a71687b98fa3070d7`
- W2 Connectors/AI: `cd702409b15ac659d2296aa3c5e00bdbacfe5f93`
- W3 Product/UI: `eeed52256937d520c37921228402e287b31e1c8e`

All three reported:
- `STATE=IMPLEMENTED`
- `CANONICAL_GATE=CONFIGURATION_BLOCKED`

Accepted integration commits:
- W1 Cycle 4 capacity temporal safety: `d3dac8e65366e491f5358eec5017fb5872ebf4b1`
- W2 Cycle 4 WhatsApp delivery-state monotonicity: `e73ea0778142d9fbe326fe1a5de68a2a1b79460c`
- W3 Cycle 4 payment receipt truth boundaries: `9154e5a0778c78480cabb81871c7f5ac773d0d88`

Tree-level blob verification after integration:
- W1 Cycle 4 accepted closure: MATCH
- W2 Cycle 4 accepted closure: MATCH
- W3 Cycle 4 accepted closure: MATCH

Proof remains `IMPLEMENTED`; no Cycle 4 slice is promoted beyond the outage-mode evidence level while the canonical package gate is unavailable.

### Throughput diagnosis

Cycles 3–4 proved the outage execution mechanism works, but throughput remained inefficient because each run carried only one narrow behavior cluster and repeated too much startup/receipt overhead.

Effective from Cycle 5:
- `docs/execution/high-throughput-mode-v2-20261004.md`
- `docs/execution/ten-run-horizon-cycle5-14.md`

New worker policy:
- workload sized for ~20–30 minutes active implementation when runtime/model permits;
- >=5 substantive slices before normal return;
- 5–8 READY slices + 2–4 FALLBACK slices;
- one recovery probe only;
- fast-start document set rather than rereading long coordinator packet;
- 2–3 grouped implementation commits + compact receipt;
- continue automatically into FALLBACK if READY finishes;
- receipt-only runs are not acceptable while owned package-free work exists.

New coordinator policy:
- no all-workers barrier;
- integrate any returned lane immediately;
- immediately promote that lane's preplanned backup;
- refresh and prepare the next backup from the 10-run horizon;
- use range compare + blob/tree integration rather than whole divergent branch merge.

### Active Cycle 5

- W1: `docs/execution/batches/cycle-5-worker-1.md`
  - request validation, visitor lifecycle authority, quote identity/expiry, visit scope/time integrity, combined harness.
- W2: `docs/execution/batches/cycle-5-worker-2.md`
  - acceptance conflict, outbound identity/content, template validation, media safety, queued/latest identity, combined harness.
- W3: `docs/execution/batches/cycle-5-worker-3.md`
  - quote approval truth, onboarding completeness, recovery readiness, connector proof, quality eligibility, communication provider truth, combined harness.

### Prepared Cycle 6 backup

- W1: `docs/execution/batches/cycle-6-worker-1.md` — repository trust boundaries.
- W2: `docs/execution/batches/cycle-6-worker-2.md` — WhatsApp transport/recovery hygiene.
- W3: `docs/execution/batches/cycle-6-worker-3.md` — Product cross-record/live-provider consistency.

Cycles 7–14 are queued thematically in the ten-run horizon and will be source-refreshed as each lane advances.


## V1 Integration Sprint 1 branch reset

To eliminate historical worker-branch divergence, three fresh worker branches were created from one combined RC base:

- base RC SHA: `714f24edfe7c6124237c7259a00ede7b288b68fb`
- Core: `feat/servicedesk-v1-core-sprint1`
- Connectors/AI: `feat/servicedesk-v1-connectors-sprint1`
- Product/UI: `feat/servicedesk-v1-product-sprint1`

This means each worker now sees the same current Core + Connector + Product source snapshot while ownership rules still restrict writes.

Sprint packets:
- `docs/execution/batches/v1-int1-worker-1.md`
- `docs/execution/batches/v1-int1-worker-2.md`
- `docs/execution/batches/v1-int1-worker-3.md`

This replaces Cycle 5 micro-hardening as the active path.


## V1-INT1 integrated into combined RC

Worker finals:
- W1 Core: `9fe8a66711821dd124517aabd5a0e036edd07add`
- W2 Provider/Core bridge: `1c9216201808b451495c91756b5d573a6655098f`
- W3 Product preparation: `cef509347845bb530ac9a064198fed19d868f77f`

Accepted RC integration commits:
- W1: `053124a24ad55786a79b1502ffb143834629455c`
- W2: `a760ba0c730241bc82d6bac0c82ecb8f02a5fc88`
- W3: `027b422b9106119325b118c2147b9d7a994bc12c`

Coordinator integration repairs:
- Product fixture wrapper call-sites after props refactor: `c2db94b0127ab7fa2f25de805bd933684f654368`
- visitor request lifecycle mutation blocked: `4630bd6330543c65e95257e3af70c40e183887d3`
- visitor lifecycle regression authored: `188ea8430072c0d7a3a6c3ac138be97ce748e6e9`
- provider failure detail redaction: `8a3cdadea354aa9c84c9cd49d62a68a8bd412baf`
- redaction regression authored: `8a5d9c8311d6a187ddfa17a81b30df91d957da7b`
- E03 verified-payment resource/outcome contract frozen: `35114c64b1400d9f68c49f5e0dbe98fefa167b0e`

Current combined RC:
- branch `rc/servicedesk-v1-unverified-20261004`
- HEAD `35114c64b1400d9f68c49f5e0dbe98fefa167b0e`
- evidence state remains UNVERIFIED_RC / outage-mode IMPLEMENTED slices.

Important E03 finding:
- Stripe-style checkout already emits workspaceId/quoteId/holdId/purpose metadata.
- previous webhook normalization discarded quoteId/holdId.
- Core cannot safely apply a booking payment without durable resource identity.
- shared `VerifiedPaymentEvent` now carries optional quoteId/holdId/invoiceId.
- shared Core application outcome is frozen as APPLIED | DUPLICATE | PAYMENT_REVIEW.
- current DB migrations contain no invoices/payment-application persistence, so Sprint 2 Core must add it.

Owner provider ruling:
- Stripe V1 is SANDBOX/DEMO ONLY.
- never wait for live Stripe credentials.
- remaining provider/infrastructure access must be requested just-in-time when the relevant integration is implementation-ready.
See `docs/execution/provider-access-policy-20261004.md`.

## V1-INT2 active

Fresh branches from RC `35114c64b1400d9f68c49f5e0dbe98fefa167b0e`:
- `feat/servicedesk-v1-core-sprint2`
- `feat/servicedesk-v1-connectors-sprint2`
- `feat/servicedesk-v1-product-sprint2`

Missions:
- W1: authoritative invoices/payment applications + atomic E03 Core transaction.
- W2: Stripe sandbox metadata/resource preservation + Core payment bridge.
- W3: remove central OperationalRoute fixture ownership + dependency-injected E02 server-action adapters.

Packets:
- `docs/execution/batches/v1-int2-worker-1.md`
- `docs/execution/batches/v1-int2-worker-2.md`
- `docs/execution/batches/v1-int2-worker-3.md`


## V1-INT2 integration status

Worker finals:
- W1 Core: `dfc79f780dd6489346e91ab7cf18fc3b898ef454`
- W2 Connector/payment bridge: `a6469074174b4a0dfef06f7fc5a510e86c8b1a61`
- W3 Product: `dae3150f9145b3acd2f69c27ada1dab1ba30221f`

W1 and W2 were reviewed and integrated into the combined RC:
- W1 RC integration: `0cffd0367ef53088604e7c5b027643b4b3573d4a`
- W2 RC integration: `4d5751d4b12bcd45719d7af0b660902cf5c759d6`

Coordinator E03 DB-readiness repairs:
- payment-review attention now links to persisted payment-application identity rather than a non-UUID composite string: `40c23c1bad3299444ab06bc8c4e8b8d0cf57cb19`
- invoice/payment target composite foreign keys + customer invoice read RLS: `7a24a2549ce22520e21eb269ef6e0d2fd3a37cee`
- migration regression coverage: `c67badf1bdca3e170724505e381390ba4f9f7fbb`
- outage harness attention-link assertion: `5f0d075b3ff7743a224aaeb196c3d07ddd544187`

W3 is NOT yet accepted/integrated.
Reason:
- no receipt;
- only first structural half completed;
- missing server action adapters/state mapping/harness/tests;
- partial OperationalRoute refactor regressed existing route-module presentation.

W3 recovery packet:
- `docs/execution/batches/v1-int2-worker-3-recovery.md`
- continue branch `feat/servicedesk-v1-product-sprint2`
- expected current head `dae3150f9145b3acd2f69c27ada1dab1ba30221f`

## Supabase staging gate reached

W1 reported:
`SUPABASE_STAGING_REQUIRED_FOR_E03_DB_PROOF`

Connected Supabase currently exposes:
- organization: `ECom CMS`
- existing projects: `Booking agent` and `CMS Project`

No ServiceDesk project exists.
Existing projects must not be repurposed.

A dedicated ServiceDesk staging project is now justified for:
- migrations 0001–0006;
- RLS;
- E03 transactional rollback/idempotency;
- E04 claim/lease/concurrency;
- later server-backed runtime proof.

Project creation requires explicit owner approval and cost confirmation before action.

## V1-INT3 active

Coordinator froze provider-neutral shared outbox execution contract:
- `src/contracts/outbox.ts`
- RC/shared base HEAD `b744bbba9c02904a5981e09c8d064face0de4a90`

Fresh lanes:
- Core: `feat/servicedesk-v1-core-sprint3`
- Connectors: `feat/servicedesk-v1-connectors-sprint3`

Packets:
- `docs/execution/batches/v1-int3-worker-1.md`
- `docs/execution/batches/v1-int3-worker-2.md`

Missions:
- W1 closes E04 durable outbox claim/lease/retry/terminal execution.
- W2 implements Connector execution adapter against frozen outbox port.
- W3 finishes INT2 Product server-boundary work and restores existing module coverage.


## V1-INT3 / Product recovery integration

Worker finals:
- W1 Core INT3: `2d6c52ad5ca988d68ec916635b91d7ef4d85226f`
- W2 Connector INT3: `56311e64454fda0776d8d8de7ed445d9936213f8`
- W3 Product INT2 recovery: `07c877e20f3f2181d2a107e2aa2a4faeeeac6674`

Accepted RC integration:
- W1 INT3 overlay: `bc09bf8b8c0295fbf92f6fc720dcfb5df178b8a0`
- W2 INT3 overlay: `74940c45bfcf220c819573f6290aeaf5e60ffdc8`
- W3 INT2 recovery overlay completed through `1e7b73fd6719a0e933021c465ade8351d049e396`

Proof remains outage-mode `IMPLEMENTED`; canonical pnpm/Vitest/typecheck remains `CONFIGURATION_BLOCKED`.

### E04 coordinator repairs

Integration review found two issues before treating E04 as database-ready:

1. Public-schema claim RPC used `SECURITY DEFINER`.
   - changed to `SECURITY INVOKER`;
   - execute revoked from public/anon/authenticated;
   - execute granted only to `service_role`.
   - repair: `3af954f4691505c99f2f4f864e160e5188b53cb1`

2. Lease-owner completion existed only as an abstract gateway convention.
   - added atomic `complete_outbox_event(...)` RPC guarded by `id + PENDING + locked_by`;
   - service-role only;
   - stale/non-owner worker updates zero rows;
   - follow-up migration: `a163591829ccb4b8215f76f8c05a988a06ad359d`
   - preserve attempt count on SENT: `1e722c06c8d628835612ef5088a6ff569c18cd81`
   - trusted Postgres RPC gateway: `31a2708b9e0b5d5c70e6c2c0e6da0e1bb6872629`
   - SENT gateway attempt preservation: `9134f37991c529a7d568ebedffc0d3691681a65d`
   - gateway regression authored: `df4f6ced0068bce792066f0977db8f12041fe052`

E04 source is now wireable; real Postgres claim/concurrency proof remains pending Supabase staging.

## E05 shared contract frozen

Coordinator added:
- durable `MessageDTO`;
- inbound provider message application input/outcome;
- human handover command;
- staff conversation reply command;
- conversationId snapshot query;
- conversations/messages in `WorkspaceSnapshot`.

Contract commits:
- MessageDTO: `cd3334d8a591e322db0675d03bcdc59766638146`
- facade imports: `c9585c404a71c508a4447dd3df88aa2ba1ce40f5`
- E05 command types: `d25a7b7ff41bf06a607799fa3d703320d57d8d9a`
- E05 snapshot/facade methods: `602e581c1df860480c230da893128c0d1b8ca395`

## V1-INT4 active

Common base:
`602e581c1df860480c230da893128c0d1b8ca395`

Branches:
- `feat/servicedesk-v1-core-sprint4`
- `feat/servicedesk-v1-connectors-sprint4`
- `feat/servicedesk-v1-product-sprint3`

Packets:
- `docs/execution/batches/v1-int4-worker-1.md`
- `docs/execution/batches/v1-int4-worker-2.md`
- `docs/execution/batches/v1-int4-worker-3.md`

Missions:
- W1: authoritative inbound conversation/message persistence, handover, staff reply enqueue, workspace/inbox snapshot.
- W2: durable WhatsApp provider receipt store + Core inbound bridge + CUSTOMER_REPLY dispatch intent.
- W3: props-driven inbox + snapshot/action adapters without losing existing Product route coverage.

Next roadmap target after E05:
E06 crew visit transitions + field evidence.


## Supabase ServiceDesk staging activated

Dedicated staging project:
- name: `ServiceDesk`
- project ref: `cpmmgivhlkfbiwzhlcey`
- region: `us-east-1`
- Postgres: `17.11`

Applied migrations through:
- `sd_0007a_supabase_security_hardening`

Durable proof packet:
- `docs/execution/supabase-staging-proof-20261004.md`

Real staging findings:
- fixed Postgres enum migration transaction defect in E04;
- hardened Supabase RPC/function policy scope;
- E03 schema/idempotency/accounting/cross-workspace FK proof PASS;
- E04 lease/reclaim/stale-owner/terminal-reclaim proof PASS;
- all proof fixtures cleaned after verification.

E03 remaining critical gap:
- `PaymentApplicationRepository.transaction(...)` has no concrete Postgres/Supabase adapter.
- next Core batch after active E05 should close this before E06 if E05 does not already consume the lane.

E04 source/DB semantics are staging-backed, but canonical app typecheck/Vitest/runtime Supabase client execution remains blocked by Runtime package access.


## E05 / E06 acceptance and Sprint 6 activation

Accepted worker finals:
- W1 Core E05 closure: `adc0384dfc751563dd89cd4ab05cf60408389b0b`
- W2 Connector E06 calendar bridge: `a2cf33cb0215cafe022757cde8924d0c6e8e7893`
- W3 Product E06 crew wiring: `e83ca9104f339c737ade47a099b8cd88e8e4b4c6`

Shared RC integrations:
- Core E05 overlay: `63dedfaa838bea1615d7c9f3171eaf608d5fd433`
- Connector E05/E06 overlay: `e185b6f9672c768aa6e6b056ebe76e871f49bd27`
- Product E05/E06 overlay: `6762d39de3c50db9ee8152ea2cb2a32618500621`

E05 real staging verification:
- migrations `sd_0008_conversation_inbox_runtime_int4b` and `sd_0009_e05_postgres_rpc_closure` applied to ServiceDesk staging `cpmmgivhlkfbiwzhlcey`;
- command RPCs exist as SECURITY INVOKER;
- anon/authenticated execute=false;
- service_role execute=true;
- W1 receipt records `E05_DB_PROOF=PASS` and fixture cleanup YES.

E06 Connector/Product:
- Calendar bridge implemented with ServiceDesk visit authority preserved;
- external provider edits remain review-only;
- crew Product transition wiring implemented for ASSIGNED->EN_ROUTE, EN_ROUTE->START, IN_PROGRESS->SUBMIT_REVIEW;
- persisted field evidence remains Core-owned and was not fabricated in Product.

E03 remaining durability issue:
- `public.servicedesk_apply_verified_payment(jsonb)` exists in staging;
- `src/server/core/payment-application-postgres.ts` exists;
- no repository migration currently defines that payment RPC;
- staging function is SECURITY DEFINER;
- Sprint 6 Core must capture/harden it as reproducible repository source before E03 is considered durable.

Coordinator froze E06/E07 shared contracts on RC:
- `VisitEvidenceDTO`
- `VisitChecklistItemDTO`
- `RecurrenceRuleDTO`
- `addVisitEvidence`
- `setVisitChecklistItem`
- `createRecurrenceRule`
- `applyRecurrenceRuleAction`

Current RC/shared base:
`612cd9ec1b2bbb0f8fc1d139989390e06dd543cf`

Sprint 6 branches:
- `feat/servicedesk-v1-core-sprint5`
- `feat/servicedesk-v1-connectors-sprint6`
- `feat/servicedesk-v1-product-sprint5`

Packets:
- `docs/execution/batches/v1-int6-worker-1.md`
- `docs/execution/batches/v1-int6-worker-2.md`
- `docs/execution/batches/v1-int6-worker-3.md`


## Sprint 6 accepted and integrated

Remote worker finals:
- W1 Core: `2077a5adf9c3b61a4bc2630a8e09f853a4588f28`
- W2 Connectors: `7c9342efd34f533ed37322e5d78d5d089376d95c`
- W3 Product: `65879d27be13452d12d67d0ae8fd0877945d15da`

RC integration:
- W1 INT6 overlay: `a8265df51e0921fa11501ce513abeda04371dcb0`
- W2 INT6 overlay: `d2c15790098aa88c2242f8f6825833a6dd02a730`
- W3 INT6 overlay completed through `4f1cc3dd1c9ce2703918db32236a8d4f34614658`

W1 staging evidence validated:
- `sd_0010_e03_verified_payment_rpc_int6` applied;
- `sd_0011_visit_field_runtime_int6` applied;
- E03 payment RPC is SECURITY INVOKER, anon/authenticated execute false, service_role execute true;
- E06 transition/evidence/checklist RPCs have the same restricted posture;
- visit_evidence and visit_checklist_items exist;
- worker receipt records E03_DB_PROOF=PASS and E06_DB_PROOF=PASS with fixture cleanup.

W2:
- E06 Calendar receipt restored;
- E07 recurrence provider automation implemented;
- no Google RRULE/series truth;
- visit reminders bridge implemented;
- live Google proof remains unclaimed/configuration-blocked.

W3:
- E07 recurrence Product boundary implemented;
- no client schedule truth;
- materialized occurrences remain VisitDTOs supplied by server;
- E06 evidence/checklist DTO compatibility added.

## Sprint 7 shared contract

Coordinator froze:
- `QualityCaseDTO`
- `ManualPaymentInput`
- `QualityCaseAction`
- `QualityCaseActionInput`
- `applyManualPayment`
- `applyQualityCaseAction`
- expanded `WorkspaceSnapshot` with recurrence/evidence/checklist/attention/quality arrays.

Shared RC/base:
`fa9568970c012550149a0093360e68bbdaa69e62`

Sprint 7 branches:
- `feat/servicedesk-v1-core-sprint6`
- `feat/servicedesk-v1-connectors-sprint7`
- `feat/servicedesk-v1-product-sprint6`

Packets:
- `docs/execution/batches/v1-int7-worker-1.md`
- `docs/execution/batches/v1-int7-worker-2.md`
- `docs/execution/batches/v1-int7-worker-3.md`


## Sprint 7 integration status

Worker finals:
- W1 Core recurrence: `e7e0a10f97f8810b3e612a0022609a6096b3f8ee`
- W2 Email/Webhook operational closure: `c682cbcd0ad6ea77766b6a1ec9171b072c9579c0`
- W3 Product E08 partial: `daf62783d46b3a453206535cfbe6ab0d4b604416`

Accepted RC integrations:
- W1 INT7 recurrence Core: `25cacb28dfddd17231b4ddda0b7549e2fb5e3a3b`
- W2 INT7 Email/Webhook: `a8711c1bffda3cd52cf9938f87ce8546ba7bef1d`

W1 live staging validation:
- `sd_0012_recurrence_runtime_int7` applied;
- `sd_0012a_recurrence_search_path_hardening_int7` applied;
- recurrence_occurrences exists;
- recurrence/create/action/materialize/snapshot RPCs are SECURITY INVOKER;
- anon/authenticated execute=false;
- service_role execute=true;
- receipt reports E07_DB_PROOF=PASS, RECURRENCE_CONCURRENCY=PASS, NO_PROVIDER_SCHEDULE_TRUTH=PASS, cleanup YES.

W2:
- authoritative Email intent/callback receipt bridge implemented;
- authoritative Webhook/n8n destination + operational receipt implemented;
- controlled proof gates reached:
  - EMAIL_PROVIDER_ACCESS_REQUIRED
  - N8N_WEBHOOK_ENDPOINT_REQUIRED
- no live/provider verification claimed.

W3 is NOT yet accepted as full E08 Product closure.
Useful durable work exists:
- invoice server boundary;
- quality action server boundary;
- expanded snapshot validator;
- outage harness.
Still incomplete:
- reusable QualityReviewPreview remains fixture-owned;
- reusable RecoveryActionsPreview remains fixture-owned;
- explicit fixture wrappers missing;
- route integration incomplete.
Recovery packet:
`docs/execution/batches/v1-int7-worker-3-recovery.md`

## Sprint 8 active

Shared accepted RC for W1/W2:
`a8711c1bffda3cd52cf9938f87ce8546ba7bef1d`

Branches:
- Core: `feat/servicedesk-v1-core-sprint7`
- Connectors: `feat/servicedesk-v1-connectors-sprint8`
- Product recovery continues: `feat/servicedesk-v1-product-sprint6`

Packets:
- `docs/execution/batches/v1-int8-worker-1.md`
- `docs/execution/batches/v1-int8-worker-2.md`
- `docs/execution/batches/v1-int7-worker-3-recovery.md`

Missions:
- W1: E08 manual-payment audit/invoice mutation + quality/attention lifecycle with real ServiceDesk staging proof.
- W2: E09 unified provider readiness/evidence closure; no new provider breadth.
- W3: finish E08 Product fixture-to-server boundary without regressions.


## Sprint 8 accepted / Sprint 9 active

Accepted worker finals:
- W1 Core E08: cceb81c0ed6d10590f987e9718e207f9ecdcc688
- W2 Provider readiness: 38b67acb3c70397e754877d251a60ae8f75b036a
- W3 Product E08 recovery: 54113ab8e0c693f3407b38c21047f9f6b19b7f3a

Live ServiceDesk staging validation:
- sd_0013_manual_payment_quality_runtime applied
- sd_0013a_quality_attention_fk_hardening applied
- manual payment / quality / snapshot RPCs are SECURITY INVOKER
- anon/authenticated execute false
- service_role execute true
- manual_payment_records and quality_cases exist
- W1 receipt reports MANUAL_PAYMENT_DB_PROOF=PASS, QUALITY_DB_PROOF=PASS, cleanup YES

W2:
- unified provider readiness/evidence model implemented
- controlled-proof manifest/rules implemented
- Stripe/payment remains sandbox-only by owner policy
- live provider evidence remains configuration-blocked

W3:
- E08 Product recovery accepted after source review
- reusable quality/recovery views no longer own fixture truth
- explicit fixture wrappers exist
- invoice/manual-payment/quality boundaries and route coverage preserved

Current combined RC:
cae7eb170b97208802065b76e20cbe9f9862c0cd

Coordinator-frozen E09 reads:
- ReportingSnapshotDTO / readReportingSnapshot
- PlatformBillingSnapshotDTO / readPlatformBillingSnapshot
- OwnerSettingsSnapshotDTO / readOwnerSettingsSnapshot
- ServiceSettingDTO aligned to persisted service_catalog (no invented rateVersion)

Sprint 9 branches:
- feat/servicedesk-v1-core-sprint8
- feat/servicedesk-v1-connectors-sprint9
- feat/servicedesk-v1-product-sprint7


## Sprint 9 accepted / Final E10 active

Accepted worker finals:
- W1 Core E09: 14009404b2e7e43dbce95350c43ea252de1b7794
- W2 Connector E10 preflight/evidence: da1a6e76c7f57b946396cb3b4ef133d57ba862ba
- W3 Product E09: b00d458fd77feabdc8ce8b3c8013f827b12519fa

Live ServiceDesk staging:
- sd_0014_reporting_platform_usage applied
- sd_0014a_conversation_reply_usage_gate applied
- platform_subscriptions, platform_subscription_ledger, workspace_usage_counters, workspace_usage_limits exist
- reporting/platform/usage proof recorded PASS by W1
- proof fixtures cleaned

Combined RC:
7dbf49e4e714b5f149d9efc083b8739d44eb3935

Final E10 branches:
- feat/servicedesk-v1-core-sprint9
- feat/servicedesk-v1-connectors-sprint10
- feat/servicedesk-v1-product-sprint8

Final objective:
- integrated DB/RLS/concurrency acceptance
- combined provider compatibility and controlled-proof packet
- final Product guided journey/browser acceptance preparation
- canonical package/build/browser/provider gates remain honestly separate.
