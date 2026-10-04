# ServiceDesk AI V1 taskboard

Controller: Chat 1 · Integration branch: `feat/servicedesk-v1-integrate`

| Task | Owner | State | Base SHA | Branch HEAD | Evidence | Next dependency |
| --- | --- | --- | --- | --- | --- | --- |
| 0.1 Scaffold + contract freeze | Chat 1 | DONE | `56872ccbd7fbe6de043c35d9d8d37d32c4b726ac` | `dbf1f756d588925a694a4131672248ddb21a14e3` | Node 22 pin; pnpm lock; `tsc --noEmit` exit 0; domain/contracts 5/5 PASS; move-out $340/$85/$255 + 240/30 PASS | worker lanes may start |
| E01 Executable integrated baseline | Chat 1 | ACTIVE | `df9c25c117ae62bc840e246cbf9b139140e1313d` | candidate pending | E01 running in persistent candidate; core pin merge in progress; checks pending | merge core/connectors/product pins and run executable gate |
| 0.2 Design scaffold/story map | Chat 3 | REVIEW | `dbf1f756d588925a694a4131672248ddb21a14e3` | `9cec82448952e1aa8fe1d5a83655693ed4114df9` | Product pin selected for E01; newer product planning commits observed separately and preserved, not integrated as implementation evidence | E01 product merge + UI/e2e/build/browser gate |
| 0.3 Provider boundary spike | Chat 2 | REVIEW | `dbf1f756d588925a694a4131672248ddb21a14e3` | `51fd14c10d488932a54d9524f1b57f89359ec809` | Connector Run 10 handoff reports implementation-rich branch but CONNECTOR_INTEGRATION_BLOCKED until provider/AI/typecheck suites execute | E01 connector merge + provider/AI matrix |
| 1.1 Tenancy/CRM/request | Chat 1 | REVIEW | `dbf1f756d588925a694a4131672248ddb21a14e3` | `bfeb34f72540770acb27d88c3228cb867437691f` | Schema/RLS/auth guard/customer import/request command slices implemented; SQL cross-tenant proof added; request repository + persistence adapter added; prior local semantic review only | SQL/Supabase reset proof before DONE |
| 1.2 Quote/approval | Chat 1 | ACTIVE | `bfeb34f72540770acb27d88c3228cb867437691f` | `17bd005ac619889626556353dc22e1bcddd4766a` | Quote domain, approval guard, migration, repository, facade and exact quote acceptance implemented; full suite not rerun in prior runtime | run typecheck/tests/db reset; inspect facade semantics before REVIEW/DONE |
| 2.1 Capacity/visits/recurrence | Chat 1 | ACTIVE | `056061b162d0364f69cbd030ad77882a22d3e8c2` | `8d97b03640ae39fbb9616113989ccf1ace76df1a` | Capacity, holds, visit scheduling, SQL last-slot proof, visit adapter, capacity facade/adapter implemented; full DB reset not rerun in prior runtime | run typecheck/tests/db reset before REVIEW |
| 2.2 Ledger/outbox/attention | Chat 1 | ACTIVE | `087d29e37c37527ec6e06098526d4de14a7859d9` | `4484cee662236c4b4a0327f9abf250252c2c015d` | Ledger/outbox/attention domain and repository command seams implemented; full DB reset not rerun in prior runtime | add persistence adapter + SQL restart/idempotency proof; run typecheck/tests/db reset before REVIEW |
| 3.1 Field/quality/reporting | Chat 1 | READY | later gate | n/a | operations tests required | Gate B |
| 3.4 Subscriptions/metrics | Chat 1 + 2 | READY | later gate | n/a | tenant/idempotency tests required | core ledger |
| 4.1 Integrated regression/ops | Chat 1 | READY | Gate C | n/a | full regression/runbook | all lanes |

## Controller notes

- Remote repository: `https://github.com/SaamVR/ServiceDesk`.
- Initial repository bootstrap observed at `56872ccbd7fbe6de043c35d9d8d37d32c4b726ac`.
- Contract/foundation SHA: `dbf1f756d588925a694a4131672248ddb21a14e3`.
- E01 candidate starts from integration planning HEAD `df9c25c117ae62bc840e246cbf9b139140e1313d`.
- Core E01 pin: `c0b6c2c7d92250398e637c30edfe12e93efc0b1a`; implementation checkpoint within it: `4484cee662236c4b4a0327f9abf250252c2c015d`.
- Connector E01 pin: `51fd14c10d488932a54d9524f1b57f89359ec809`. Newer connector planning commits were observed but are not implementation evidence.
- Product E01 pin: `9cec82448952e1aa8fe1d5a83655693ed4114df9`. Product implementation anchor is `d8ecc6331d30e81bd2098688877389d988b973e3`; newer product planning commits were observed but are not implementation evidence.
- Provider success is not claimed. Provider adapters and controlled receipts remain Chat 2 / later-gate evidence.
- No E01 gate is considered passed until fresh `pnpm typecheck`, `pnpm test`, `pnpm lint`, and `pnpm build` execute successfully on the same integrated candidate SHA.
