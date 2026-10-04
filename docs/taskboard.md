# ServiceDesk AI V1 taskboard

Controller: Chat 1 · Integration branch: `feat/servicedesk-v1-integrate`

| Task | Owner | State | Base SHA | Branch HEAD | Evidence | Next dependency |
| --- | --- | --- | --- | --- | --- | --- |
| 0.1 Scaffold + contract freeze | Chat 1 | ACTIVE | `56872ccbd7fbe6de043c35d9d8d37d32c4b726ac` | pending | fixture/unit/typecheck pending | publish contract commit |
| 0.2 Design scaffold/story map | Chat 3 | READY | contract SHA pending | startup base | none yet | contract SHA |
| 0.3 Provider boundary spike | Chat 2 | READY | contract SHA pending | startup base | none yet | contract SHA |
| 1.1 Tenancy/CRM/request | Chat 1 | READY | contract SHA pending | n/a | cross-tenant tests required | 0.1 |
| 1.2 Quote/approval | Chat 1 | READY | contract SHA pending | n/a | snapshot/version tests required | 1.1 |
| 2.1 Capacity/visits/recurrence | Chat 1 | READY | later gate | n/a | race/DST tests required | Gate A |
| 2.2 Ledger/outbox/attention | Chat 1 | READY | later gate | n/a | idempotency/restart tests required | 2.1 |
| 3.1 Field/quality/reporting | Chat 1 | READY | later gate | n/a | operations tests required | Gate B |
| 3.4 Subscriptions/metrics | Chat 1 + 2 | READY | later gate | n/a | tenant/idempotency tests required | ledger |
| 4.1 Integrated regression/ops | Chat 1 | READY | Gate C | n/a | full regression/runbook | all lanes |
