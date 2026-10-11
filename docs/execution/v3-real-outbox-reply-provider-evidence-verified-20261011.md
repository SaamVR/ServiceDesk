# ServiceDesk V3 — Verified outbox dispatch readiness and reviewed reply replay (October 11, 2026)

## Exact verified state

- Repository: `SaamVR/ServiceDesk`; canonical V3 integration: `feat/servicedesk-v3-coordination-20261011`.
- **Latest integrated and fully verified CODE SHA:** `58ad5a4c2a42ca2da0ab601f471c77d32df1e594`.
- Combined integration [GitHub Actions run 38124750936](https://github.com/SaamVR/ServiceDesk/actions/runs/38124750936) **PASS on that exact SHA**; focused Vitest **30 files / 207/207 tests**, full RC **375 files / 1,603/1,603 tests**, TypeScript check PASS, ESLint **0 errors / 11 warnings**, production Next build PASS and **32/32 generated pages**; Node release smoke PASS. Individual PR-head full RC checks passed as well. GitHub-hosted test evidence is not a live provider acceptance receipt or Chromium visual signoff.
- Previous exact V3 coordinator baseline for this run was `57049a7819851f20aafcca75003d0cb12308eb4d`. All product code changes were isolated on separate branches and integrated via reviewed, exact-head-CI-passing PRs.

## Two completed operational product changes

### Lane A — queued human-approved replies can resolve into authoritative dispatch jobs

[PR #102](https://github.com/SaamVR/ServiceDesk/pull/102), merge `bced21df6c23a10f0f272a36d302975fd3ed4f8c`.

**Root cause:** The deployed `servicedesk_enqueue_conversation_reply` SQL RPC creates an outbox payload with `conversationId`, channel, recipient and body, but **does not embed `messageId`**. Existing `buildConversationReplyOutboxJob` rejected all such events because it required `event.payload.messageId`. This prevented actual queued staff-approved replies from becoming provider dispatch intents even though source data existed.

- `src/server/integrations/outbox/conversation-reply-intent.ts`: now permits the exact deployed payload shape with absent `messageId`, while still rejecting contradictory supplied message/channel/recipient/body fields. It obtains the actual message ID from a trusted source port.
- `src/server/integrations/outbox/conversation-reply-postgres.ts`: `createPostgresConversationReplyIntentResolver` reads the exact claimed tenant-scoped outbox event and uniquely linked OUTBOUND STAFF message via `messages.outbox_event_id`; verifies original workspace/topic/idempotency, body, channel, conversation and timestamp. Rechecks *current* recipient and current latest customer communication consent (not just consent at enqueue), including contact changes and latest inbound customer message. A revoked consent, rotated recipient, or newer inbound message returns `OUTBOX_SUPPRESSED:...` and must not send. Transient database read failures are `OUTBOX_RETRYABLE:...`; database source errors never expose customer PII or provider secrets.
- `src/server/integrations/outbox/execution-adapter.ts`: maps these suppression and retry codes to existing worker outcome semantics instead of terminalizing temporary DB failures or sending revoked/stale messages. The resolver is implemented and contract-tested; **a configured live sender/scheduler/provider remains a separate activation gate**. Do not claim delivery or assume this resolver is deployed merely because this code is merged.
- New `tests/providers/v3-conversation-reply-postgres.test.ts`; extended `tests/providers/e05-conversation-reply-intent.test.ts`.

### Lane B — truthful provider acceptance in operational delivery triage

[PR #102](https://github.com/SaamVR/ServiceDesk/pull/102), same verified merge.

- `src/server/integrations/whatsapp/delivery-outbox-evidence.ts`: explicit, read-only distinction between `QUEUED`, `PROVIDER_ACCEPTED`, `DELIVERED`, `READ`, `FAILED`, `SUPPRESSED`, `UNKNOWN`. SENT outbox event with nonempty `provider_reference` proves **provider acceptance only**; customer delivered/read still requires corresponding durable message/callback state. Missing/invalid reference is UNKNOWN, not a false success; committed terminal outbox failure/suppression surfaces as needs-review unless a more authoritative message callback has advanced.
- `src/server/integrations/whatsapp/delivery-triage.ts`: queries `outbox_events` only for outbound messages authorized by the active staff workspace + selected branch, then reconciles status without mutating DB. Does not return provider reference, recipient, message text, secret or unrelated branch IDs. Existing branch-private count and conservative truncated semantics remain.
- New `tests/providers/v3-delivery-outbox-evidence.test.ts`, extended `tests/providers/v3-delivery-triage.test.ts`. Contract verified with synthetic provider receipts and DB rows, **not actual Meta callbacks**.

### Lane C — durable idempotent staff review response

[PR #103](https://github.com/SaamVR/ServiceDesk/pull/103), merge `58ad5a4c2a42ca2da0ab601f471c77d32df1e594`.

- Before this fix, the existing consent-checked enqueue RPC increments conversation.version, causing a subsequent browser retry with the *same idempotency key and reviewed body* to fail as a version conflict even when the first call had already queued a message.
- `src/server/core/reviewed-inbox-reply.ts`: after verifying actual staff membership, workspace + branch, explicit review confirmation, and exact latest INBOUND CUSTOMER source message, reads any existing outbound STAFF message by **workspace + idempotency key**; verifies same conversation, body, chronological source, prior outbox event ID/workspace/topic/idempotency/status. For a matching existing operation returns `EXISTING_REPLY` **without a second enqueue/provider send**, even after optimistic conversation version increased; for no prior message the previous optimistic-version consent-checked RPC remains intact. Reused keys for different reply content, conversation or corrupt outbox evidence fail closed. A SENT outbox with actual provider reference may report only `PROVIDER_ACCEPTED`, never `DELIVERED`/READ.
- Expanded `tests/providers/v3-reviewed-inbox-reply.test.ts`. Exact-PR-head and combined coordinator RC PASS. No new migration or protected branch changes.

## Remaining release blockers and lane ownership

- **W4 frontend** [PR #83](https://github.com/SaamVR/ServiceDesk/pull/83) independently evolving, **unmerged** and awaiting owner-approved responsive/browser visual acceptance. Last observed W4 head `91c964f4c1cca94e8a092d271d16b3de031741de`; may change. Backend handoff posted as PR comment `6107118069`. W4 exclusively owns `src/app/**`. Do not merge visuals merely on TS/unit tests.
- W4 still needs thin dynamic server Next route glue (without duplicating Auth/HMAC): GET/POST `src/app/api/providers/whatsapp/route.ts`; POST `src/app/api/internal/ai/draft/route.ts`; POST `src/app/api/internal/inbox/reply/route.ts`; GET `src/app/api/internal/inbox/delivery/route.ts`. A review draft **does not execute** business tools. The UI should display `DRAFT_FOR_STAFF_REVIEW` → `QUEUED_FOR_PROVIDER` or `EXISTING_REPLY` → `PROVIDER_ACCEPTED` → `DELIVERED/READ/FAILED/SUPPRESSED` honestly.
- Connected Supabase ServiceDesk project `cpmmgivhlkfbiwzhlcey` was checked read-only earlier in this series: applied migrations through 0036, platform safety restriction [issue #75](https://github.com/SaamVR/ServiceDesk/issues/75) blocks 0037. No bypass or 0037–0059 application; no unauthorized database writes.
- Real configured outbox worker runtime + scheduler, live provider credential readiness, signed Meta delivery callbacks, real authenticated customer signup/SMTP confirmation, manual browser acceptance and preview deployment remain **unverified/not completed**. The operational AI and durable WhatsApp status remain disabled by default. No provider or model tokens touched, no customer message transmitted.
- This run used connected **GitHub tool/GitHub Actions** for coding and exact SHA validation, plus existing read-only schema evidence. It did not use an interactive GPT Runtime shell, remote device, real Chromium screenshots, deploy or production database. Future browser/SDK acceptance must be proven rather than asserted.

## Next implementation run priorities

1. W4: synchronize independent UI branch, wire thin owned Next route glue and robust Inbox/AI draft/review/queue/receipt status UI; prove 320/390/834/1280/1440 Chrome responsive acceptance, auth and visual signoff before frontend integration.
2. Build an **explicitly controlled** service-role outbox worker/scheduler with verified per-topic resolver/provider dispatch coverage and safe mixed-topic handling; do not enable arbitrary queue consumption until actual provider config and signed staging proof exist. Run a synthetic end-to-end claimed-job → Postgres resolver → dispatcher → durable outbox completion regression.
3. Controlled isolated staging signed WhatsApp, Email provider callbacks and AI opt-in reviews; verify recipients/consent and provider acceptance separately from actual delivery/read. Preserve source/actor/workspace isolation.
4. Resolve 0037 safety gate via owner/platform-approved ordered migration plan, then verify SMTP real signed-in owner account and onboarding browser flow. No production shortcuts.
5. Continue implementation-first, parallel, independently owned lanes; exact head GitHub CI and durable proof; avoid rerunning audits and docs-only CI.
