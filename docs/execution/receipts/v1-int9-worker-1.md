# ServiceDesk AI — V1-INT9 Worker 1 Receipt

Worker: 1  
Sprint: V1-INT9  
Branch: `feat/servicedesk-v1-core-sprint8`  
Coordinator ref: `72636ae5dbee2d45a42a91baa983f49c8d62eb84`  
Required base: `cae7eb170b97208802065b76e20cbe9f9862c0cd`  
ServiceDesk staging project: `cpmmgivhlkfbiwzhlcey`

## HEAD verification

FIRST ACTION result:

```text
Branch: feat/servicedesk-v1-core-sprint8
Observed HEAD: cae7eb170b97208802065b76e20cbe9f9862c0cd
Required base: cae7eb170b97208802065b76e20cbe9f9862c0cd
HEAD_EXACT_MATCH=YES
```

## Source changes

Added durable E09 source:

- `supabase/migrations/0014_reporting_platform_usage.sql`
- `supabase/migrations/0014a_conversation_reply_usage_gate.sql`
- `src/server/core/reporting-platform-postgres.ts`
- `tests/db/v1-int9-reporting-platform-usage-rpc-structure.sql`

## E09 implementation summary

### Reporting

Implemented trusted `servicedesk_read_reporting_snapshot(jsonb)`.

Scope and rules:

- OWNER/DISPATCHER only.
- Optional `from` / `to` range validated.
- Workspace-scoped persisted records only.
- No AI inference.
- No cross-workspace reads.

Returned fields:

- `requestCount`
- `bookedRequestCount`
- `conversionRateBps`
- `collectedMinor`
- `outstandingMinor`
- `currency`
- `scheduledServiceMinutes`
- `scheduledBufferMinutes`
- `openAttentionCount`
- `unresolvedQualityCount`
- `generatedAt`

### Platform billing separation

Added platform-owned persistence:

- `platform_subscriptions`
- `platform_subscription_ledger`

Implemented trusted `servicedesk_apply_verified_platform_subscription(jsonb)`.

Rules:

- Normalized provider-verified evidence only.
- Provider event idempotency.
- Updates platform subscription only.
- Appends platform subscription ledger only.
- Rejects V1 Stripe/payment `LIVE` mode under current owner policy.
- Does not mutate customer `invoices`.
- Does not mutate customer `ledger_entries`.
- Does not mutate `verified_payment_applications`.
- Platform `PAST_DUE` / `CANCELLED` affects platform entitlement state only, not cleaning invoice state.

### Usage enforcement

Added server-side usage persistence:

- `workspace_usage_counters`
- `workspace_usage_limits`

Implemented trusted boundaries:

- `servicedesk_check_usage(jsonb)`
- `servicedesk_consume_usage(jsonb)`

Rules:

- No commercial quotas invented in code.
- Missing limit row means `UNLIMITED`.
- `used + requested > limit` returns `USAGE_LIMIT_REACHED` before protected mutation.
- OUTBOUND_MESSAGES usage is consumed atomically inside authoritative `servicedesk_enqueue_conversation_reply(jsonb)`.
- Over-limit reply creates no message and no outbox event.

### Platform billing snapshot

Implemented trusted `servicedesk_read_platform_billing_snapshot(jsonb)`.

Rules:

- OWNER only.
- Returns `PlatformSubscriptionDTO` and `UsageMetricDTO[]`.
- If no subscription exists, server bootstraps deterministic V1 `TRIAL` / `SANDBOX` row.
- Product layer is not expected to fabricate subscription state.

### Owner settings snapshot

Implemented trusted `servicedesk_read_owner_settings_snapshot(jsonb)`.

Rules:

- OWNER only.
- Maps `service_catalog` to `{ code, label, enabled }`.
- Maps `memberships` to team member DTOs.
- Maps `invitations` to `{ id, role, state, createdAt }`.
- Does not expose `token_hash`.
- Does not expose provider credentials or secrets.

### Adapter

Added `src/server/core/reporting-platform-postgres.ts` for typed Supabase RPC adapters:

- `readReportingSnapshot`
- `readPlatformBillingSnapshot`
- `readOwnerSettingsSnapshot`

## Staging migrations applied

Applied to ServiceDesk staging only:

```text
project_id=cpmmgivhlkfbiwzhlcey
migration=sd_0014_reporting_platform_usage
success=true

project_id=cpmmgivhlkfbiwzhlcey
migration=sd_0014a_conversation_reply_usage_gate
success=true
```

No Booking/CMS/other Supabase project was touched.

## Real ServiceDesk staging proof

Executed against `cpmmgivhlkfbiwzhlcey` with rollback-safe fixtures.

Observed proof coverage:

- workspace A reporting excludes workspace B;
- OWNER/DISPATCHER reporting allowed;
- CREW reporting denied;
- cross-workspace reporting denied;
- platform sandbox event applied once;
- duplicate provider event idempotent;
- attempted LIVE Stripe platform event rejected;
- platform event left customer invoice unchanged;
- platform event left customer ledger unchanged;
- platform event left verified payment applications unchanged;
- platform event did not appear as collected cleaning revenue;
- unlimited usage with no limit row;
- configured OUTBOUND_MESSAGES limit;
- within-limit reply consumed usage and created one message/outbox;
- exceeded limit blocked before message/outbox mutation;
- billing snapshot returned platform subscription + usage metrics;
- owner settings snapshot returned services/members/invitations;
- invitation `token_hash` was not present in snapshot output;
- two-workspace isolation proved;
- forced outbox failure rolled back usage and reply mutation;
- proof fixtures cleaned.

Proof result:

```text
REPORTING_DB_PROOF=PASS
PLATFORM_BILLING_SEPARATION=PASS
USAGE_ENFORCEMENT=PASS
remaining_fixture_workspaces=0
remaining_fixture_auth_users=0
```

## RPC privilege proof

Checked RPC privileges after migrations.

Observed for:

- `servicedesk_apply_verified_platform_subscription`
- `servicedesk_check_usage`
- `servicedesk_consume_usage`
- `servicedesk_enqueue_conversation_reply`
- `servicedesk_read_reporting_snapshot`
- `servicedesk_read_platform_billing_snapshot`
- `servicedesk_read_owner_settings_snapshot`

Result:

```text
security_definer=false
anon_execute=false
authenticated_execute=false
service_role_execute=true
```

## Security advisor

Advisor status: `FINDINGS`.

Remaining findings are known pre-existing items:

- `public.invitations` has RLS enabled but no policy;
- `citext` extension is installed in public;
- `public.has_active_membership(...)` SECURITY DEFINER helper callable by authenticated;
- `public.is_customer_for_workspace(...)` SECURITY DEFINER helper callable by authenticated.

No new E09 command RPC exposure was observed.

## Runtime gate

Canonical package install/typecheck/Vitest execution did not run because this tool surface does not provide GPT Runtime checkout/package execution. Coordinator policy forbids samai/samvr/local-device fallback.

Therefore:

```text
STATE=OPERATIONS_VERIFIED
CANONICAL_GATE=CONFIGURATION_BLOCKED
```

## Final status

```text
WORKER=1
SPRINT=V1-INT9
FINAL_SHA=<remote-head-after-receipt>
REMOTE_HEAD_ADVANCED=YES
RECEIPT_REMOTE=YES
STATE=OPERATIONS_VERIFIED
CANONICAL_GATE=CONFIGURATION_BLOCKED
REPORTING_DB_PROOF=PASS
PLATFORM_BILLING_SEPARATION=PASS
USAGE_ENFORCEMENT=PASS
PROOF_FIXTURES_CLEANED=YES
READY_NEXT=E10 final integrated journey and operations packet
```
