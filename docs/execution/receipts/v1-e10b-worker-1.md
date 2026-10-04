# ServiceDesk AI — V1-E10B Worker 1 Receipt

Worker: 1  
Sprint: V1-E10B  
Branch: `feat/servicedesk-v1-core-e10b`  
Coordinator ref: `30b3027b64f4e095b1f8a6b02733ea904860bfd7`  
Required base: `25e5770e96b250923c81254f0477461fc89feb4f`  
ServiceDesk staging project: `cpmmgivhlkfbiwzhlcey`

## FIRST ACTION

```text
Observed branch: feat/servicedesk-v1-core-e10b
Observed remote HEAD: 25e5770e96b250923c81254f0477461fc89feb4f
Required base: 25e5770e96b250923c81254f0477461fc89feb4f
HEAD_EXACT_MATCH=YES
```

## Source added

- `supabase/migrations/0015_e01_e02_command_closure.sql`
- `supabase/migrations/0015a_e10b_read_helpers.sql`
- `src/server/core/request-quote-capacity-postgres.ts`
- `tests/db/v1-e10b-command-closure-structure.sql`
- `docs/execution/receipts/v1-e10b-worker-1.md`

## Implementation summary

E10B closes the E01/E02 persistence/composition seam by adding service-role-only trusted PostgreSQL RPC boundaries while leaving TypeScript quote calculation authoritative.

### New trusted RPCs

- `servicedesk_create_customer(jsonb)`
- `servicedesk_create_property(jsonb)`
- `servicedesk_create_request(jsonb)`
- `servicedesk_update_request(jsonb)`
- `servicedesk_persist_quote_snapshot(jsonb)`
- `servicedesk_send_quote(jsonb)`
- `servicedesk_accept_quote(jsonb)`
- `servicedesk_upsert_capacity_slot(jsonb)`
- `servicedesk_hold_slot(jsonb)`
- `servicedesk_find_capacity_slots(jsonb)`
- `servicedesk_get_request(jsonb)`
- `servicedesk_get_quote(jsonb)`
- `servicedesk_get_latest_quote_for_request(jsonb)`

All new command/read RPCs are `SECURITY INVOKER`; execute is denied to `public`, `anon`, and `authenticated`; execute is granted to `service_role` only.

### New persistence helper

- `servicedesk_command_idempotency`

This table is intentionally service-role only. RLS is enabled and no client policy is present, so advisor reports it as RLS/no-policy. This is classified as intentional deny-all.

### Composition module

`src/server/core/request-quote-capacity-postgres.ts` adds concrete Supabase composition for:

- `createRequest`
- `updateRequest`
- `calculateQuote`
- `sendQuote`
- `acceptQuote`
- `findSlots`
- `holdSlot`

It also exports internal commands for staff bootstrap:

- `createCustomer`
- `createProperty`
- `seedCapacitySlot`

The module uses the existing TypeScript `createQuoteSnapshot(..., defaultRateCard)` and sends the already-computed snapshot to the DB for atomic persistence. It does not duplicate the quote formula in SQL.

## Staging migration apply

Applied only to `cpmmgivhlkfbiwzhlcey`:

```text
sd_0015_e01_e02_command_closure: success=true
sd_0015a_e10b_read_helpers: success=true
```

## Staging proof result

Real proof ran on `cpmmgivhlkfbiwzhlcey`.

Observed result:

```json
{
  "early_command_boundary": "PASS",
  "quote_acceptance": "PASS",
  "request_quote_capacity_composition": "PASS",
  "integrated_db_journey": "PASS",
  "rls_matrix": "PASS",
  "concurrency_matrix": "PASS"
}
```

### Covered

- staff customer bootstrap via trusted RPC
- staff property bootstrap via trusted RPC
- staff request creation via trusted RPC
- visitor request creation via trusted RPC
- request idempotency
- request expectedVersion conflict
- malformed/cross-workspace request rejection
- deterministic TypeScript quote snapshot persisted atomically through DB RPC
- frozen move-out fixture persisted exactly:
  - `totalMinor=34000`
  - `depositMinor=8500`
  - `balanceMinor=25500`
  - `durationMinutes=240`
  - `bufferMinutes=30`
- quote supersede rollback proof: forced quote item insert failure did not leave the previous quote superseded
- `APPROVED -> SENT` quote transition
- stale send rejection
- customer quote acceptance
- duplicate accepted command returns duplicate without second mutation
- visitor quote acceptance
- visitor cross-session quote acceptance denied
- customer cross-scope quote acceptance denied
- expired quote acceptance denied
- staff capacity slot seeding via trusted RPC
- capacity slot read through RPC
- atomic slot hold creation
- 15-minute hold proof
- duplicate hold idempotency
- competing active hold rejected
- expired hold did not block later legitimate hold
- accepted quote + valid hold consumed by existing E03 sandbox verified-payment RPC
- invoice/visit created without fixture-mutating quote/hold state
- deposit ledger and calendar outbox counts exactly one
- corrected authenticated-session customer RLS proof:
  - `customer_count=1`
  - `invoice_count=1`
  - `conversation_count=1`

## RPC privilege proof

New RPC privilege query returned all rows with:

```text
security_definer=false
anon_execute=false
authenticated_execute=false
service_role_execute=true
```

Functions checked:

- `servicedesk_accept_quote`
- `servicedesk_create_customer`
- `servicedesk_create_property`
- `servicedesk_create_request`
- `servicedesk_find_capacity_slots`
- `servicedesk_get_latest_quote_for_request`
- `servicedesk_get_quote`
- `servicedesk_get_request`
- `servicedesk_hold_slot`
- `servicedesk_persist_quote_snapshot`
- `servicedesk_send_quote`
- `servicedesk_update_request`
- `servicedesk_upsert_capacity_slot`

## Security advisor

Latest advisor findings:

- `public.invitations` RLS/no-policy — `INTENTIONAL_DENY_ALL` / existing accepted warning.
- `public.servicedesk_command_idempotency` RLS/no-policy — `INTENTIONAL_DENY_ALL` for service-role-only idempotency table.
- `citext` extension in public — `KNOWN_ACCEPTED_WARNING`.
- two authenticated-executable SECURITY DEFINER helper warnings for existing RLS helper functions — `KNOWN_ACCEPTED_WARNING`.
- leaked password protection disabled — `RELEASE_BLOCKER_CONFIG`, outside DB migration scope.

## Cleanup

Exact E10B cleanup query returned:

```text
remaining_workspaces=0
remaining_member_auth_users=0
remaining_customers=0
```

## Package / canonical runtime status

Canonical package install/typecheck/Vitest still did not run in this tool surface. Coordinator policy forbids samai/samvr/local-device fallback. This remains `CONFIGURATION_BLOCKED`, not a code PASS.

## Final status

```text
EARLY_COMMAND_BOUNDARY=PASS
QUOTE_ACCEPTANCE=PASS
REQUEST_QUOTE_CAPACITY_COMPOSITION=PASS
INTEGRATED_DB_JOURNEY=PASS
RLS_MATRIX=PASS
CONCURRENCY_MATRIX=PASS
PROOF_FIXTURES_CLEANED=YES
STATE=OPERATIONS_VERIFIED
CANONICAL_GATE=CONFIGURATION_BLOCKED
```
