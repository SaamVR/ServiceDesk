# V1 Integration Sprint 7 — Worker 2 / E08 Email + Webhook Operational Closure

Branch: `feat/servicedesk-v1-connectors-sprint7`
Exact base: `fa9568970c012550149a0093360e68bbdaa69e62`

Read:
- AGENTS.md
- docs/execution/provider-access-policy-20261004.md
- this packet

## Mission
Close the existing Email/Webhook/n8n operational seams. Do not add new provider families.

### T1 — transactional email authoritative intent
Harden the existing email outbox dispatcher/source boundary for:
- QUOTE
- CONFIRMATION
- REMINDER / VISIT_REMINDER
- INVOICE
- FEEDBACK
- CUSTOMER_REPLY

Body, recipient, subject/template and consent must come from an injected authoritative resolver, not untrusted outbox payload.

Preserve idempotency.

### T2 — email provider callback boundary
Create a stable normalized callback bridge using existing email lifecycle/policy.

Handle:
- DELIVERED;
- soft bounce;
- hard bounce;
- complaint;
- duplicate callback;
- out-of-order callback.

Emit injected command shapes for:
- message delivery-state update;
- recipient suppression review/update.

Connector does not mutate Core business tables directly.

Provider accepted != delivered.

### T3 — durable email callback receipt adapter
Add an injected trusted technical receipt gateway/store adapter.

Persist only:
- callback key;
- provider message ID;
- event type/bounce class;
- occurredAt;
- redacted recipient reference;
- processed state/link.

Never raw email body/provider secret.

Duplicate receipt must still permit safe Core reconciliation after previous Core failure.

### T4 — webhook authoritative destination resolver
Harden signed webhook execution so endpoint URL, signing-secret reference, allowed host and workflow linkage come only from authoritative server configuration resolver.

Never trust endpoint/signing secret from event payload.

Keep HTTPS + allowlist validation.

### T5 — webhook/n8n delivery receipt bridge
Unify existing:
- webhook receipt;
- n8n linkage;
- recovery queue.

Requirements:
- delivered is terminal/idempotent;
- transient failure -> E04 retry;
- final failure -> attention/recovery command shape;
- n8n pending completion remains explicit, not delivered;
- provider response excerpt redacted;
- receipt identity stable.

### T6 — recovery closure
Map Email/Webhook failure codes into existing provider recovery policy.
No nested retry loops; E04 remains retry owner.

Configuration/auth -> CONFIGURATION_BLOCKED.
Network/rate/5xx -> retryable.
Permanent bounce/complaint -> suppression/final.
Webhook invalid destination -> final/config review.

### T7 — controlled-provider readiness
Add readiness reports/checks listing exact missing config for Email and Webhook/n8n.

Do not request credentials during implementation.
If all code is complete and only controlled proof remains, return:
- EMAIL_PROVIDER_ACCESS_REQUIRED
- N8N_WEBHOOK_ENDPOINT_REQUIRED
as applicable.

### T8 — harness/tests
Package-free harness covers:
- authoritative email intent;
- delivered/soft/hard/complaint;
- duplicate callback after prior Core failure;
- suppression;
- authoritative webhook endpoint resolution;
- signature execution;
- 2xx/429/5xx/final 4xx;
- n8n pending completion;
- redaction;
- idempotency.

Canonical tests authored.

Receipt:
`docs/execution/receipts/v1-int7-worker-2.md`

Return:
WORKER=2
SPRINT=V1-INT7
FINAL_SHA=<sha>
STATE=<IMPLEMENTED|CONTRACT_TESTED|BLOCKED>
CANONICAL_GATE=<state>
EMAIL_OPERATIONAL_BRIDGE=<PASS|FAIL>
WEBHOOK_OPERATIONAL_BRIDGE=<PASS|FAIL>
LIVE_PROVIDER_GATE=<NOT_READY|EMAIL_PROVIDER_ACCESS_REQUIRED|N8N_WEBHOOK_ENDPOINT_REQUIRED|MULTIPLE_REQUIRED>
BLOCKERS=<exact blockers>
READY_NEXT=E09 provider readiness/reporting closure
