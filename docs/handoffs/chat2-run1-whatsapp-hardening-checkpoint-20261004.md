# ServiceDesk AI Connector Lane — Run 1 Checkpoint

Date: 2026-10-04
Branch: `feat/servicedesk-v1-connectors`
Run: Connector Verification + WhatsApp Hardening Closure

## Branch state

- Program creation HEAD: `93a65314d4a9c4e74bd6ab0a9feee32cdcdd7521`
- Run observed starting HEAD: `706dc579f2cdbae829b0f351553a443b3020ecab`
- Final Run 1 HEAD before this checkpoint: `812ac5f17d16500baa67c079d003f2622d317cb5`
- Integration branch observed: `feat/servicedesk-v1-integrate`
- Integration HEAD observed: `c618903e4fb4300bb4c8dd2be761180300d854a0`

`NEWER_CONNECTOR_HEAD` was detected and preserved. Work continued from the newer remote connector branch. No integration merge was performed.

## Runtime / verification environment

- `samai` online.
- Node 22.23.2 available on `samai`.
- pnpm 10.17.1 available on `samai`.
- `samai` disk was full: approximately 55–57 MB free on `/` during this run.
- `samvr` online but did not have Node/pnpm available and had limited free disk.

Result:

`CONNECTOR_TEST_ENV_BLOCKED_ENOSPC`

Full `pnpm install --frozen-lockfile`, Vitest and typecheck were not runnable in this environment.

## Work completed

### WhatsApp status callback shape safety

Commits:

- `c81dcd5defef664c1e949557ff7184f23b87bd16` — `test(whatsapp): ignore malformed status collections`
- `2a3d5758cb76d81ac4cb1c2f30d56fd1a225cc3b` — `fix(whatsapp): ignore malformed status collections`

Added handling so signed but irrelevant/malformed `statuses` collections are acknowledged as no-op rather than throwing.

### Inbound receipt dedupe scoping

Commit:

- `0e55bdeef314154e30afddb862684ec4c7435df9` — `test(whatsapp): scope inbound duplicate receipts by account`

Added `providerInboxReceiptKey(...)` and tests proving duplicate receipt keys are scoped by:

`workspaceId + providerAccountId/phoneNumberId + providerMessageId`

The same provider message id on another mapped WhatsApp phone account is not treated as duplicate.

### Outbound policy coverage

Commit:

- `48057a1fa8f4ea30b185924446d84eaf5a600c65` — `test(whatsapp): expand outbound dispatch guard coverage`

Added coverage for:

- invalid `lastInboundAt`;
- exact 24-hour customer-service boundary;
- missing opt-in;
- missing outbox idempotency key.

### WhatsApp delivery lifecycle helper

Commits:

- `fc1932aacad87422089074587fb97e80a7881a99` — `test(whatsapp): define delivery lifecycle transitions`
- `2d48ca3014dcdb06bec97c5da19fd91e2068e098` — `feat(whatsapp): add delivery lifecycle transition helper`

Added `src/server/integrations/whatsapp/status.ts` with deterministic transition behavior:

- `PENDING → PROVIDER_ACCEPTED → DELIVERED → READ`
- duplicates are acknowledged without effect;
- stale regressions do not overwrite newer proof;
- `FAILED` can apply before delivery proof;
- `FAILED` cannot overwrite `DELIVERED` or `READ` proof.

### Non-object array-entry hardening

Commits:

- `7b4ffd4d98f491fd32762467a1e216738c400147` — `test(whatsapp): skip non-object webhook array entries`
- `812ac5f17d16500baa67c079d003f2622d317cb5` — `fix(whatsapp): skip non-object webhook array entries`

Inbound parser and status parser now skip `null` / primitive entries inside Meta arrays instead of throwing.

## Checks actually run

Full Vitest/typecheck: **not run** because dependency installation is blocked by disk exhaustion.

Exact-source Node 22 semantic checks were run against the latest branch using temporary symlinks for extensionless TS imports.

Passed semantic checks:

- malformed status collection is acknowledged as no-op;
- mixed status array with `null`/primitive entries applies only valid status;
- inbound mixed message array with `null`/primitive entries persists only valid entries;
- inbound duplicate key is scoped by workspace/account/message id;
- invalid customer-service timestamp does not open freeform send window;
- exact 24-hour customer-service boundary is allowed;
- missing opt-in suppresses outbound dispatch;
- `READ → DELIVERED` is stale regression;
- `PROVIDER_ACCEPTED → FAILED` applies before delivery proof.

Semantic result:

`SEMANTIC_CHECKED: whatsapp run1 expanded handler/policy/status checks PASS`

## Provider proof

Provider proof was **not** claimed.

Current proof level:

- WhatsApp: `CONTRACT_TESTED` / `SEMANTIC_CHECKED`
- Meta sandbox/live proof: `CONFIGURATION_BLOCKED`

Still required for `PROVIDER_VERIFIED`:

- authorized Meta app and WhatsApp Business Account;
- controlled sender phone-number id mapped to one ServiceDesk workspace;
- consenting controlled recipient;
- webhook verify token and app secret in environment secrets;
- subscribed message/status webhooks;
- approved templates for outside-window sends;
- controlled inbound/outbound/status receipt evidence.

## Integration status

Integrated to `feat/servicedesk-v1-integrate`: **No**.

All work is pushed only to:

`feat/servicedesk-v1-connectors`

## Next READY task

Continue with Run 2:

`WhatsApp Durable Inbound Pipeline`

Recommended first tasks:

1. Define/strengthen durable inbox persistence contract.
2. Add mixed-batch contract tests for multiple entries/changes/messages with duplicate + inserted outcomes.
3. Add normalized inbound event contract for downstream AI/conversation processing.
4. Preserve provider proof labels; do not claim Meta verification from fixtures.
