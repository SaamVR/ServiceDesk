# ServiceDesk AI — V1-INT4 Worker 1 Receipt

Worker: 1  
Sprint: V1-INT4 / INT4B  
Branch: `feat/servicedesk-v1-core-sprint4`
Coordinator refs: `9ce12193caf3d2104168931b28efeeaf22a9d531`, `184331936ba6c81a1d216c7d866d8b62bd2c5b10`

## INT4B — E03/E05 PostgreSQL Integration Closure

Dedicated Supabase staging project used only:

```text
Project: ServiceDesk
Project ref: cpmmgivhlkfbiwzhlcey
Region: us-east-1
Postgres: 17.11.0.002
```

### Branch start

Expected current HEAD at assignment:
`79a02a7be75066e37f69ceae6780a2dbe551d5fe`

Observed branch HEAD matched expected before INT4B source changes.

### Migration repair

Updated:
- `supabase/migrations/0008_conversation_inbox_runtime.sql`

Repairs:
- removed unsupported `CREATE POLICY IF NOT EXISTS` usage;
- switched to deterministic `DROP POLICY IF EXISTS` + `CREATE POLICY`;
- replaced `conversations_staff_all` with read-only `conversations_staff_select`;
- recreated `messages_staff_select` safely;
- added `messages_customer_select` safely;
- preserved customer read semantics for conversations;
- added `messages(workspace_id, outbox_event_id)` composite FK to `outbox_events(workspace_id, id)` with nullable outbox linkage;
- aligned `provider_inbound_receipts` with canonical technical receipt identity/retry metadata:
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
- no raw webhook body, access token, provider secret, AI authority flag, or raw media bytes are stored in receipts.

Staging application:

```text
Supabase apply_migration name: sd_0008_conversation_inbox_runtime_int4b
Result: success=true
```

### RPCs and adapters

Implemented trusted-server Postgres RPCs in staging:

- `public.servicedesk_apply_verified_payment(jsonb)`
- `public.servicedesk_apply_inbound_message(jsonb)`
- `public.servicedesk_set_conversation_handover(jsonb)`
- `public.servicedesk_enqueue_conversation_reply(jsonb)`
- `public.servicedesk_read_workspace_snapshot(jsonb)`

Security posture:

```sql
revoke execute on function ... from public, anon, authenticated;
grant execute on function ... to service_role;
```

Added typed Supabase RPC adapters:

- `src/server/core/payment-application-postgres.ts`
- `src/server/core/conversation-postgres.ts`

These adapters call the trusted RPC boundary instead of pretending Supabase JS provides an interactive TypeScript transaction callback.

### E05 DB proof

Real PostgreSQL proof executed against `cpmmgivhlkfbiwzhlcey` in rollback-wrapped fixture transactions.

Covered:
- inbound `APPLIED` creates provider receipt + conversation + message;
- duplicate receipt returns `DUPLICATE`;
- exact message count remains stable after duplicate;
- conversation version increments exactly once on first inbound;
- duplicate inbound does not bump version;
- handover activation succeeds with exact expected version;
- stale handover returns `VERSION_CONFLICT`;
- unauthorized `CREW` handover is rejected;
- cross-workspace handover fails closed;
- staff reply creates message + outbox atomically;
- duplicate reply idempotency returns prior row and creates no second message/outbox;
- opt-out rejection happens before outbox;
- staff snapshot includes authorized conversations/messages;
- customer snapshot for customer 1 sees own conversation;
- customer snapshot for customer 2 sees zero conversations;
- visitor snapshot returns `FORBIDDEN`.

Result:

```text
E05_DB_PROOF=PASS
```

### E03 DB proof

Real PostgreSQL proof executed against `cpmmgivhlkfbiwzhlcey` in rollback-wrapped fixture transactions.

Covered:
- `$340` quote fixture;
- `$85` deposit application;
- invoice allocation: total `34000`, allocated `8500`, balance `25500`;
- hold confirmation;
- visit creation;
- ledger credit;
- booking/payment outbox;
- duplicate provider event returns `DUPLICATE` with no second mutation;
- duplicate provider transaction returns `DUPLICATE` with no second mutation;
- expired hold routes to `PAYMENT_REVIEW` with no false booking;
- `$255` balance payment closes invoice to `PAID` and balance `0`;
- deliberate ledger trigger failure rolls back partial invoice/application/visit/ledger/outbox state.

Result:

```text
E03_DB_PROOF=PASS
```

### Fixture cleanup

All DB proof fixtures were executed inside explicit transaction + rollback blocks.

Cleanup confirmation query:

```sql
select count(*) as remaining_int4b_workspaces
from public.workspaces
where slug like 'int4b-%';
```

Observed:

```text
remaining_int4b_workspaces=0
PROOF_FIXTURES_CLEANED=YES
```

### Security advisor

Ran Supabase security advisor after migration/RPC work.

Remaining findings:

1. `public.invitations` has RLS enabled but no policies — known intentional deny-all until invitation flows are implemented.
2. `citext` extension is installed in public — pre-existing staging warning.
3. `authenticated` can execute two existing SECURITY DEFINER RLS helper functions:
   - `public.has_active_membership(...)`
   - `public.is_customer_for_workspace(...)`

No new public/anon execution exposure was reported for the INT4B command RPCs. INT4B RPC execute was revoked from `public`, `anon`, and `authenticated`, then granted to `service_role` only.

### Canonical gate

Canonical package/tooling remains blocked in GPT Runtime:

```text
pnpm unavailable in GPT Runtime
git ls-remote cannot resolve github.com
```

Because real staging DB proof passed but canonical pnpm/Vitest/typecheck still did not run, the evidence label is:

```text
STATE=OPERATIONS_VERIFIED
CANONICAL_GATE=CONFIGURATION_BLOCKED
```

## Ready next

READY_NEXT=E06 crew transitions and field evidence
