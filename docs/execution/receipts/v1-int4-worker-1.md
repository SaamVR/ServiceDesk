# ServiceDesk AI — V1-INT4B Worker 1 Receipt

Worker: 1  
SPRINT=V1-INT4B  
Branch: `feat/servicedesk-v1-core-sprint4`  
Coordinator ref: `184331936ba6c81a1d216c7d866d8b62bd2c5b10`

## Scope

Primary mission: E05 PostgreSQL closure for conversation inbox runtime.

Dedicated Supabase staging project used only:

```text
Project: ServiceDesk
Project ref: cpmmgivhlkfbiwzhlcey
Region: us-east-1
Postgres: 17.11.0.002
```

## Branch state

Assignment listed current HEAD:

```text
79a02a7be75066e37f69ceae6780a2dbe551d5fe
```

Observed current remote branch HEAD before this follow-up work was newer:

```text
ae6660cf1429c8c085e6d8fcdc0e528e38ce6edd
```

That newer progress was preserved. This run added additional commits on top of it.

## Source changes

### Migration repair / persistence boundary

`supabase/migrations/0008_conversation_inbox_runtime.sql` was already repaired on the branch for the unsupported PostgreSQL syntax issue:

```sql
DROP POLICY IF EXISTS ...;
CREATE POLICY ...;
```

Verified 0008 also contains:

- `provider_inbound_receipts` normalized receipt columns:
  - `workspace_id`
  - `provider`
  - `provider_account_id`
  - `provider_message_id`
  - `provider_receipt_key`
  - `sender_ref`
  - `provider_occurred_at`
  - `raw_provider_event_ref`
  - `content_kind`
  - `conversation_id`
  - `message_id`
  - `received_at`
  - `processed_at`
  - `state`
- `messages(workspace_id, outbox_event_id)` composite FK to `outbox_events(workspace_id, id)`.
- No raw webhook body, duplicated text body, raw media bytes, provider tokens, or AI-authority flags are persisted in `provider_inbound_receipts`.

This run added durable source migration:

```text
supabase/migrations/0009_e05_postgres_rpc_closure.sql
```

The new migration commits trusted PostgreSQL RPCs to the repo instead of leaving them as staging-only DDL:

- `public.servicedesk_apply_inbound_message(jsonb)`
- `public.servicedesk_set_conversation_handover(jsonb)`
- `public.servicedesk_enqueue_conversation_reply(jsonb)`
- `public.servicedesk_read_workspace_snapshot(jsonb)`

RPC security posture:

```text
security invoker
anon execute: false
authenticated execute: false
service_role execute: true
```

Staging application:

```text
Supabase apply_migration name: sd_0009_e05_postgres_rpc_closure
Result: success=true
```

### Type/adapters

Updated:

- `src/server/core/inbound-message.ts`
  - In-process receipt creation now supplies required `senderRef` and `providerOccurredAt` fields.
  - Inbound messages now carry `providerOccurredAt` into `MessageRecord`.
- `src/server/core/conversation-postgres.ts`
  - RPC adapter now handles nested RPC return objects.
  - Adapter maps both camelCase and PostgreSQL snake_case rows for conversations/messages.
  - Snapshot mapping no longer turns snake_case DB rows into `undefined` DTO fields.

## ServiceDesk staging proof

Real PostgreSQL proof executed against only `cpmmgivhlkfbiwzhlcey`.

Covered assertions:

- inbound first application creates provider receipt + conversation + message;
- duplicate receipt returns `DUPLICATE`;
- duplicate provider message returns `DUPLICATE`;
- exact message count remains stable after duplicates;
- first inbound bumps conversation version from `1` to `2` exactly once;
- duplicate inbound does not bump version;
- unknown sender creates an applied conversation with no customer link;
- handover activation succeeds with exact expected version;
- handover deactivation succeeds with exact expected version;
- stale expectedVersion is rejected with `VERSION_CONFLICT`;
- unauthorized `CREW` handover is rejected with `FORBIDDEN`;
- cross-workspace handover is rejected with `FORBIDDEN`;
- reply creates outbound staff message + `conversation.reply` outbox event atomically;
- duplicate reply idempotency returns the prior message/outbox and creates no duplicate;
- stale reply expectedVersion is rejected with `VERSION_CONFLICT`;
- forced message insert failure rolls back the attempted reply outbox row;
- staff snapshot sees authorized conversation/messages;
- customer snapshot sees only that customer's conversation/messages;
- second customer snapshot sees zero conversations;
- `provider_inbound_receipts` has no forbidden raw body/media/token/AI-authority columns.

Observed proof result:

```text
E05_DB_PROOF=PASS
```

Cleanup confirmation:

```text
remaining_fixture_workspaces=0
remaining_fixture_auth_users=0
PROOF_FIXTURES_CLEANED=YES
```

## Security advisor

Ran Supabase security advisor after applying the E05 RPC migration.

Command RPC execute verification:

```text
servicedesk_apply_inbound_message: security_definer=false, anon=false, authenticated=false, service_role=true
servicedesk_enqueue_conversation_reply: security_definer=false, anon=false, authenticated=false, service_role=true
servicedesk_read_workspace_snapshot: security_definer=false, anon=false, authenticated=false, service_role=true
servicedesk_set_conversation_handover: security_definer=false, anon=false, authenticated=false, service_role=true
```

Advisor findings remain:

1. `public.invitations` has RLS enabled but no policies.
2. `citext` extension is installed in `public`.
3. Two pre-existing authenticated SECURITY DEFINER helper findings:
   - `public.has_active_membership(...)`
   - `public.is_customer_for_workspace(...)`

No new public/anon/authenticated execute exposure was found for the E05 command RPCs.

```text
SECURITY_ADVISOR=FINDINGS
```

## Runtime / canonical gate

Repository source was saved through connected GitHub tools. Live PostgreSQL/Supabase proof passed. Package-level canonical checks were not executed in this tool surface because GPT Runtime checkout/package execution was not available here and local devices are prohibited by the coordinator rules.

```text
STATE=OPERATIONS_VERIFIED
CANONICAL_GATE=CONFIGURATION_BLOCKED
```

## Final status

```text
WORKER=1
SPRINT=V1-INT4B
STATE=OPERATIONS_VERIFIED
CANONICAL_GATE=CONFIGURATION_BLOCKED
E05_DB_PROOF=PASS
PROOF_FIXTURES_CLEANED=YES
SECURITY_ADVISOR=FINDINGS
BLOCKERS=Package/typecheck/Vitest canonical checks not executed in GPT Runtime from this tool surface; Supabase advisor has pre-existing non-E05 findings listed above.
READY_NEXT=E03 Postgres payment transaction adapter, then E06
```
