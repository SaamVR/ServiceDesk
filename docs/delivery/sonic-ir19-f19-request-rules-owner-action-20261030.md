# ServiceDesk SONIC F19 — Inbox to persisted internal request workflow

**Date:** 2026-10-30. **Branch:** existing IR19 feature stack / draft PR #913, NOT a new PR. **Active operating contract:** https://github.com/SaamVR/ServiceDesk/issues/808#issuecomment-6510726968

## Vertical slice delivered

From the existing authenticated owner Inbox, select a saved request-linked conversation and explicitly click **Process published request rules**. The backend maps that *server-read* conversation to a saved request, double-verifies signed-in OWNER identity and ALL-branch membership, rechecks both conversation/request links and saved revisions, and invokes the existing `runOwnerSavedRequestAutomation` privileged workflow executor for the authoritative `REQUEST_CREATED` source event.

The existing executable (not duplicated here) loads active published rules, uses the persisted source ID for idempotent rule/event processing, invokes trusted workflow SQL, executes allowed CREATE_ATTENTION pending actions only, and independently verifies saved attention provenance. F19 returns honest counts for matched executions, newly recorded/replayed executions, **saved internal attentions actually verified**, and external actions awaiting separate authorization. A zero-effect run shows 'No internal attention created', not a false success.

**Critical semantic distinction:** This executes existing REQUEST_CREATED business rules, not the separate UNANSWERED_LEAD_SLA_REVIEW event. The adjacent F15 owner SLA card remains read-only. F15 draft SQL #884 is **unapplied** and does not become installed or automatically scheduled. No email/WhatsApp sends, provider acknowledgement, paid AI, booking assignment, money mutation or SLA event is claimed.

## Parallel work ownership, security & limits

- **Backend lane:** `src/server/ai/owner-inbox-request-rules.ts`. Does not accept browser request IDs; derives exact saved request from tenant-scoped server reads. Requires service-role configured, twice authenticated owner, selected branch, unchanged saved request/conversation source. Underlying trusted executor performs its own actor/branch/source checks before writes.
- **Server action lane:** `src/features/operations/f19-inbox-request-rules-action.ts`. All failures become bounded, secret-free denial, only fixed status and aggregate counts cross into browser.
- **User journey lane:** `src/features/operations/AiInboxRequestRules.tsx`, included by `InboxLeadSlaPanel.tsx` for already-authorized request-linked Inbox selection. Explicit user click; duplicate-click guard, mounted response serial, no automatic execution.
- **QA/Critic:** `tests/ai/f19-inbox-request-rules.test.ts` and `tests/ai/f19-inbox-request-rules-critic.test.ts`. Validate no backend in RLS mode, dispatcher/branch/foreign/colliding request denial, changed actor/source, genuine zero-action report, forgery of count/request/provider receipt and no external send APIs.
- **Integration:** preserves immutable F18 manifest and prior F15 Inbox entrypoint. One focused IR19 workflow with TypeScript, changed-file lint and Next build; no 3,800-test repeat on every micro-change.

## Operational safety and remaining gates

This is a **source-implemented and UI-callable** manually triggered internal write pathway, backed by existing reviewed workflow RPCs **only where those RPCs are installed, backend service mode enabled and published request rules exist**. A feature can return BACKEND_DISABLED and is not operational in that configuration. Actual authenticated two-owner staging/browser behavior remains blocked by Production P02 #818; feature CI alone is NOT proof of saved production attention.

No canonical/main merge, SQL install, tenant/Auth fixture creation, provider call/spend, Vercel preview/deploy, external messaging or device changes. Production Chat owns canonical integration and live UAT after explicit approvals. Avoid merging #909–#913 sources and a composite twice.

**Next batch:** Production Chat chooses the exact #913 successor and #884 SQL candidate independently, verifies P02 two-owner authorization and real saved request→published rule→attention readback. Feature Chat may improve next authenticated business journey within existing stack only after source integration decision, no extra F20+ draft.
