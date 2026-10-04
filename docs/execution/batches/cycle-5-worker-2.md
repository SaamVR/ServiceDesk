# ServiceDesk AI — Cycle 5 Worker 2 / Connectors & AI — Long-Run WhatsApp Safety Batch

Branch: `feat/servicedesk-v1-connectors`
Expected previous HEAD: `cd702409b15ac659d2296aa3c5e00bdbacfe5f93`

Read:
- `AGENTS.md`
- `docs/execution/runtime-outage-mode-20261004.md`
- `docs/execution/high-throughput-mode-v2-20261004.md`
- this packet

Do one quick normal-runtime probe. If canonical package access remains unavailable, enter outage mode immediately.

## Completion quota

Complete at least FIVE substantive slices before receipt unless all remaining authorized work is genuinely blocked. If READY finishes, continue FALLBACK automatically.

Prefer 2–3 grouped implementation commits plus one compact receipt.

## READY queue

### CYCLE-5-W2-T1 — Acceptance receipt duplicate/conflict identity

Current:
- `src/server/integrations/whatsapp/acceptance-receipt.ts`
- `tests/providers/whatsapp-acceptance-receipt.test.ts`

`mergeWhatsAppAcceptanceReceipt(...)` currently treats any candidate with the same receiptKey as DUPLICATE even when providerMessageId or acceptance identity differs.

Harden:
- same receiptKey + same providerMessageId + equivalent acceptance identity => DUPLICATE;
- same receiptKey + different providerMessageId, outboxJobId, or outboxIdempotencyKey => CONFLICT;
- no existing receipt => RECORDED.

Do not upgrade acceptance evidence to delivery/read proof.

### CYCLE-5-W2-T2 — Outbound policy blank identity/content fail-closed

Current:
- `src/server/integrations/whatsapp/outbound-policy.ts`
- `tests/providers/whatsapp-outbound-policy.test.ts`

Harden `prepareWhatsAppDispatch(...)`:
- whitespace-only idempotencyKey is missing;
- outside service window, whitespace-only templateKey is missing;
- inside service window, if neither a nonblank freeformText nor a nonblank templateKey is available, reject with a typed content-required failure;
- preserve suppression, tenant, channel and customer-window behavior.

### CYCLE-5-W2-T3 — Template registry structural validation

Current:
- `src/server/integrations/whatsapp/template-registry.ts`
- `tests/providers/whatsapp-template-registry.test.ts`

Before an APPROVED entry is accepted, require nonblank:
- templateKey;
- providerTemplateName;
- locale.

Reject malformed configured entries with typed Result failures.

Preserve purpose/locale/status semantics and keep verification at CONTRACT_TESTED only.

### CYCLE-5-W2-T4 — Media retrieval configuration/URL/size safety

Current:
- `src/server/integrations/whatsapp/media.ts`
- `tests/providers/whatsapp-media-retrieval.test.ts`
- `tests/providers/whatsapp-media-scope.test.ts`

Harden:
- maxBytes must be a positive finite integer;
- allowedMimeTypes must contain at least one nonblank normalized MIME;
- metadata file_size must be finite and >=0;
- provider download URL must parse successfully and use HTTPS;
- negative/NaN content-length must not become trusted size evidence;
- actual byte length remains authoritative for max-size rejection.

Do not broaden allowed MIME types or fetch scope.

### CYCLE-5-W2-T5 — Outbound queued/latest immutable identity

Current:
- `src/server/integrations/whatsapp/outbound-dispatcher.ts`
- `tests/providers/whatsapp-outbound-dispatcher.test.ts`

After loading latest outbox state, fail closed if the queued job and latest job disagree on immutable dispatch identity:
- id;
- workspaceId;
- channel;
- purpose;
- idempotencyKey;
- recipient.recipientRef.

Conversation-version and handover suppression checks still apply.

No provider call or acceptance record after an identity mismatch.

### CYCLE-5-W2-T6 — Combined WhatsApp outage harness

Add:
- `tests/providers/runtime-outage-whatsapp-safety-harness.ts`

Use Node assert and exact changed modules.

Cover:
- receipt true duplicate vs conflict;
- blank idempotency/template/content rejection;
- malformed APPROVED template rejection;
- invalid maxBytes/MIME/download URL/file size rejection;
- queued/latest identity mismatch prevents send;
- valid representative cases still pass.

Run with global `ts-node --transpile-only`.

## FALLBACK queue

F1. Harden `src/server/integrations/whatsapp/status-failure.ts` redaction for `Bearer <token>` and common authorization-token fragments without exposing raw provider payload.

F2. Add dispatcher regression proving provider-account workspace mismatch and blank phoneNumberId both fail before HTTP send.

F3. Add template regression proving CONFIGURED is not treated as APPROVED even in LIVE mode.

## Canonical gate

If pnpm recovers: focused WhatsApp tests → full `tests/providers` → `tests/ai` → typecheck.

Otherwise outage harness PASS supports only `IMPLEMENTED`; canonical gate stays `CONFIGURATION_BLOCKED`; no PROVIDER_VERIFIED claim.

## Receipt

Write compact:
`docs/execution/receipts/worker-2-cycle-5.md`

Include completed slice IDs and READY_NEXT only; do not reproduce source or packet text.
