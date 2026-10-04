# ServiceDesk AI — V1-INT6 Worker 1 Receipt

WORKER=1  
SPRINT=V1-INT6  
Branch: `feat/servicedesk-v1-core-sprint5`  
Required base verified: `612cd9ec1b2bbb0f8fc1d139989390e06dd543cf`  
Coordinator ref: `9d2cda3930e18dad57006c4960e9fc2344580db2`  
ServiceDesk Supabase staging: `cpmmgivhlkfbiwzhlcey`

## Scope completed

### E03 durable verified payment source

Added durable repository source:

- `supabase/migrations/0010_e03_verified_payment_rpc.sql`
- `src/server/core/payment-application-postgres.ts`

Implemented/verified:

- `public.servicedesk_apply_verified_payment(jsonb)` now exists as repository migration source.
- Function is `SECURITY INVOKER`.
- Execute revoked from `public`, `anon`, and `authenticated`.
- Execute granted to `service_role` only.
- Preserves $340 quote / $85 deposit / $255 balance fixture behavior.
- Duplicate provider event and duplicate provider transaction return duplicate without second business mutation.
- Expired hold, amount/currency/reference mismatch, and cross-workspace reference mismatch route to `PAYMENT_REVIEW`.
- `PLATFORM_SUBSCRIPTION` is review-only and does not mutate customer invoices.
- Deposit creates invoice + visit + ledger + exactly one `calendar.visit.upsert` outbox projection atomically.
- Visit timezone is copied from authoritative `capacity_slots.timezone`.
- Balance payment closes invoice to `PAID` with balance `0`.
- RPC returns nested DTO-compatible `invoice` and `visit` objects.
- Adapter now maps DB `SCHEDULED` -> DTO `CONFIRMED` and DB `NEEDS_REVIEW` -> DTO `PENDING_REVIEW`, with fail-closed malformed-payload handling.

Staging apply:

```text
Supabase apply_migration name: sd_0010_e03_verified_payment_rpc_int6
Result: success=true
```

Real E03 staging proof result:

```text
E03_DB_PROOF=PASS
remaining_fixture_workspaces=0
remaining_fixture_auth_users=0
```

Covered:

- deposit `APPLIED`;
- same provider event `DUPLICATE`;
- same provider transaction `DUPLICATE`;
- duplicate-safe application count;
- cross-workspace reference review;
- expired hold review;
- exact balance close to `PAID`;
- platform subscription no customer invoice mutation;
- forced outbox failure rollback with no persisted payment application;
- fixture cleanup.

### E06 Core field runtime

Added durable repository source:

- `supabase/migrations/0011_visit_field_runtime.sql`
- `src/server/core/visit-field-postgres.ts`
- `tests/db/v1-int6-rpc-structure.test.ts`

Implemented/verified:

- `visit_evidence` table.
- `visit_checklist_items` table.
- Evidence stores media/object references and note text only; no raw image bytes.
- Trusted RPCs:
  - `public.servicedesk_transition_visit(jsonb)`
  - `public.servicedesk_add_visit_evidence(jsonb)`
  - `public.servicedesk_set_visit_checklist_item(jsonb)`
- RPCs are `SECURITY INVOKER`.
- Execute revoked from `public`, `anon`, and `authenticated`.
- Execute granted to `service_role` only.
- `OWNER` / `DISPATCHER` staff authority.
- Assigned crew authority.
- Wrong crew rejection.
- Exact `expectedVersion` required; stale version returns `VERSION_CONFLICT`.
- `ASSIGNED -> EN_ROUTE -> IN_PROGRESS -> NEEDS_REVIEW` path.
- `SUBMIT_REVIEW` blocked until `BEFORE_PHOTO` and `AFTER_PHOTO` evidence exist.
- `COMPLETE` allowed to staff only after review.
- Terminal cancellation blocked.
- Cancellation creates `calendar.visit.cancel` outbox projection.
- Assignment creates `calendar.visit.upsert` outbox projection.
- Checklist upsert is idempotent per visit/item key.
- Incident note raises deduplicated field attention.
- Forced incident-attention failure rolls back evidence insert.
- Cross-workspace isolation proved.

Staging apply:

```text
Supabase apply_migration name: sd_0011_visit_field_runtime_int6
Result: success=true
```

Real E06 staging proof result:

```text
E06_DB_PROOF=PASS
remaining_fixture_workspaces=0
remaining_fixture_auth_users=0
```

## Security advisor / RPC privilege proof

RPC privilege query after migrations:

```text
servicedesk_add_visit_evidence: security_definer=false, anon=false, authenticated=false, service_role=true
servicedesk_apply_verified_payment: security_definer=false, anon=false, authenticated=false, service_role=true
servicedesk_set_visit_checklist_item: security_definer=false, anon=false, authenticated=false, service_role=true
servicedesk_transition_visit: security_definer=false, anon=false, authenticated=false, service_role=true
```

Supabase security advisor still reports pre-existing/non-INT6 findings:

1. `public.invitations` has RLS enabled with no policies.
2. `citext` extension is installed in `public`.
3. `authenticated` can execute existing `SECURITY DEFINER` helpers:
   - `public.has_active_membership(...)`
   - `public.is_customer_for_workspace(...)`

No new anon/public/authenticated execute exposure was observed for E03/E06 command RPCs.

## Tests / harness

Authored:

- `tests/db/v1-int6-rpc-structure.test.ts`

Not executed in this tool surface because package/runtime execution is unavailable here and project rules prohibit samai/samvr/local-device fallback.

## Final status

```text
WORKER=1
SPRINT=V1-INT6
STATE=OPERATIONS_VERIFIED
CANONICAL_GATE=CONFIGURATION_BLOCKED
E03_DURABLE_SOURCE=PASS
E03_DB_PROOF=PASS
E06_DB_PROOF=PASS
PROOF_FIXTURES_CLEANED=YES
SECURITY_ADVISOR=FINDINGS
READY_NEXT=E07 recurrence core
```

## Blockers

Canonical package install/typecheck/Vitest execution did not run in this tool surface. GPT Runtime checkout/package execution is unavailable here, and coordinator policy forbids samai/samvr/local-device fallback. Database migrations and staging proof were executed directly against only the ServiceDesk staging project `cpmmgivhlkfbiwzhlcey`.
