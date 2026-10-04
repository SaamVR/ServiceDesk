# ServiceDesk AI

ServiceDesk AI is an operations platform for residential cleaning businesses. V1 covers enquiry, quoting, crew scheduling, field execution, payments, recurrence, quality, automation, and operational reporting.

## Engineering status

This repository is developed from an approved V2.0 product specification and V1 implementation plan. Business state is authoritative in PostgreSQL. External-provider acceptance is tracked separately from domain success, and no provider is described as verified without controlled evidence.

## Delivery model

- `main`: stable repository baseline.
- `feat/servicedesk-v1-integrate`: controller-owned V1 integration branch.
- `feat/servicedesk-v1-core`: core/domain/database lane.
- `feat/servicedesk-v1-connectors`: integrations/AI lane.
- `feat/servicedesk-v1-product`: product/UI lane.
- `docs/taskboard.md`: controller-owned execution ledger with exact branch SHAs and evidence.

See `AGENTS.md` before changing shared files.
