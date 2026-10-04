# ServiceDesk AI V1 taskboard

Controller: Chat 1 · Integration branch: `feat/servicedesk-v1-integrate`

| Task | Owner | State | Base SHA | Branch HEAD | Evidence | Next dependency |
| --- | --- | --- | --- | --- | --- | --- |
| 0.1 Scaffold + contract freeze | Chat 1 | DONE | `56872ccbd7fbe6de043c35d9d8d37d32c4b726ac` | `dbf1f756d588925a694a4131672248ddb21a14e3` | Node 22 pin; pnpm lock; `tsc --noEmit` exit 0; domain/contracts 5/5 PASS; move-out $340/$85/$255 + 240/30 PASS | worker lanes may start |
| 0.2 Design scaffold/story map | Chat 3 | READY | `dbf1f756d588925a694a4131672248ddb21a14e3` | `dbf1f756d588925a694a4131672248ddb21a14e3` | branch fast-forwarded to contract freeze; no worker commit observed | Chat 3 implementation |
| 0.3 Provider boundary spike | Chat 2 | READY | `dbf1f756d588925a694a4131672248ddb21a14e3` | `dbf1f756d588925a694a4131672248ddb21a14e3` | branch fast-forwarded to contract freeze; no worker commit observed | Chat 2 implementation |
| 1.1 Tenancy/CRM/request | Chat 1 | REVIEW | `dbf1f756d588925a694a4131672248ddb21a14e3` | `bfeb34f72540770acb27d88c3228cb867437691f` | Schema/RLS/auth guard/customer import/request command slices implemented; SQL cross-tenant proof added; request repository + persistence adapter added; local disconnected semantic review only because Runtime has no package install/network | SQL/Supabase reset proof before DONE |
| 1.2 Quote/approval | Chat 1 | ACTIVE | `bfeb34f72540770acb27d88c3228cb867437691f` | `4d8dfd476ac6eeaf64749c2565f813f14e4d725b` | RED quote/approval domain test `ac032563...`; GREEN quote catalog `93fe28d...`; GREEN approval guard `094eca8...`; quote schema migration `a39efcd...`; RED quote command seam `e510ada...`; GREEN command seam `0e522d...`; RED quote repository adapter `11326a4...`; GREEN quote adapter `4d8dfd...`; full suite not rerun in this runtime | run tests/typecheck/db reset when available; wire facade or add SQL-backed quote proof |
| 2.1 Capacity/visits/recurrence | Chat 1 | READY | Gate A | n/a | last-slot race/DST tests required | Gate A |
| 2.2 Ledger/outbox/attention | Chat 1 | READY | later gate | n/a | idempotency/restart tests required | 2.1 schema |
| 3.1 Field/quality/reporting | Chat 1 | READY | later gate | n/a | operations tests required | Gate B |
| 3.4 Subscriptions/metrics | Chat 1 + 2 | READY | later gate | n/a | tenant/idempotency tests required | core ledger |
| 4.1 Integrated regression/ops | Chat 1 | READY | Gate C | n/a | full regression/runbook | all lanes |

## Controller notes

- Remote repository: `https://github.com/SaamVR/ServiceDesk`.
- Initial repository bootstrap observed at `56872ccbd7fbe6de043c35d9d8d37d32c4b726ac`.
- Contract/foundation SHA: `dbf1f756d588925a694a4131672248ddb21a14e3`.
- Latest core implementation checkpoint recorded above: `4d8dfd476ac6eeaf64749c2565f813f14e4d725b`; later doc-only taskboard commits may advance the branch ref.
- Provider success is not claimed. Provider adapters and controlled receipts remain Chat 2 / later-gate evidence.
- Full `pnpm` suite was not rerun in this runtime because DNS/package-manager resolution is unavailable here; do not treat local semantic checks as provider or full CI proof.
