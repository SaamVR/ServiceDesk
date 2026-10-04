# ServiceDesk AI — Cycle 6 Worker 2 / Connectors & AI — Backup: WhatsApp Transport & Recovery Hygiene

Planned branch: `feat/servicedesk-v1-connectors`
Activation rule: coordinator refreshes expected HEAD to Worker 2 Cycle 5 final before dispatch.

Read fast-start docs + this packet. One normal recovery probe only; use outage mode if canonical access remains blocked.

## Completion quota
Complete at least FIVE substantive slices unless all remaining work is genuinely blocked. Use grouped commits and compact receipt.

## READY queue

### CYCLE-6-W2-T1 — Cloud API configuration validation
Files:
- `src/server/integrations/whatsapp/cloud-api.ts`
- `tests/providers/whatsapp-cloud-api.test.ts`

Fail closed before transport when:
- graphBaseUrl is invalid or not HTTPS;
- apiVersion is blank after trim;
- phoneNumberId is blank after trim;
- accessToken is blank after trim;
- timeoutMs, when provided, is non-finite, non-positive or non-integer.

Preserve the current upper/lower timeout clamp for valid values.

### CYCLE-6-W2-T2 — Provider acceptance identity normalization
In `sendWhatsAppCloudMessage(...)`:
- trim provider message ID returned from the provider;
- reject whitespace-only IDs;
- return the normalized trimmed ID.

Add regression proving stable downstream identity.

### CYCLE-6-W2-T3 — Configured adapter timestamp/evidence hygiene
Files:
- `src/server/integrations/whatsapp/configured-adapter.ts`
- `tests/providers/whatsapp-configured-cloud-adapter.test.ts`

Require acceptedAt source (`config.now()` or `meta.now`) to be a valid timestamp before creating evidence.
Do not emit malformed evidence timestamps.

Ensure evidence never includes accessToken, recipientRef, free-form body or raw provider payload.

### CYCLE-6-W2-T4 — Failure metadata redaction expansion
Files:
- `src/server/integrations/whatsapp/status-failure.ts`
- `tests/providers/whatsapp-status-failure-metadata.test.ts`

Redact secrets/PII from BOTH errorTitle and errorDetails:
- `Bearer <token>`;
- access_token query fragments;
- token key/value fragments;
- phone-number-like values already covered.

Do not include rawProviderEvent.

### CYCLE-6-W2-T5 — Recovery note redaction
Files:
- `src/server/integrations/whatsapp/status-recovery.ts`
- `tests/providers/whatsapp-status-recovery-bridge.test.ts`

Recovery notes currently interpolate raw detail.
Sanitize detail before building retry/operator-review notes using the same redaction semantics as failure metadata.
No token/phone/raw payload fragment may appear in recovery records.

Preserve deterministic idempotency keys and business-truth=false semantics.

### CYCLE-6-W2-T6 — Failure classification invariants
Extend Cloud API tests so:
- configuration errors are terminal/non-retryable/configurationBlocked;
- rate-limit/server/timeout/network remain retryable;
- malformed response/invalid request remain terminal/non-retryable;
- no classification serializes sensitive provider response bodies.

### CYCLE-6-W2-T7 — Combined outage harness
Add:
- `tests/providers/runtime-outage-whatsapp-transport-harness.ts`

Cover invalid config, normalized provider ID, invalid evidence time, failure redaction, recovery redaction, and retry-policy classification with real changed modules.

## FALLBACK
F1. Ensure whitespace-only template language override fails cleanly before provider call.
F2. Ensure mediaId/freeform body selection cannot send a whitespace-only media ID.
F3. Add evidence-summary regression proving graph host extraction never includes credentials/userinfo.

## Proof
Outage harness PASS => IMPLEMENTED. No PROVIDER_VERIFIED. Canonical provider/AI/typecheck gate remains blocked until pnpm access returns.

## Receipt
`docs/execution/receipts/worker-2-cycle-6.md`
