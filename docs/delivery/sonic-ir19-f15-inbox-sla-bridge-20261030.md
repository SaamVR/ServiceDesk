# IR19 targeted F15 Inbox owner SLA bridge (2026-10-30)

**Active two-chat contract:** https://github.com/SaamVR/ServiceDesk/issues/808#issuecomment-6510726968

**Existing feature successor:** #913 (`sonic-integration/ir19-f18-inbox-consented-reply-20261030`), continuing from exact verified 2f348199f8cd769cdde9c9ded543200f4388b5ef. F15 source PR #884 remains the separately owned, **UNAPPLIED** SQL/PG17 candidate; this bridge copies ONLY its reviewed pure SLA policy blob `7614e27f1ca80a0203ae16984fe393f68a4e621d` and does not copy/migrate/install its SQL or use its privileged port. Do not merge #884 and this successor as duplicate source; review blob-level overlap and the final integration decision in Production Chat.

## Concrete user-facing capability

The existing authenticated Inbox now renders an owner-only saved request conversation picker and button with 30/60/120 minute follow-up review thresholds. The server action:
- Resolves the real owner and verifies **ALL** branch scope, then reads one linked request with trusted tenant/branch, status, version and saved created_at, one unambiguous request conversation, one latest saved CUSTOMER INBOUND and one latest STAFF OUTBOUND.
- Refuses ambiguous request/customer thread histories; no incomplete browser message page is treated as negative proof of a reply.
- Reauthorizes the same owner and rereads exactly the selected source; fails closed on source revision/message/answer drift.
- Evaluates the imported F15 canonical policy against persisted facts and returns ONLY the channel, saved request revision, SLA threshold/due time and manual-review state.
- Never inserts a source journal row, sends a message, invokes an AI provider, charges money, or executes any workflow action. A positive answer is **read-only human review**; the F15 SQL function is not deployed.

## Independent lanes

1. F15 contract owner: exact Git blob import (no policy rewrite).
2. Backend owner: `src/server/ai/owner-inbox-f15-sla-review.ts`.
3. UI owner: `src/features/operations/InboxLeadSlaPanel.tsx`, `AiUnansweredLeadSlaReview.tsx`, server action; integration owner modifies only `src/app/app/[workspace]/inbox/page.tsx`.
4. QA: adversarial pure/owner tests and actual Supabase-like query contract tests; CI focused TypeScript + tests + lint + Next build. Independent Critic checks source, no provider delivery claims.
5. Integration: no new numbered PR; advance existing #913 only. Keep old F18 source manifests immutable; no automatic canonical/main merge.

**Acceptance:** source route and user-controlled button compile, focused security negatives pass, exact successor head has green focused CI, independent reviewer approves. No operational two-owner/browser acceptance until P02 #818 receives separately authorized real staging/tenant/deploy. F15 atomic SQL #884 is **still NOT INSTALLED**; the on-demand check does not claim unattended escalation.

**NEXT_BATCH:** Production Chat make explicit one-stack integration decision for #909→#913, then verify real signed-in owner Inbox + cross-tenant denial under separately approved P02 setup; Feature Chat continue only disjoint functionality that closes actual customer journey, not more draft composites.