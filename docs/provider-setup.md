# ServiceDesk AI V1 provider setup gates

Verified on 2026-10-04 for Chat 2 Cycle 1. This file records setup requirements only; it contains no credentials, live phone numbers, customer contact data, calendar IDs or payment receipts.

## Provider modes

- `FIXTURE`: deterministic contract tests only. Does not prove external connectivity.
- `SANDBOX`: authorized provider account using controlled sender/recipient/calendar/payment resources.
- `LIVE`: approved production business identity and provider account. Requires controlled proof plus owner authorization.

Completion labels follow AGENTS.md: IMPLEMENTED, CONTRACT_TESTED, PROVIDER_VERIFIED, OPERATIONS_VERIFIED, CONFIGURATION_BLOCKED.

## WhatsApp Cloud API

Official references to recheck before sandbox/live proof:

- WhatsApp policy: https://business.whatsapp.com/policy
- WhatsApp developer entry: https://developers.facebook.com/docs/whatsapp/

Required configuration before `PROVIDER_VERIFIED`:

1. Authorized Meta app and WhatsApp Business Account.
2. Dedicated controlled sender phone-number ID mapped to exactly one ServiceDesk workspace.
3. Dedicated consenting recipient for inbound/outbound proof.
4. Webhook verify token and app secret stored only as environment secrets.
5. Webhook URL subscribed to messages/status events.
6. Approved templates for quote/confirmation/reminder paths outside the customer-service window.
7. Payment method/paid messaging readiness checked in the business account before live use.

Implementation policy:

- Verify GET webhook challenge by matching verify token and returning `hub.challenge`.
- Verify POST payload before parsing using `X-Hub-Signature-256` over the raw body.
- Dedupe inbound events by provider message ID scoped to provider account/phone/workspace.
- Persist durable inbox receipt before acknowledgement in the real handler.
- Recheck opt-in, opt-out, customer-service window, template status and handover immediately before send.
- Provider accepted status is not delivered/read proof.

Current lane state: CONTRACT_TESTED only. Real sender/recipient access is missing in this chat, so external proof is CONFIGURATION_BLOCKED.

## Google Calendar

Official references to recheck before sandbox/live proof:

- Calendar API overview: https://developers.google.com/workspace/calendar/api/guides/overview
- OAuth scopes: https://developers.google.com/workspace/calendar/api/auth
- Free/busy: https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query
- Incremental sync: https://developers.google.com/workspace/calendar/api/guides/sync

Least-privilege scope plan:

- Free/busy-only connection can use `https://www.googleapis.com/auth/calendar.freebusy` or `https://www.googleapis.com/auth/calendar.events.freebusy`.
- Event lifecycle needs write access, preferably `https://www.googleapis.com/auth/calendar.events` where suitable for selected crew calendars.
- Calendar list/read setup may require calendar list scope during onboarding, then store selected calendar mappings.

Required configuration before `PROVIDER_VERIFIED`:

1. Google Cloud OAuth client and verified redirect URL.
2. Test account with a dedicated controlled crew calendar.
3. Selected calendar mapping per crew.
4. Refresh-token storage with reconnect flow.
5. Evidence for create, update, cancel, free/busy block and expired sync-token rebuild.

Implementation policy:

- One mapped provider event per visit.
- App booking state remains authoritative.
- External busy blocks future availability; external edits to app-managed events create review/conflict, not silent business mutation.
- Expired sync token rebuilds external cache only and must not delete business jobs.

Current lane state: CONTRACT_TESTED only. Dedicated OAuth client/calendar access is missing in this chat, so external proof is CONFIGURATION_BLOCKED.

## Payments

Official references to recheck before sandbox/live proof:

- Stripe availability: https://stripe.com/global
- Stripe webhooks: https://docs.stripe.com/webhooks

Eligibility finding:

- Stripe global availability must be checked for the operating entity's country before selecting live Stripe. The current verified availability list does not include Bangladesh as a supported country/region for opening a normal Stripe payments account. A Bangladesh-based operating entity is therefore CONFIGURATION_BLOCKED for Stripe live payments unless it has a qualifying supported-country legal entity/bank/account setup or chooses another eligible provider in a later approved scope.

Required configuration before `PROVIDER_VERIFIED`:

1. Sandbox Stripe account for an eligible operating entity or approved replacement provider.
2. Hosted checkout configured server-side from quote/hold only.
3. Webhook endpoint with endpoint secret stored only in environment secrets.
4. Controlled sandbox checkout receipt and event ID.
5. Duplicate/out-of-order webhook evidence.
6. Live-mode proof only after business-country eligibility and owner authorization.

Implementation policy:

- Verify raw-body webhook signature before parsing.
- Check provider account, purpose, workspace, amount and currency.
- Domain facade applies the verified payment idempotently; provider adapter does not mutate booking truth.

Current lane state: CONTRACT_TESTED only. Sandbox account credentials and controlled receipt are missing in this chat, so external proof is CONFIGURATION_BLOCKED.

## OpenAI / AI tools

Official reference to recheck before live model use:

- OpenAI function calling/tools: https://developers.openai.com/api/docs/guides/function-calling

Implementation policy:

- Server-side model adapter only.
- Strict JSON schema tools where supported.
- Max six tool calls per turn.
- Model can draft/extract/summarize and request safe facade calls, but cannot determine prices, payment state, roles or authoritative availability.
- Handover ownership is checked immediately before automatic reply.
- Store action summaries and citations, not private reasoning.

Current lane state: deterministic fixture AI and 30-case corpus are CONTRACT_TESTED only until a pinned model/provider run is configured.
