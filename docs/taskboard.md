# ServiceDesk AI V1 taskboard

Coordinator: dedicated GPT-5.6 Sol controller  
Integration branch: `feat/servicedesk-v1-integrate`  
Execution policy: GPT Runtime Machine only for development/checks. Connected GitHub access may be used for repository reads/writes when Runtime transport is blocked, but it is not executable test proof.

## Coordinator Cycle 1 — 2026-10-04

| Task | Owner | State | Worker base/head observed | Evidence | Next dependency |
| --- | --- | --- | --- | --- | --- |
| `CYCLE-1-W1` Core verification + operations seam | Worker 1 | READY | `4704a48eadd912f38ce9c981b583c9924bb62c79` | Packet published; no Cycle 1 receipt yet; coordinator Runtime DNS prevents independent execution | Worker Runtime gate → owned repairs → operations seam receipt |
| `CYCLE-1-W2` Connector Runtime gate + durable inbound processor | Worker 2 | READY | `3f1214cac4fdb4ebf0ac3128197d4e5c7d442a5a` | Current source preserves connector repairs; historical samvr PASS is not accepted under Runtime-only policy; no Cycle 1 receipt yet | GPT Runtime gate; if green, persist → idempotent processor → ACK |
| `CYCLE-1-W3` Product verification + request-intake boundary | Worker 3 | READY | `1345ed36455e415cc4acc7a0c9fb145866dc95bc` | Props-only DTO/fixture split exists; tests/build/browser remain unverified; no Cycle 1 receipt yet | Worker Runtime gate → owned repairs → receipt |
| Cycle 1 integration | Coordinator | BLOCKED | integration coordinator docs current | Coordinator GPT Runtime: `github.com` and `registry.npmjs.org` DNS resolution failed; no current typecheck/test/lint/build/browser gate executed | first worker receipt + reproducible GPT Runtime focused gate |

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
