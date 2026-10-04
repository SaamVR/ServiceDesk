# V1 Integration Sprint 8 — Worker 2 / E09 Provider Readiness + Evidence Closure

Branch: `feat/servicedesk-v1-connectors-sprint8`
Exact base: `a8711c1bffda3cd52cf9938f87ce8546ba7bef1d`

Read:
- AGENTS.md
- docs/execution/provider-access-policy-20261004.md
- this packet

## Mission
Turn the broad Connector implementation into one honest, machine-readable V1 readiness/evidence surface. Do not add provider features.

Provider families in V1:
- WHATSAPP
- GOOGLE_CALENDAR
- PAYMENT
- EMAIL
- WEBHOOK/n8n
- AI

Stripe PAYMENT remains SANDBOX/DEMO only by owner policy and must never be reported as live-provider verified.

### T1 — unified provider readiness registry
Build one authoritative Connector-owned readiness aggregator over existing readiness/configuration modules.

For each provider return:
- provider;
- mode FIXTURE|SANDBOX|LIVE;
- implementation state;
- configuration state;
- verification state;
- missing configuration requirements;
- last evidence timestamp/reference if supplied;
- blockers;
- canRunControlledProof boolean.

Do not read secrets into this structure.

### T2 — strict evidence promotion rules
Add pure evidence state transition logic.

Allowed:
IMPLEMENTED -> CONTRACT_TESTED only with executable contract receipt.
CONTRACT_TESTED -> PROVIDER_VERIFIED only with explicit controlled provider receipt.

Never infer PROVIDER_VERIFIED from:
- configuration existing;
- HTTP 2xx fixture;
- sandbox Stripe;
- authored tests;
- stale prior receipt;
- Product status.

Provider-verified evidence must include provider, operation, capturedAt, redacted receipt/reference, and environment/mode.

### T3 — V1 provider-specific readiness
Aggregate exact requirements from existing code.

WHATSAPP:
- Meta app/account IDs
- app secret/signature validation
- access token
- controlled sender/recipient
- callback URL/verify token
- durable receipt/Core handoff.

GOOGLE_CALENDAR:
- OAuth client
- redirect URI
- refresh token/test account
- test calendar
- freebusy/events scopes
- fresh sync state.

PAYMENT:
- mark mode SANDBOX;
- official Stripe-style sandbox contract proof;
- never require live Stripe under current policy.

EMAIL:
- provider account/API key
- verified sender/domain
- callback signing/auth
- controlled recipient.

WEBHOOK/n8n:
- authoritative endpoint
- signing-secret reference
- allowlist
- n8n workflow
- completion callback mapping.

AI:
- configured model/provider key
- model health/contract
- no pricing/business authority.

### T4 — integration status projection
Add safe mapping from readiness report to `IntegrationStatusDTO[]`.

Rules:
- NOT_CONFIGURED
- CONNECTED only when configured and currently usable at its evidence level;
- DEGRADED for transient operational health issue;
- REAUTH_REQUIRED for OAuth/auth-specific gate;
- BLOCKED for deterministic missing/invalid configuration.

Expose no secret values.

Stripe/payment should show SANDBOX mode, not LIVE.

### T5 — closure report
Replace/extend existing connector closure report so it is based on per-provider evidence, not a boolean count.

Produce:
- overall implementation status;
- canonical test gate;
- live provider gate;
- blocked providers;
- missing configuration;
- verified provider operations;
- sandbox-only providers;
- explicit no-claim notes.

Do not label overall PROVIDER_VERIFIED unless every required LIVE provider operation is actually verified and sandbox-only payment policy is represented separately.

### T6 — controlled proof manifest
Add a typed proof-manifest format and validator for future controlled runs.

A receipt must bind:
- provider
- operation
- mode
- app/build SHA
- capturedAt
- redacted provider receipt/reference
- result
- no secret material.

Reject mismatched/stale/buildless manifests.

### T7 — provider proof runbooks
Create concise operational docs for controlled proof of:
- WhatsApp inbound/outbound/status;
- Google Calendar freebusy/upsert/cancel/reconciliation;
- Email send/delivery/bounce/complaint;
- n8n signed webhook/completion/retry;
- AI model health/extraction boundary;
- Stripe sandbox verification (explicitly SANDBOX).

No credentials in docs.

### T8 — harness/tests
Package-free harness covers:
- every V1 provider;
- missing config aggregation;
- sandbox Stripe cannot become live verified;
- evidence transition rules;
- stale/mismatched proof manifest rejected;
- IntegrationStatus mapping;
- overall closure calculation;
- secret redaction.

Canonical tests authored.

Receipt:
`docs/execution/receipts/v1-int8-worker-2.md`

MANDATORY remote save gate.

Return:
WORKER=2
SPRINT=V1-INT8
FINAL_SHA=<sha>
REMOTE_HEAD_ADVANCED=YES
RECEIPT_REMOTE=YES
STATE=<IMPLEMENTED|CONTRACT_TESTED|BLOCKED>
CANONICAL_GATE=<state>
PROVIDER_READINESS_REPORT=<PASS|FAIL>
EVIDENCE_PROMOTION_RULES=<PASS|FAIL>
CONTROLLED_PROOF_MANIFEST=<PASS|FAIL>
LIVE_PROVIDER_GATE=<exact providers/config still required>
BLOCKERS=<exact blockers>
READY_NEXT=E10 cross-provider journey/provider proof
