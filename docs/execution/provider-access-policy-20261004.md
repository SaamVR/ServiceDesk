# ServiceDesk AI — Provider Access Policy

Date: 2026-10-04
Owner ruling: ACTIVE

## Stripe / payments

V1 Stripe scope is SANDBOX / DEMO ONLY.

- Do not request or wait for live Stripe account access.
- Do not require live Stripe secret keys or live webhooks to continue V1 development.
- Use official Stripe-compatible test/sandbox event shapes, test-mode identifiers, injected transports, signed fixture webhook payloads and deterministic demo checkout state.
- The application may present payment behavior as demo/sandbox only.
- Never label Stripe payment evidence as live `PROVIDER_VERIFIED` without a later explicit owner change and controlled live/test-account receipt.
- Core business-truth logic must still be production-grade: amount/currency/purpose/resource matching, idempotency, invoice allocation, hold expiry review, ledger/outbox atomicity and duplicate safety are required even when provider evidence is sandbox-only.

## Remaining providers / infrastructure

Do not interrupt the owner for credentials or configuration before the implementation reaches the exact integration gate.

Ask just-in-time when ready for:
- Supabase/Postgres staging;
- Meta WhatsApp Cloud API;
- Google Calendar OAuth/API;
- transactional email provider;
- AI provider/model configuration;
- n8n/webhook endpoint if needed;
- Vercel/deployment configuration if not already available.

Until then, continue implementation with injected adapters/fixtures/outage-mode proof and keep the relevant provider/configuration gate explicitly blocked.

## Evidence rule

Sandbox/demo provider evidence may support implemented/contract-tested behavior when executable proof exists, but it does not imply a live-provider production receipt.
