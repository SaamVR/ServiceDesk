# ServiceDesk AI V1 taskboard

Controller: Chat 1 · Integration branch: `feat/servicedesk-v1-integrate`

| Task | Owner | State | Base SHA | Branch HEAD | Evidence | Next dependency |
| --- | --- | --- | --- | --- | --- | --- |
| 0.1 Scaffold + contract freeze | Chat 1 | DONE | `56872ccbd7fbe6de043c35d9d8d37d32c4b726ac` | `dbf1f756d588925a694a4131672248ddb21a14e3` | Node 22 pin; pnpm lock; `tsc --noEmit` exit 0; domain/contracts 5/5 PASS; move-out $340/$85/$255 + 240/30 PASS | worker lanes may start |
| 0.2 Design scaffold/story map | Chat 3 | REVIEW | `dbf1f756d588925a694a4131672248ddb21a14e3` | `606f76d7908d8b5d64792d62c8e0812c96955c43` | Controller observed product branch ahead by 78 commits and inside UI/doc/e2e lane paths; not integrated because full browser/typecheck/e2e gate unavailable in this runtime | Chat 3 should report exact browser/e2e proof; Chat 1 integration gate pending |
| 0.3 Provider boundary spike | Chat 2 | REVIEW | `dbf1f756d588925a694a4131672248ddb21a14e3` | `3b295433303af631a3867fb130e2d4547e10032b` | Controller observed connectors branch ahead by 38 commits and inside AI/provider/example lane paths; not integrated because no provider/CI gate proof available in this runtime | Chat 2 should report exact provider-contract tests and mark mocks as CONTRACT_TESTED only |
| 1.1 Tenancy/CRM/request | Chat 1 | REVIEW | `dbf1f756d588925a694a4131672248ddb21a14e3` | `bfeb34f72540770acb27d88c3228cb867437691f` | Schema/RLS/auth guard/customer import/request command slices implemented; SQL cross-tenant proof added; request repository + persistence adapter added; local disconnected semantic review only because Runtime has no package install/network | SQL/Supabase reset proof before DONE |
| 1.2 Quote/approval | Chat 1 | ACTIVE | `bfeb34f72540770acb27d88c3228cb867437691f` | `17bd005ac619889626556353dc22e1bcddd4766a` | RED/GREEN quote domain, approval guard, quote migration, command seam and persistence adapter implemented; async repository normalization `7c4def7...`; exact quote lookup adapter `fa98c77...`; awaited command tests `531a257...`; facade contract/implementation `047474f...`/`c3ae177...`; adapter test update `bbf0dcd...`; SQL quote snapshot proof `93df505...`; exact quote acceptance RED/GREEN `e3d89b6...`/`17bd005...`; full suite not rerun in this runtime | run typecheck/tests/db reset; inspect facade semantics before REVIEW/DONE |
| 2.1 Capacity/visits/recurrence | Chat 1 | READY | Gate A | n/a | last-slot race/DST tests required | Gate A |
| 2.2 Ledger/outbox/attention | Chat 1 | READY | later gate | n/a | idempotency/restart tests required | 2.1 schema |
| 3.1 Field/quality/reporting | Chat 1 | READY | later gate | n/a | operations tests required | Gate B |
| 3.4 Subscriptions/metrics | Chat 1 + 2 | READY | later gate | n/a | tenant/idempotency tests required | core ledger |
| 4.1 Integrated regression/ops | Chat 1 | READY | Gate C | n/a | full regression/runbook | all lanes |

## Controller notes

- Remote repository: `https://github.com/SaamVR/ServiceDesk`.
- Initial repository bootstrap observed at `56872ccbd7fbe6de043c35d9d8d37d32c4b726ac`.
- Contract/foundation SHA: `dbf1f756d588925a694a4131672248ddb21a14e3`.
- Latest core implementation checkpoint recorded above: `17bd005ac619889626556353dc22e1bcddd4766a`; later doc-only taskboard commits may advance the branch ref.
- Worker branches reviewed but not integrated: connectors `3b295433303af631a3867fb130e2d4547e10032b`, product `606f76d7908d8b5d64792d62c8e0812c96955c43`.
- Provider success is not claimed. Provider adapters and controlled receipts remain Chat 2 / later-gate evidence.
- Full `pnpm` suite was not rerun in this runtime because DNS/package-manager resolution is unavailable here; do not treat local semantic checks as provider or full CI proof.
