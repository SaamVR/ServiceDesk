# Chat 2 Connector Run 2 — Durable WhatsApp Inbound Checkpoint

Date: 2026-10-04
Branch: `feat/servicedesk-v1-connectors`
Run: `Run 2 — WhatsApp Durable Inbound Pipeline`

## Starting point

Run 2 started from the latest observed remote connector head:

`3523c91026e3c0fefb020ca43bde7da2435c8243`

This was newer than the Run 1 handoff head, so the newer commits were preserved. Notably, the branch already contained additional WhatsApp inbound validation, media and status-transition work.

## Final head after this run

`96e64bddff53c5f0bca690c8cda3981804158162`

A final doc checkpoint commit is expected after this file is written.

## Implemented in this run

### Normalized inbound event contract

Added:

- `src/server/integrations/whatsapp/inbound-normalization.ts`
- `tests/providers/whatsapp-inbound-normalization.test.ts`

Behavior:

- converts `WhatsAppInboundMessage` into a safe downstream event;
- preserves provider/workspace/account/message identity;
- distinguishes `TEXT`, `MEDIA_REFERENCE`, and `UNSUPPORTED`;
- does not include raw provider payload;
- marks `aiAuthoritative: false` so downstream AI/conversation code cannot treat extracted content as business truth.

### Durable inbox persistence contract

Added:

- `src/server/integrations/whatsapp/inbox-persistence.ts`
- `tests/providers/whatsapp-inbound-batch.test.ts`

Behavior:

- builds durable inbox records from normalized inbound events;
- uses scoped receipt keys: `workspaceId:providerAccountId:providerMessageId`;
- supports mixed inserted/duplicate/unsupported summary counts;
- returns typed failure on partial durable persistence failure;
- adds deterministic redacted raw event refs with no raw payload leakage.

### Mixed inbound handler batch coverage

Updated:

- `tests/providers/whatsapp-inbound-validation.test.ts`

Behavior covered:

- one webhook containing duplicate + inserted messages;
- same provider message id on another WhatsApp account is not duplicate;
- handler summary reports `{ received, inserted, duplicate }`.

### Durable inbound webhook handler

Added:

- `src/server/api-handlers/provider-whatsapp-durable.ts`
- `tests/providers/whatsapp-durable-inbound-handler.test.ts`

Behavior:

- verifies Meta signature before parsing;
- parses inbound messages once;
- groups messages by workspace + provider account;
- assigns per-account redacted raw event references;
- persists normalized durable records;
- returns retryable 503 if any group fails durable persistence;
- does not expose raw webhook body in stored durable records.

### Exports

Updated:

- `src/server/integrations/index.ts`
- `src/server/api-handlers/index.ts`

New exports:

- WhatsApp inbound normalization;
- WhatsApp inbox persistence;
- durable WhatsApp inbound API handler.

## Commits created in Run 2

- `edcb2a6fed742c3d9e7cd19e64ddc3b0f27dc8f3` — `test(whatsapp): define normalized inbound event contract`
- `4e4110326cbc6830c92752f154c24ca8c7d5d195` — `feat(whatsapp): add normalized inbound event contract`
- `a2338fcfd1598fb4c5cc1f959fac10edf01fa7c8` — `feat(integrations): export WhatsApp inbound normalization`
- `6d19d0d177d08d313ff914be527144f5528f3da2` — `test(whatsapp): define durable inbound batch persistence contract`
- `506a0e286b3350212027c816dd8ebbad1de4389d` — `feat(whatsapp): add durable inbound batch persistence contract`
- `0903d3e437f4494b2fe65a2451f609cf496bf80c` — `feat(integrations): export WhatsApp inbox persistence`
- `0bbce0f1c6f0aa0bd099e8f3fc2825be58440078` — `test(whatsapp): cover mixed duplicate and inserted inbound handler batch`
- `b4f86398b80e750be52b67b02c8de5e3591d8248` — `test(whatsapp): define redacted raw inbound event references`
- `730f31fa9330cba5957820a5bd7a90442904c8a6` — `feat(whatsapp): add redacted raw inbound event references`
- `50bc86869e8dabf7280afe98e87f5adbbe3d9852` — `test(whatsapp): define durable inbound webhook handler`
- `d8201cb31172c70af17d0c4e20fb782ed9b3e530` — `feat(whatsapp): add durable inbound webhook handler`
- `e189af418089d470275f25c8c6e15cb9ab42332e` — `feat(api): export durable WhatsApp inbound handler`
- `96e64bddff53c5f0bca690c8cda3981804158162` — `fix(whatsapp): export durable inbound handler store alias`

## Verification

Full Vitest/typecheck were not run.

Runtime blocker:

- `samai` has Node 22 and pnpm 10.17.1 but disk is full enough that `git fetch` fails with `No space left on device`.
- `samvr` remains unsuitable for this run because node/pnpm were unavailable during Run 1 verification and disk is also low.

State label for this run:

`IMPLEMENTED`

Not claimed:

- `TEST_PASS`
- `PROVIDER_VERIFIED`
- `OPERATIONS_VERIFIED`

## Provider proof

No live/sandbox Meta provider proof was executed.

Current proof remains:

`CONTRACT_TESTED / IMPLEMENTED`

Provider verification remains blocked until controlled Meta app/WABA, sender phone-number id, app secret, verify token, subscribed webhooks, consenting recipient and approved templates are available.

## Next recommended run

Continue with:

`Run 3 — WhatsApp Outbound Dispatcher + Template/Handover Race Safety`

Recommended first tasks:

1. Create/strengthen actual outbound dispatch seam from `OutboxJob` to provider request to acceptance receipt.
2. Re-check opt-out/opt-in/handover/template rules immediately before send, not only at enqueue time.
3. Add handover race test: queued message becomes suppressed when human handover activates before dispatch.
4. Add template registry/configuration boundary with `CONTRACT_TESTED` only, not Meta approval.
5. Preserve `PROVIDER_ACCEPTANCE_ONLY`; never mark outbound send as delivered/read.
