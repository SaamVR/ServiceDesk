# ServiceDesk AI V1 taskboard

Coordinator: dedicated GPT-5.6 Sol controller  
Integration branch: `feat/servicedesk-v1-integrate`  
Execution policy: GPT Runtime Machine only for development/checks. Connected GitHub access may be used for repository reads/writes when Runtime transport is blocked, but it is not executable test proof.

## Coordinator Cycle 1 — 2026-10-04

| Task | Owner | State | Worker base/head observed | Evidence | Next dependency |
| --- | --- | --- | --- | --- | --- |
| `CYCLE-1-W1` Core verification + operations seam | Worker 1 | BLOCKED | `971225ef8f6fb1b93e26139fb66259373c6557f2` | Receipt verified; receipt-only range; GPT Runtime DNS/package access blocked; no source/test delta | Cycle 2 Runtime recovery → deferred core gate/operations seam |
| `CYCLE-1-W2` Connector Runtime gate + durable inbound processor | Worker 2 | BLOCKED | `a9fc2de46ce63b44b394718edc98e0dc07a4a354` | Receipt verified; receipt-only range; no WhatsApp processor source started; historical samvr PASS still not accepted | Cycle 2 Runtime recovery; if green, persist → idempotent processor → ACK |
| `CYCLE-1-W3` Product verification + request-intake boundary | Worker 3 | BLOCKED | `7857818c57634bb925549ea52fd380b031d426e1` | Receipt verified; receipt-only range; static DTO/fixture audit complete; tests/build/browser still not executed | Cycle 2 Runtime recovery → Product verification |
| Cycle 1 integration | Coordinator | BLOCKED | receipts centralized on integration branch | All 3 receipt ranges verified as documentation-only; coordinator independently reproduced GitHub/npm DNS failure and missing pnpm | Runtime source/package access recovery; then executable lane gates |

Canonical packets:
- Worker 1: `docs/execution/batches/cycle-1-worker-1.md`
- Worker 2: `docs/execution/batches/cycle-1-worker-2.md`
- Worker 3: `docs/execution/batches/cycle-1-worker-3.md`
- Coordinator ledger: `docs/execution/coordinator-ledger.md`

Coordinator rule: review and integrate each completed worker batch independently, then publish that worker's next batch immediately without waiting for the other workers. Missing live provider credentials do not block compile/unit acceptance; missing executable compile/test evidence does.

## Historical product taskboard

| Task | Owner | State | Base SHA | Branch HEAD / historical checkpoint | Evidence | Next dependency |
| --- | --- | --- | --- | --- | --- | --- |
| 0.1 Scaffold + contract freeze | Core/controller | DONE | `56872ccbd7fbe6de043c35d9d8d37d32c4b726ac` | `dbf1f756d588925a694a4131672248ddb21a14e3` | Node 22 pin; pnpm lock; historical `tsc --noEmit` exit 0; domain/contracts 5/5 PASS; move-out $340/$85/$255 + 240/30 PASS | worker lanes started |
| 0.2 Design scaffold/story map | Product/UI | REVIEW | `dbf1f756d588925a694a4131672248ddb21a14e3` | current product branch contains substantial route/feature work | Current Cycle 1 build/browser gate not yet executed | Cycle 1 Worker 3 |
| 0.3 Provider boundary spike | Connectors/AI | REVIEW | `dbf1f756d588925a694a4131672248ddb21a14e3` | current connector branch contains provider/AI adapters and tests | Fixture/contract work exists; no current Runtime-only acceptance and no live-provider claim | Cycle 1 Worker 2 |
| 1.1 Tenancy/CRM/request | Core | REVIEW | `dbf1f756d588925a694a4131672248ddb21a14e3` | current core branch | Schema/RLS/auth/import/request implementation exists; current Runtime + DB reset proof still required | Cycle 1 Worker 1 |
| 1.2 Quote/approval | Core | ACTIVE | core lineage | current core branch | Quote domain/repository/facade/SQL proof files exist historically; current executable regression pending | Cycle 1 Worker 1 |
| 2.1 Capacity/visits/recurrence | Core | ACTIVE | later core lineage | current core branch | Capacity/visit implementation and tests exist historically; current executable/DB gate pending | Cycle 1 Worker 1 then recurrence |
| 2.2 Ledger/outbox/attention | Core | ACTIVE | later core lineage | current core branch | Repository command seam exists; persistence/retry/idempotency proof is Cycle 1 focus | Cycle 1 Worker 1 |
| 3.1 Field/quality/reporting | Core | READY | later gate | n/a | operations proof required | after Cycle 1/core dependencies |
| 3.4 Subscriptions/metrics | Core + Connectors | READY | later gate | n/a | tenant/idempotency proof required | core ledger + accepted shared contracts |
| 4.1 Integrated regression/ops | Coordinator | READY | Gate C | n/a | full Runtime regression/runbook required | all accepted lanes |

## Controller notes
- Repository: `SaamVR/ServiceDesk`.
- Contract/foundation SHA: `dbf1f756d588925a694a4131672248ddb21a14e3`.
- PostgreSQL remains business source of truth.
- Provider fixture tests can support `CONTRACT_TESTED`; controlled real receipts are required for `PROVIDER_VERIFIED`.
- Current coordinator Runtime limitation is explicitly recorded in `docs/execution/coordinator-ledger.md`; it must not be converted into PASS or bypassed with a local device.


## Cycle 1 closeout

- Worker 1 receipt: `971225ef8f6fb1b93e26139fb66259373c6557f2`
- Worker 2 receipt: `a9fc2de46ce63b44b394718edc98e0dc07a4a354`
- Worker 3 receipt: `7857818c57634bb925549ea52fd380b031d426e1`
- All three ranges are receipt-only.
- Shared blocker: `GPT_RUNTIME_GIT_DNS_AND_PACKAGE_MANAGER_BLOCKED`.
- No Cycle 1 application code was accepted into integration.
- Next execution is a Cycle 2 recovery continuation; substantive feature work resumes only after the relevant Runtime gate is executable.


## Coordinator Cycle 2 — recovery continuation

| Task | Owner | State | Start SHA | Packet | Execution rule |
| --- | --- | --- | --- | --- | --- |
| `CYCLE-2-W1` Core recovery + operations seam | Worker 1 | READY_RECOVERY | `971225ef8f6fb1b93e26139fb66259373c6557f2` | `docs/execution/batches/cycle-2-worker-1.md` | Runtime gate first; if green continue Core repairs + operations seam; if blocked static receipt only |
| `CYCLE-2-W2` Connector recovery + durable WhatsApp processor | Worker 2 | READY_RECOVERY | `a9fc2de46ce63b44b394718edc98e0dc07a4a354` | `docs/execution/batches/cycle-2-worker-2.md` | Runtime gate first; if green complete persist → processor → ACK + regression; if blocked static receipt only |
| `CYCLE-2-W3` Product recovery + executable/browser proof | Worker 3 | READY_RECOVERY | `7857818c57634bb925549ea52fd380b031d426e1` | `docs/execution/batches/cycle-2-worker-3.md` | Runtime gate first; if green test/typecheck/lint/build/browser; if blocked static receipt only |

Do not interpret `READY_RECOVERY` as executable proof. The last coordinator recheck still reproduced GitHub/npm DNS failure and unavailable pnpm. A fresh Runtime instance may retry; application edits remain gated by executable source/package access.


## Coordinator Cycle 3 — executable outage mode

Normal pnpm/Vitest/build execution remains `CONFIGURATION_BLOCKED`, but bounded package-free TypeScript implementation is now authorized under `docs/execution/runtime-outage-mode-20261004.md`.

| Task | Owner | State | Start SHA | Substantive target | Canonical gate |
| --- | --- | --- | --- | --- | --- |
| `CYCLE-3-W1` operations regression hardening | Worker 1 | READY | `c8f6239db5062a6e7306de1c70686b3e0ac7dfd0` | real ts-node harness + missing ledger/outbox/attention/error Vitest cases | `CONFIGURATION_BLOCKED` until pnpm returns |
| `CYCLE-3-W2` durable WhatsApp process/ACK seam | Worker 2 | READY | `a43840d8e1f3d3da6ab0c212966bb2064de837a1` | idempotent receipt-key processor, persistence record outcomes, retry-safe persist → process → ACK, tests + outage harness | `CONFIGURATION_BLOCKED`; no provider verification claim |
| `CYCLE-3-W3` Product pure view-model hardening | Worker 3 | READY | `739a60b9c170f97cc67137744e9aaf0927c2852d` | package-free Product harness + reporting conversion truth-boundary fix/regression | `CONFIGURATION_BLOCKED`; React/build/browser remain frozen |

Cycle 2 is closed as a shared Runtime infrastructure incident. Workers must make at most one quick network-recovery probe, then use outage mode rather than spend another run retrying DNS.


## Cycle 3 partial results

| Worker | Lane result | Final SHA | Coordinator outage recheck | Canonical integration |
| --- | --- | --- | --- | --- |
| Worker 1 Core | `IMPLEMENTED` | `ef19a54e325d4e9ed9baa390a4316e097dbba923` | PASS — operations ts-node semantics independently reproduced | staged on outage candidate; canonical package gate still blocked |
| Worker 3 Product/UI | `IMPLEMENTED` | `caea4ba4bc7e7a3ebb1cedd30e25de044179542d` | PASS — reporting truth-boundary independently reproduced | staged on outage candidate; canonical package/build/browser gate still blocked |
| Worker 2 Connectors/AI | IN PROGRESS / not reconciled in this partial closeout | current branch must be refreshed on receipt | not yet reviewed as completed Cycle 3 | independent |

Provisional integration branch:
`feat/servicedesk-v1-outage-candidate`

Checkpoint:
`6d74ea7d74f87525df73bc72367c7084b77e86b3`

Do not promote this candidate to canonical acceptance until catch-up testing is available.


## Cycle 3 final closeout

| Worker | Final SHA | Outage proof | Coordinator recheck | Candidate status |
| --- | --- | --- | --- | --- |
| Worker 1 Core | `ef19a54e325d4e9ed9baa390a4316e097dbba923` | `IMPLEMENTED` | PASS | staged |
| Worker 2 Connectors/AI | `af47a5623232c96062a06323b884b35801f41f0b` | `IMPLEMENTED` | PASS — retry-safe inbound processor independently exercised | staged |
| Worker 3 Product/UI | `caea4ba4bc7e7a3ebb1cedd30e25de044179542d` | `IMPLEMENTED` | PASS | staged |

Provisional integration candidate:
`feat/servicedesk-v1-outage-candidate`
at `f77f18ca2fe06a744398bcc4ba5dd6804d06b1e5`.

Canonical catch-up gate remains `CONFIGURATION_BLOCKED`.

## Coordinator Cycle 4 — executable outage mode

| Task | Owner | State | Start SHA | Target |
| --- | --- | --- | --- | --- |
| `CYCLE-4-W1` DST-safe recurrence | Worker 1 | READY | `ef19a54e325d4e9ed9baa390a4316e097dbba923` | preserve weekly local wall-clock across IANA timezone DST changes |
| `CYCLE-4-W2` WhatsApp error redaction | Worker 2 | READY | `af47a5623232c96062a06323b884b35801f41f0b` | prevent backend exception details leaking into provider-facing retry responses |
| `CYCLE-4-W3` invoice truth hardening | Worker 3 | READY | `caea4ba4bc7e7a3ebb1cedd30e25de044179542d` | clamp collection progress and guard final-receipt state |

All Cycle 4 tasks use the Runtime Outage Mode contract until normal pnpm/Git transport returns.


## Cycle 3 integration result

| Worker | Worker final | Integration completion | State | Canonical gate |
| --- | --- | --- | --- | --- |
| Worker 1 Core | `ef19a54e325d4e9ed9baa390a4316e097dbba923` | `431abc17dfebdf3e5685f6f3acf84f6551de6dfa` | `IMPLEMENTED` | `CONFIGURATION_BLOCKED` |
| Worker 2 Connectors/AI | `af47a5623232c96062a06323b884b35801f41f0b` | `33fc991c095871dc935a821fee2cb90b03136001` | `IMPLEMENTED` | `CONFIGURATION_BLOCKED` |
| Worker 3 Product/UI | `caea4ba4bc7e7a3ebb1cedd30e25de044179542d` | `b585ad94d73c0ac43a95edf8369bcf7e4c618d5c` | `IMPLEMENTED` | `CONFIGURATION_BLOCKED` |

Coordinator integrated only evidence-backed minimal closures. No whole worker branch was merged.

## Coordinator Cycle 4 — substantive outage-mode continuation

| Task | Owner | State | Start SHA | Target |
| --- | --- | --- | --- | --- |
| `CYCLE-4-W1` capacity temporal/hold safety | Worker 1 | READY | `ef19a54e325d4e9ed9baa390a4316e097dbba923` | exclude past/invalid capacity, reject invalid hold duration, fail closed on repository workspace mismatch, outage harness + regressions |
| `CYCLE-4-W2` WhatsApp delivery terminal failure | Worker 2 | READY | `af47a5623232c96062a06323b884b35801f41f0b` | make current FAILED terminal for same provider message, preserve duplicate/forward rules, batch/harness regressions |
| `CYCLE-4-W3` payment receipt truth boundaries | Worker 3 | READY | `caea4ba4bc7e7a3ebb1cedd30e25de044179542d` | fail-safe checkout receipt eligibility, clamp invoice progress, require coherent fully-paid final receipt, outage harness + regressions |

Packets:
- `docs/execution/batches/cycle-4-worker-1.md`
- `docs/execution/batches/cycle-4-worker-2.md`
- `docs/execution/batches/cycle-4-worker-3.md`

Canonical pnpm/Vitest/typecheck/build/browser proof remains `CONFIGURATION_BLOCKED`. Workers perform one quick recovery probe only, then continue under `docs/execution/runtime-outage-mode-20261004.md` when normal package access remains unavailable.


## High-Throughput Mode v2 — Active from Cycle 5

Coordinator model: GPT-5.6 Sol High
Worker model: GPT-5.5 High

Cycle 4 is integrated as `IMPLEMENTED` for all three lanes. Canonical package/test/build proof remains `CONFIGURATION_BLOCKED`.

### Active long-run batches

| Lane | Active | Start SHA | Minimum normal completion | Backup already prepared |
| --- | --- | --- | --- | --- |
| Core | `CYCLE-5-W1` | `6c062755a8d5f5e75051527a71687b98fa3070d7` | >=5 substantive slices or all READY/FALLBACK exhausted | `CYCLE-6-W1` |
| Connectors/AI | `CYCLE-5-W2` | `cd702409b15ac659d2296aa3c5e00bdbacfe5f93` | >=5 substantive slices or all READY/FALLBACK exhausted | `CYCLE-6-W2` |
| Product/UI | `CYCLE-5-W3` | `eeed52256937d520c37921228402e287b31e1c8e` | >=5 substantive slices or all READY/FALLBACK exhausted | `CYCLE-6-W3` |

Active packets:
- `docs/execution/batches/cycle-5-worker-1.md`
- `docs/execution/batches/cycle-5-worker-2.md`
- `docs/execution/batches/cycle-5-worker-3.md`

Prepared backups:
- `docs/execution/batches/cycle-6-worker-1.md`
- `docs/execution/batches/cycle-6-worker-2.md`
- `docs/execution/batches/cycle-6-worker-3.md`

Governing throughput docs:
- `docs/execution/high-throughput-mode-v2-20261004.md`
- `docs/execution/ten-run-horizon-cycle5-14.md`

### No-barrier coordinator rule

When any worker returns:
1. review that lane immediately;
2. integrate accepted range immediately;
3. do not wait for the other workers;
4. activate that lane's Cycle 6 backup immediately;
5. prepare the next backup from the horizon before returning the next prompt.

### Efficiency rule

A worker returning after one narrow implementation slice is incomplete unless:
- every remaining READY/FALLBACK task is complete, or
- one genuine blocker prevents all remaining owned work.

Receipt-only or DNS-only runs are not accepted while package-free owned work exists.


## V1 integration sprint pivot

High-throughput Cycle 5 micro-hardening packets are PAUSED as primary work. They remain useful regression backlog but are no longer the critical path.

New RC candidate:
- `rc/servicedesk-v1-unverified-20261004`
- HEAD `fb222d26132897561ae2eed3d6f5aa91475bf591`
- state: `IMPLEMENTED_UNVERIFIED_RC`

Coordinator source:
- `docs/execution/v1-integration-sprint-20261004.md`

Critical path now:
1. `V1-INT-1` full RC static compatibility/shared-contract audit.
2. `V1-INT-2` Core E02 server composition.
3. `V1-INT-3` atomic verified payment core transaction boundary.
4. `V1-INT-4` durable outbox claim/lease/retry worker.
5. `V1-INT-5` inbox persistence/handover/read model.
6. `V1-INT-6` crew transitions + field evidence.
7. `V1-INT-7` recurrence persistence/commands.
8. `V1-INT-8` invoice/manual payment + quality/attention lifecycle.
9. `V1-INT-9` reporting/admin/settings/platform billing/usage.
10. `V1-INT-10` full regression/DB/provider/browser/operations closure.

Primary efficiency rule:
Existing broad provider/UI source should be integrated/wired before more feature-family expansion or isolated edge-case hardening.


## V1 Integration Sprint 1 — active

Combined RC base:
- `rc/servicedesk-v1-unverified-20261004`
- coordinator-approved base SHA: `714f24edfe7c6124237c7259a00ede7b288b68fb`
- includes approved `PropertyDTO`.

Fresh sprint branches created from the exact same RC base:
- Worker 1 Core: `feat/servicedesk-v1-core-sprint1`
- Worker 2 Connectors/AI: `feat/servicedesk-v1-connectors-sprint1`
- Worker 3 Product/UI: `feat/servicedesk-v1-product-sprint1`

Active packets:
- `docs/execution/batches/v1-int1-worker-1.md`
- `docs/execution/batches/v1-int1-worker-2.md`
- `docs/execution/batches/v1-int1-worker-3.md`

Primary goals:
- W1 closes E02 authoritative request/property/quote/capacity server composition.
- W2 prepares provider-neutral Core bridge surfaces for E03/E04/E05 instead of expanding provider breadth.
- W3 removes fixture ownership from existing reusable Product surfaces and prepares exact server wiring boundaries.

Old Cycle 5 micro-hardening remains backlog only and is not the critical path.

No all-workers barrier: integrate each sprint branch immediately on return and issue its next capability batch independently.
