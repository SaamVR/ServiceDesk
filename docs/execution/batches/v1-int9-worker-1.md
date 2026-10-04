# V1 Integration Sprint 9 — Worker 1 / E09 Reporting + Platform Billing + Usage Core

Branch: `feat/servicedesk-v1-core-sprint8`
Exact base: `cae7eb170b97208802065b76e20cbe9f9862c0cd`
ServiceDesk Supabase staging: `cpmmgivhlkfbiwzhlcey`

Read:
- AGENTS.md
- docs/execution/provider-access-policy-20261004.md
- docs/execution/supabase-staging-proof-20261004.md
- this packet

Use frozen coordinator contracts:
- ReportingSnapshotDTO
- PlatformSubscriptionDTO
- UsageMetricDTO
- PlatformBillingSnapshotDTO
- ServiceSettingDTO
- TeamMemberDTO
- TeamInvitationDTO
- OwnerSettingsSnapshotDTO
- readReportingSnapshot(...)
- readPlatformBillingSnapshot(...)
- readOwnerSettingsSnapshot(...)

## Mission
Close E09 Core: permissioned reporting, platform-subscription separation, and server-side usage enforcement.

Customer cleaning invoices/ledger must remain completely separate from ServiceDesk platform billing.

Use only ServiceDesk staging.

### T1 — E09 persistence
Add:
`supabase/migrations/0014_reporting_platform_usage.sql`

Create platform-owned tables:

`platform_subscriptions`
- workspace_id primary/composite scope
- plan TRIAL|STARTER|GROWTH
- status TRIALING|ACTIVE|PAST_DUE|CANCELLED
- provider_mode SANDBOX|LIVE
- trial_ends_at
- current_period_ends_at
- version
- updated_at

`platform_subscription_ledger`
- id/workspace
- provider
- provider_event_id
- event_kind
- plan/status
- amount_minor optional
- currency optional
- occurred_at
- created_at
- unique provider-event identity
- no FK to customer invoices.

`workspace_usage_counters`
- workspace
- metric AI_ACTIONS|OUTBOUND_MESSAGES|TEAM_MEMBERS|CONNECTED_INTEGRATIONS
- period_start/period_end
- used
- updated_at
- unique workspace/metric/period.

`workspace_usage_limits`
- workspace
- metric
- optional limit_value
- created/updated
- no invented commercial limits in code.
- absent limit means UNLIMITED.

Trusted server writes only.

### T2 — verified platform-subscription application
Implement trusted atomic RPC:
`servicedesk_apply_verified_platform_subscription(jsonb)`

Input is already provider-verified normalized platform billing evidence.

Current owner policy:
PAYMENT/Stripe platform proof is SANDBOX/DEMO only.

For V1 this RPC must reject a claim that tries to mark the Stripe/payment provider as LIVE unless coordinator policy changes.

Rules:
- provider event idempotency;
- update platform_subscriptions;
- append platform_subscription_ledger;
- never touch customer `invoices`;
- never touch customer `ledger_entries`;
- never touch `verified_payment_applications`;
- PAST_DUE/CANCELLED changes platform entitlement only;
- customer cleaning invoice state remains unchanged.

No provider call from Core.

### T3 — usage enforcement
Implement trusted helpers/RPCs:
- read/check workspace usage;
- atomically consume usage when a bounded server operation is accepted.

No hard-coded commercial plan quotas.

Limit source:
`workspace_usage_limits`.

If no limit row: UNLIMITED.
If used + requested > limit: return USAGE_LIMIT_REACHED before business mutation.

Integrate OUTBOUND_MESSAGES consumption into the authoritative `servicedesk_enqueue_conversation_reply` transaction so limit rejection occurs before message/outbox mutation.

Expose a trusted generic check/consume boundary for later AI/integration callers without importing Connector code.

TEAM_MEMBERS and CONNECTED_INTEGRATIONS may be reported even where their mutation command is outside current Core scope; do not invent provider configuration rows.

### T4 — reporting snapshot
Implement:
`servicedesk_read_reporting_snapshot(jsonb)`
and typed adapter/facade.

OWNER/DISPATCHER only.
CUSTOMER/CREW/VISITOR denied.

Optional from/to timestamps validated.

Return authoritative workspace-scoped aggregates:
- requestCount
- bookedRequestCount
- conversionRateBps
- collectedMinor
- outstandingMinor
- workspace currency
- scheduledServiceMinutes
- scheduledBufferMinutes
- openAttentionCount
- unresolvedQualityCount
- generatedAt

Use persisted records only.
No AI inference.
No cross-workspace rows.

### T5 — platform billing snapshot
Implement:
`servicedesk_read_platform_billing_snapshot(jsonb)`

OWNER only.

Return:
- platform subscription
- usage metrics + limits/states.

Platform state is not customer invoice state.

If no platform subscription row exists, create/backfill a deterministic V1 TRIAL/SANDBOX state through migration/server-owned bootstrap rather than Product fabrication.

### T6 — owner settings snapshot
Implement:
`servicedesk_read_owner_settings_snapshot(jsonb)`

OWNER only.

Map real:
- service_catalog -> ServiceSettingDTO {code,name->label,active->enabled}
- memberships -> TeamMemberDTO
- invitations -> TeamInvitationDTO state derived from accepted_at/revoked_at/expiry/pending rules.

Do not expose:
- invitation token_hash
- secrets
- provider credentials
- customer data.

### T7 — subscription entitlement separation
Bridge existing subscription entitlement semantics into Core-safe pure logic if needed, but do not import Connector repositories.

Prove:
- platform PAST_DUE may disable platform AI/integration entitlement;
- it can never mark a cleaning invoice PAID/VOID;
- platform payment ledger never appears as customer collected revenue.

### T8 — real staging proof
Apply 0014 only to `cpmmgivhlkfbiwzhlcey`.

Prove:
- workspace A reporting excludes B;
- OWNER/DISPATCHER reporting allowed;
- customer/crew reporting denied;
- platform subscription sandbox event applied once;
- duplicate event idempotent;
- attempted LIVE Stripe/platform event rejected under current policy;
- platform subscription update does not mutate customer invoice/ledger;
- usage unlimited without limit row;
- configured OUTBOUND_MESSAGES limit enforced before reply mutation;
- within-limit reply consumes one usage and creates message/outbox;
- over-limit reply creates neither;
- billing snapshot;
- owner settings snapshot;
- token_hash/secrets absent;
- two-workspace isolation;
- forced failure rollback;
- cleanup.

Run security advisor and RPC privilege checks.

### T9 — tests/save
Package-free harness + canonical tests authored.
Receipt:
`docs/execution/receipts/v1-int9-worker-1.md`

MANDATORY remote save gate.

Return:
WORKER=1
SPRINT=V1-INT9
FINAL_SHA=<sha>
REMOTE_HEAD_ADVANCED=YES
RECEIPT_REMOTE=YES
STATE=<IMPLEMENTED|CONTRACT_TESTED|OPERATIONS_VERIFIED|BLOCKED>
CANONICAL_GATE=<state>
REPORTING_DB_PROOF=<PASS|FAIL>
PLATFORM_BILLING_SEPARATION=<PASS|FAIL>
USAGE_ENFORCEMENT=<PASS|FAIL>
PROOF_FIXTURES_CLEANED=<YES|NO>
BLOCKERS=<exact blockers>
READY_NEXT=E10 final integrated journey and operations packet
