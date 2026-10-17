# ServiceDesk V4 — samai Codex Gateway adapter (R23)

**Status:** source-only until an authorized isolated, controlled gateway test. Product route: `/app/<workspace>/automations/ai-studio`. User-approved hostname: `https://codex-api.ezcomo.shop`. This file contains no credentials.

## Implementation

The existing `src/server/ai/model-transport.ts` spoke only Responses API (`POST /v1/responses`). The user-hosted samai Codex Gateway v0.2 (read-only inspection) implements OpenAI-style `POST /v1/chat/completions`, `GET /v1/models` and `POST /v1/codex/run` by wrapping `codex exec --ephemeral --sandbox read-only`, with separate bearer-authentication from a mode-0600 `gateway.key`. A local health check answered 200 and an unauthenticated model request answered 401. **The hostname `codex-api.ezcomo.shop` was user supplied; a browser/container direct reachability check could not resolve it from the available environment.** No authenticated generation or publicly reachable tunnel was verified.

This adapter is exact-domain only, HTTPS only, and does not permit the model to execute ServiceDesk business commands. The structured response validator accepts exactly one completed assistant Chat Completion and JSON content matching the pre-existing structured business output. It denies tool calls, function calls, refusals, multiple choices, incomplete output and malformed JSON. No model output may authorize pricing, quoting, customer sends, money transfers, scheduling or tenant access.

## Configuring a controlled single-owner TEST instance

Set values only in a **V4 deployment secret store**, not GitHub, frontend code or the older Render R13 preview:

```dotenv
SERVICEDESK_AI_ENABLED=false
SERVICEDESK_AI_PROVIDER=codex_gateway
SERVICEDESK_CODEX_GATEWAY_ENABLED=false
SERVICEDESK_CODEX_GATEWAY_TEST_WORKSPACE_ID=<exact authorized fictional workspace UUID>
SERVICEDESK_AI_MODEL=codex
SERVICEDESK_AI_API_BASE_URL=https://codex-api.ezcomo.shop/v1
SERVICEDESK_CODEX_GATEWAY_KEY=<set privately on V4 server; NEVER paste into chat, logs or Git>
SERVICEDESK_AI_TIMEOUT_MS=30000
SERVICEDESK_AI_MAX_OUTPUT_TOKENS=1536
```

Only one explicitly configured test workspace UUID is authorized for this provider; any other workspace is rejected before HTTP dispatch. This prevents the shared personal Codex login from accidentally serving all SaaS tenants. Keep **both** enable flags false until an authorized provider test. Both flags must be true for model requests. The gateway-specific key does not replace `OPENAI_API_KEY` and cannot be loaded from a Codex OAuth token on the server. The provider selection and exact origin are server-side only; any invalid, spoofed, downgraded or credentialed URL fails before an HTTP call.

The gateway implements model alias `codex` (Codex CLI model controlled by its gateway map); select only aliases in the verified source allowlist. Do not treat this adapter's `max_output_tokens` as a gateway-enforced token cap: the current gateway ignores that field, while ServiceDesk continues to cap input/HTTP response bytes and hard timeouts. A 30-second deadline may be insufficient for a cold Codex CLI run; any timeout is a failed model request, not success.

## Security and commercial-usage gate

OpenAI's current [Sign in with ChatGPT app documentation](https://help.openai.com/en/articles/20001542-using-your-chatgpt-plan-in-other-apps-and-sites) describes a participating-application integration with user authorization and usage controls. **A personally authenticated Codex CLI shared by many unrelated paying merchant tenants is not thereby authorized as a general SaaS API.** Before deploying this for any merchant, establish an expressly supported use case (e.g., official API project/approved SIWC integration) and privacy/retention boundaries, account ownership, per-tenant limits and operator consent. R23 is **not** an approval to sell gateway access, bypass service quotas, or enable bulk workloads through one personal ChatGPT login.

The samai gateway is operator-managed and read-only for the command workspace, but that does **not** prove tenant-level isolation or exclusion of customer data from model prompts. Only use synthetic, non-customer inputs for any separately authorized provider connectivity test.

## Required acceptance and release steps

1. Verify DNS, HTTPS certificate, `GET /health` and unauthenticated `GET /v1/models` (expect 401) externally **without** disclosing secrets or opening a public unauthenticated model endpoint.
2. Install the existing gateway-specific bearer key into an approved **V4 service secret environment** by an authorized operator using a secure secret path. Never transfer the personal ChatGPT access/refresh tokens or expose the gateway key in a tool response.
3. Run exact-head GitHub source tests, then isolated synthetic owner-only model probe *only after credential and usage authorization*; record status and redacted receipt. Do not call the private gateway with production merchant records for initial validation.
4. Verify staff non-owner denial, namespace isolation, cancellation, timeouts, rate limiting, no provider tool execution, all existing business actions remaining human-owned, and redaction.
5. Leave merchant-wide AI and external messaging OFF until compliance, capacity, data protection and explicit production release are approved. Current isolated Render review is on R13 and is not a V4 runtime.

**Release classification:** `IMPLEMENTED` once merged; `CONTRACT_TESTED` once exact-source tests pass; `PROVIDER_VERIFIED` requires controlled, authorized real inference evidence; `OPERATIONS_VERIFIED` requires merchant workflow and tenant UAT separately.
