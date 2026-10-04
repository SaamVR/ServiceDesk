# ServiceDesk AI V1 Provider Operations Checklist

Status: Chat 2 connector-lane checklist. This document does not verify any provider by itself.

## Evidence labels

- `CONTRACT_TESTED`: fixture, mocked, static, or code-level adapter proof only.
- `CONFIGURATION_BLOCKED`: required provider configuration or controlled proof artifact is missing.
- `PROVIDER_VERIFIED`: controlled provider account/resource produced a redacted, reproducible receipt/event and the callback or delivery path was verified.

Never mark `PROVIDER_VERIFIED` from fixture tests, generated examples, local screenshots without controlled IDs, or operator expectation.

## Global proof rules

For every provider proof packet, capture:

1. Provider name and mode.
2. Workspace ID used for the controlled proof.
3. Controlled resource or recipient.
4. Redacted provider account/reference ID.
5. Redacted receipt/event/execution ID.
6. Raw callback signature verification result where callbacks exist.
7. Exact timestamp.
8. Operator attestation.
9. Expected business effect and actual observed effect.
10. Explicit statement that no customer data or production credential was printed.

## WhatsApp

Required configuration:

- Meta app secret.
- Webhook verify token.
- WABA/business account.
- Phone-number ID mapped to workspace.
- Approved templates.
- Controlled opted-in recipient.

Minimum proof:

- Webhook challenge verification.
- Signed inbound message callback with controlled message ID.
- Outbound template or in-window message accepted by Meta.
- Status callback observed separately for provider acceptance/delivery/read/failure.

Provider acceptance is not recipient delivery/read.

## Google Calendar

Required configuration:

- OAuth client.
- Redirect URI.
- Refresh token.
- Selected calendar mapped to crew/workspace.
- Controlled calendar.

Minimum proof:

- Free/busy query over controlled calendar returns expected external busy block.
- Create/update event maps to one controlled provider event ID.
- Cancel removes or cancels the controlled event.
- Expired/stale sync recovery is recorded without mutating appointment truth.

## Payments

Required configuration:

- Sandbox provider account.
- Webhook secret.
- Checkout success and cancel URLs.
- Controlled receipt/checkout session.

Minimum proof:

- Checkout created from server-derived quote/hold only.
- Signed callback verified over raw body.
- Account, amount, currency, purpose, and workspace metadata matched.
- Duplicate and out-of-order callbacks acknowledged without duplicate business mutation.

## Email

Required configuration:

- Verified sender/domain.
- Sender address.
- Bounce/complaint webhook secret.
- Controlled recipient.

Minimum proof:

- Transactional message accepted by provider for controlled recipient.
- Bounce callback suppresses future send attempts.
- Complaint callback suppresses future send attempts.
- Delivery callback does not create suppression.

## Outbound webhook and n8n

Required configuration:

- Receiver endpoint URL.
- Signing secret.
- Controlled receiver.
- n8n workflow ID, if n8n is used.

Minimum proof:

- ServiceDesk signed webhook is accepted by controlled receiver.
- Receiver verifies timestamp and HMAC signature.
- n8n execution ID is captured.
- n8n output receipt is redacted.
- Retry/final-failure behavior is observed for a controlled failure.

Webhook/n8n receipts prove delivery to automation only. They do not mutate booking, invoice, visit, or payment truth.

## AI provider

Required configuration:

- Model API key.
- Approved knowledge index.
- Tool allowlist.

Minimum proof:

- Intake extraction produces structured fields from controlled conversation.
- Approved-knowledge answer includes citation metadata.
- Unsupported or injection-like prompt routes to human handover.
- AI does not price, confirm availability, collect payment, or mutate business truth directly.

## Final gate before integration

Before controller integration, report:

- Branch and commit SHA.
- Tests executed and exact result.
- Provider status per provider.
- Missing configuration per provider.
- Any callback/retry/idempotency evidence.
- Any reason a provider must remain `CONFIGURATION_BLOCKED`.
