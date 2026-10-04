# V1-INT9 External Access Packet — Controlled Provider Proof

Purpose: collect the smallest owner/operator access needed to run controlled provider proof for the accepted V1 build. Do not paste credentials, secrets, tokens, raw customer data, or unredacted provider payloads into this repository or chat transcript.

Accepted build for this packet: `cae7eb170b97208802065b76e20cbe9f9862c0cd`.

## WhatsApp

Required owner/operator actions:
- provide configured Meta app/account IDs;
- provide server-side secret references for app secret/signature validation and access token;
- provide one controlled sender and one controlled recipient;
- confirm callback URL and verify-token reference;
- run inbound webhook, outbound accepted, and delivery/read/failure callback proof.

Do not provide raw access tokens or customer messages.

## Google Calendar

Required owner/operator actions:
- provide OAuth client and redirect URI configuration by secret reference;
- provide test account/refresh-token reference;
- provide one test calendar and required freebusy/events scopes;
- ensure fresh sync state;
- run freebusy, visit upsert, cancellation, and reconciliation/external-edit review proof.

Google event IDs are evidence/mapping only. ServiceDesk VisitDTO remains authoritative.

## Email

Required owner/operator actions:
- provide transactional email provider account/API key reference;
- provide verified sender/domain;
- provide callback signing/auth reference;
- provide controlled recipient;
- run send accepted, delivered callback, bounce, and complaint proof.

Only minimized callback receipts and redacted recipient references may be recorded.

## Webhook / n8n

Required owner/operator actions:
- provide authoritative endpoint registry entry;
- provide signing-secret reference and allowed-host entry;
- provide n8n workflow ID and completion callback mapping;
- run signed delivery, retryable/final classification, pending state, and completion callback proof.

n8n pending is not delivered.

## AI

Required owner/operator actions:
- provide model/provider key reference;
- run model health proof;
- run controlled extraction/intent proof;
- confirm AI has no authority to mutate price, payment, roles, provider truth, or booking truth.

## Stripe / Payment

Current owner policy is Stripe SANDBOX / DEMO only. Run sandbox checkout, sandbox webhook, duplicate/idempotency, and Core payment application proof. Do not request or claim live Stripe provider verification.
