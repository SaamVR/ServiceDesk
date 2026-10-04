# ServiceDesk V1 Controlled Provider Proof Runbooks

These runbooks describe the evidence required to promote provider operations. Do not paste credentials, access tokens, signing secrets, raw customer data, raw provider responses, or unredacted receipts into the repository.

## Shared proof manifest requirements

Every controlled proof manifest must bind provider, operation, mode, build SHA, capturedAt, redacted provider receipt/reference, and PASS/FAIL result. A manifest is rejected if it is stale, buildless, mismatched, or secret-bearing.

## WhatsApp

Controlled operations: outbound send, inbound callback, and status callback. Required setup: Meta app/account IDs, app secret signature validation, access token, controlled sender/recipient, callback URL, verify token, and durable receipt/Core handoff. Capture only redacted message/status IDs and the build SHA.

## Google Calendar

Controlled operations: freebusy, visit upsert, visit cancel, and reconciliation. Required setup: OAuth client, redirect URI, refresh token/test account, test calendar, freebusy/events scopes, and fresh sync state. Google Calendar events are evidence/mapping only; ServiceDesk VisitDTO remains authoritative.

## Email

Controlled operations: send, delivered callback, soft bounce, hard bounce, and complaint. Required setup: provider account/API key reference, verified sender/domain, callback signing/auth, and controlled recipient. Store only minimized callback receipt fields and redacted recipient references.

## Webhook/n8n

Controlled operations: signed webhook delivery, n8n pending/completion callback, and retry/recovery. Required setup: authoritative endpoint, signing-secret reference, allowed host, n8n workflow ID, and completion callback mapping. n8n pending is not delivered.

## AI

Controlled operations: model health and extraction boundary. Required setup: configured model/provider key reference, model health check, model contract proof, and no-business-authority boundary. AI output cannot mutate booking, pricing, payment, or provider truth directly.

## Stripe sandbox payment

Controlled operations: sandbox checkout, signed sandbox webhook, duplicate/idempotency, and invoice allocation evidence. Current owner policy is SANDBOX/DEMO only. Never label Stripe evidence as LIVE or live PROVIDER_VERIFIED under the current policy.
