# ServiceDesk AI — V1-INT7 Worker 1 Receipt

Worker: 1  
Sprint: V1-INT7  
Branch: `feat/servicedesk-v1-core-sprint6`  
Coordinator ref: `137b85ff538538a0dc92c77c2e5495ddaf38a339`  
Required base: `fa9568970c012550149a0093360e68bbdaa69e62`  
ServiceDesk staging project: `cpmmgivhlkfbiwzhlcey`

## HEAD verification

FIRST ACTION result:

```text
Branch: feat/servicedesk-v1-core-sprint6
Observed HEAD: fa9568970c012550149a0093360e68bbdaa69e62
Required base: fa9568970c012550149a0093360e68bbdaa69e62
HEAD_EXACT_MATCH=YES
```

## Source changes

Added durable recurrence runtime source:

- `supabase/migrations/0012_recurrence_runtime.sql`
- `supabase/migrations/0012a_recurrence_search_path_hardening.sql`
- `src/domain/recurrence.ts`
- `src/server/core/recurrence-postgres.ts`
- `src/server/core/conversation-postgres.ts`
- `tests/domain/recurrence.test.ts`
- `tests/db/v1-int7-recurrence-rpc-structure.sql`

## E07 migration/runtime

Implemented authoritative ServiceDesk recurrence truth.

`0012_recurrence_runtime.sql`:

- extends `public.recurrence_rules` with:
  - `status` = `ACTIVE | PAUSED | COMPLETED`
  - `generated_occurrences`
  - `next_occurrence_on`
  - `version`
  - `updated_at`
  - `idempotency_key`
- creates `public.recurrence_occurrences` with:
  - workspace/rule composite scope
  - `sequence`
  - `occurrence_on`
  - `requested_start_at`
  - `state` = `PENDING | MATERIALIZED | SKIPPED`
  - generated `request_id`
  - unique `(workspace_id, rule_id, sequence)`
  - unique `(workspace_id, rule_id, occurrence_on)`
- uses composite FKs for workspace-safe references
- enables RLS and read policies
- adds recurrence date helper functions
- adds service-role-only RPCs:
  - `servicedesk_create_recurrence_rule(jsonb)`
  - `servicedesk_apply_recurrence_rule_action(jsonb)`
  - `servicedesk_materialize_due_recurrences(jsonb)`
- replaces `servicedesk_read_workspace_snapshot(jsonb)` with expanded output including:
  - `recurrenceRules`
  - `visitEvidence`
  - `visitChecklistItems`
  - `attentionItems`
  - `qualityCases = []`

`0012a_recurrence_search_path_hardening.sql`:

- sets explicit `search_path = public, pg_temp` on recurrence helper functions to clear new Supabase advisor mutable-search-path findings.

## Date engine

Implemented in both Postgres and TypeScript domain code.

Covered rules:

- `WEEKLY` = +7 local calendar days
- `FORTNIGHTLY` = +14 local calendar days
- `MONTHLY` preserves source anchor day and clamps shorter months
- IANA timezone validation/conversion for requested local start times
- no naive millisecond arithmetic for recurrence date advancement

Canonical tests authored:

- `tests/domain/recurrence.test.ts`

## RPC/adapters

Added:

- `src/server/core/recurrence-postgres.ts`

Implemented typed Supabase RPC adapters for:

- `createRecurrenceRule`
- `applyRecurrenceRuleAction`
- `materializeDueRecurrences`

Updated:

- `src/server/core/conversation-postgres.ts`

Snapshot adapter now maps:

- `recurrenceRules`
- `visitEvidence`
- `visitChecklistItems`
- `attentionItems`
- `qualityCases`

## Staging migration application

Applied only to ServiceDesk staging:

```text
Project: ServiceDesk
Project ref: cpmmgivhlkfbiwzhlcey
Migration: sd_0012_recurrence_runtime_int7
Result: success=true

Migration: sd_0012a_recurrence_search_path_hardening_int7
Result: success=true
```

No Booking agent, CMS, or other Supabase project was touched.

## Real staging proof

Executed live SQL proof against `cpmmgivhlkfbiwzhlcey`.

Covered:

- create recurrence rule
- duplicate idempotency returns same authoritative rule
- unauthorized CREW command rejected
- cross-workspace property rejected
- PAUSE
- stale RESUME expectedVersion rejected
- RESUME
- SKIP_NEXT creates exactly one `SKIPPED` occurrence and advances from `2026-01-31` to `2026-02-28`
- materializer creates exactly one recurring request
- second materializer pass creates zero duplicates
- monthly Jan 31 clamp
- leap-year February clamp
- DST/IANA local timestamp conversion
- maxOccurrences marks rule `COMPLETED`
- endsOn marks rule `COMPLETED`
- recurrence materializer creates no visit
- recurrence materializer creates no `calendar.*` outbox/provider event
- rollback on forced failure leaves no occurrence
- snapshot includes recurrence rules
- fixtures cleaned

Observed result:

```text
E07_DB_PROOF=PASS
RECURRENCE_CONCURRENCY=PASS
NO_PROVIDER_SCHEDULE_TRUTH=PASS
remaining_fixture_workspaces=0
remaining_fixture_auth_users=0
PROOF_FIXTURES_CLEANED=YES
```

## RPC privilege proof

Observed for all INT7 trusted RPCs:

```text
servicedesk_apply_recurrence_rule_action:
  security_definer=false
  anon_execute=false
  authenticated_execute=false
  service_role_execute=true

servicedesk_create_recurrence_rule:
  security_definer=false
  anon_execute=false
  authenticated_execute=false
  service_role_execute=true

servicedesk_materialize_due_recurrences:
  security_definer=false
  anon_execute=false
  authenticated_execute=false
  service_role_execute=true

servicedesk_read_workspace_snapshot:
  security_definer=false
  anon_execute=false
  authenticated_execute=false
  service_role_execute=true
```

## Security advisor

Ran Supabase security advisor after `0012` and after `0012a`.

Final advisor findings are the known pre-existing staging findings:

1. `public.invitations` has RLS enabled but no policies.
2. `citext` extension is installed in public.
3. `authenticated` can execute existing SECURITY DEFINER RLS helper functions:
   - `public.has_active_membership(...)`
   - `public.is_customer_for_workspace(...)`

The temporary new mutable-search-path findings from recurrence helpers were fixed by `0012a`.

## Canonical gate

Package/runtime canonical checks were not executed in this tool surface:

```text
pnpm/typecheck/Vitest not available through this tool surface.
Coordinator policy forbids samai/samvr/local-device fallback.
```

Evidence state is therefore:

```text
STATE=OPERATIONS_VERIFIED
CANONICAL_GATE=CONFIGURATION_BLOCKED
```

## Final return

```text
WORKER=1
SPRINT=V1-INT7
STATE=OPERATIONS_VERIFIED
CANONICAL_GATE=CONFIGURATION_BLOCKED
E07_DB_PROOF=PASS
RECURRENCE_CONCURRENCY=PASS
NO_PROVIDER_SCHEDULE_TRUTH=PASS
PROOF_FIXTURES_CLEANED=YES
READY_NEXT=E08 invoice/manual-payment/quality core
```
