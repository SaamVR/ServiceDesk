# ServiceDesk AI Connector Lane — Run 3 Checkpoint

Run: WhatsApp Outbound Dispatcher + Template/Handover Race Safety
Branch: `feat/servicedesk-v1-connectors`
Start HEAD: `4d3af25dd0c477524dd072edbb1302ab09f817f0`
Checkpoint HEAD: `ce38fed1f557d0c9568b7f3e46a96e2547e504d4`
Integration branch observed earlier: `feat/servicedesk-v1-integrate`

## Scope

Run 3 added the connector-owned outbound dispatch seam above the existing WhatsApp policy and configured Cloud adapter.

The dispatch path is still `CONTRACT_TESTED` only. It does not claim Meta provider verification.

## Commits in this run

- `be4ff4feb733731766744874ae76fb9ef8e4f80f` — `test(whatsapp): define outbound dispatcher recheck contract`
- `a07b775e924d2703ed1d1dad5008e352fee5fcc4` — `feat(whatsapp): add outbound dispatcher recheck seam`
- `748b69c82a7b0f67c3ff1dd8f878ca7b3799c70c` — `fix(whatsapp): normalize missing template dispatch error`
- `5093432753c40b6eac4f81ecf70ea3ca52857647` — `feat(integrations): export WhatsApp outbound dispatcher`
- `e9cbdd6075b522e81f65b5c3f94e7395164b2bb9` — `test(whatsapp): define template registry boundary`
- `7d9a65472def585e0607dce85505873686660455` — `feat(whatsapp): add template registry boundary`
- `f9533dfd2c8446828294a83ada5cbacf7ace5f01` — `feat(whatsapp): enforce template registry in dispatcher`
- `8585f504c29b235cbc0f868267f1daf27a0c8d9e` — `test(whatsapp): cover stale version and provider account race guards`
- `a542e71a5deb89340dfdc197a32acd00a310bbb9` — `feat(integrations): export WhatsApp template registry`
- `85e509f1e2cc9f44d3406825d500427dbc648b60` — `test(whatsapp): define provider acceptance receipt contract`
- `08b965d5321c43fb04184bf6f3150ccedb66d300` — `feat(whatsapp): add provider acceptance receipt primitive`
- `ce38fed1f557d0c9568b7f3e46a96e2547e504d4` — `feat(integrations): export WhatsApp acceptance receipts`

## Files added

- `src/server/integrations/whatsapp/outbound-dispatcher.ts`
- `src/server/integrations/whatsapp/template-registry.ts`
- `src/server/integrations/whatsapp/acceptance-receipt.ts`
- `tests/providers/whatsapp-outbound-dispatcher.test.ts`
- `tests/providers/whatsapp-template-registry.test.ts`
- `tests/providers/whatsapp-acceptance-receipt.test.ts`

## Files updated

- `src/server/integrations/index.ts`

## Behavior implemented

### Outbound dispatcher

- Loads the latest outbox job immediately before provider call.
- Re-runs `prepareWhatsAppDispatch` at dispatch time.
- Suppresses sends if latest recipient policy/handover now blocks send.
- Blocks stale queued conversation versions.
- Loads provider account at dispatch time.
- Blocks missing provider account and provider account workspace mismatch before provider call.
- Enforces template registry approval for outside-window sends.
- Uses existing configured WhatsApp Cloud adapter for provider request creation.
- Records provider acceptance through an idempotent store boundary.
- Returns `PROVIDER_ACCEPTANCE_ONLY`, never delivered/read proof.

### Template registry

- Models template key, provider template name, locale, purpose, status, mode, captured timestamp.
- Only `APPROVED` and purpose/locale-matching templates may dispatch.
- `CONFIGURED`, `MISSING`, `DISABLED`, purpose mismatch, and locale mismatch return typed failures.
- Evidence remains `CONTRACT_TESTED` and notes that registry configuration does not prove Meta approval.

### Acceptance receipt

- Builds one logical provider-acceptance receipt from workspace + outbox idempotency key.
- Preserves provider message id, accepted timestamp, evidence and mode.
- Explicitly sets `deliverySemantics=PROVIDER_ACCEPTANCE_ONLY`.
- Explicitly sets `deliveryProof=false` and `readProof=false`.
- Duplicate merge preserves the original receipt.
- Conflicting idempotency key returns conflict.

## Verification

Full test/typecheck was not run in this cycle.

Runtime blocker remains:

`CONNECTOR_TEST_ENV_BLOCKED_ENOSPC`

Known device state from previous checks:

- `samai`: Node 22 and pnpm available, but disk full. During Run 2 it failed even `git fetch` with `No space left on device`.
- `samvr`: node/pnpm unavailable and disk low.

No provider proof was performed.

## Provider proof state

- WhatsApp Cloud API: `CONTRACT_TESTED` only.
- Meta provider verification: `CONFIGURATION_BLOCKED`.
- No live/sandbox outbound traffic was sent.
- No customer data or production credentials were touched.

## Remaining blocker for PROVIDER_VERIFIED

WhatsApp provider verification still requires:

1. Authorized Meta app and WhatsApp Business Account.
2. Controlled sender phone-number ID mapped to one workspace.
3. App secret and verify token stored in environment secrets.
4. Subscribed messages/status webhooks.
5. Consenting controlled recipient.
6. Approved Meta templates for outside-window sends.
7. Controlled inbound/outbound/status evidence.

## Next READY task

Proceed to:

`Run 4 — WhatsApp Delivery Status State Machine`

Recommended first tasks:

1. Connect/align `status-transition.ts` and `whatsapp/status.ts` so there is one canonical callback state transition model.
2. Add duplicate and out-of-order callback tests across signed batch callbacks.
3. Normalize provider failure metadata without leaking raw payloads or secrets.
4. Add recovery bridge behavior for retryable status persistence failures and permanent delivery failure attention/recovery records.
5. Continue to avoid any `PROVIDER_VERIFIED` claim until real Meta proof exists.
