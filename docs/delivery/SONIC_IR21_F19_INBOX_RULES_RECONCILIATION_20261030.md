# SONIC IR21 — F19 Inbox request-rule reconciliation (2026-10-30)

**Feature Development chat; source-only.** Extend EXISTING draft PR #915 (`sonic-integration/ir21-f20-real-finance-retention-20261030`), rather than create another stacked draft. Parent pre-reconciliation SHA `1e657af8b82777c7212a71946c39450b3c9cc840`. Shared two-chat contract: https://github.com/SaamVR/ServiceDesk/issues/808#issuecomment-6510726968.

## Integration loss found and corrected

The latest successor #915 branched through IR20 from an EARLIER #913 head (`2f348199f8cd769cdde9c9ded543200f4388b5ef`). Subsequently #913 independently implemented an OWNER-only, two-recheck Inbox-to-persisted REQUEST_CREATED internal workflow action at `6ec1c2970a478337cdb3bacce9c618eabf48ae01`. These improvements were absent from #915. Without reconciling them, adopting the newer feature stack would silently lose working source.

This patch imports **SIX original, unchanged source/test Git blobs** from #913 into #915:
- `src/server/ai/owner-inbox-request-rules.ts` — `012f493eac76b5f888510322bbb30a28c8b4404e`
- `src/features/operations/f19-inbox-request-rules-action.ts` — `87f16a1eea12f300aefb0c938ed5f966bd3fb679`
- `src/features/operations/AiInboxRequestRules.tsx` — `4602518cc5c76eb7369da739d3a797d8f9f56a46`
- `src/features/operations/inbox-request-rule-gate.ts` — `a4878db98f829e7a8bdd6756e52c47c242a95a04`
- `tests/ai/f19-inbox-request-rules.test.ts` — `68ec7dcbd9fef0f169fe4cb241ac85fa2683b676`
- `tests/ai/f19-inbox-request-rule-gate.test.ts` — `1bbcebc08c8305c2cba38901ea2afe6eac30fd2c`

**Compatibility adapter:** new `src/features/operations/InboxRequestRulesPanel.tsx` is owner + ALL branch + saved-request constrained. It requires the *explicitly selected* saved conversation, resolves the correct saved request from the authenticated snapshot, and only displays the write action when the existing published rule and trusted SERVICE_ROLE backend are available. Otherwise it explains the prerequisite and links to Automation settings. The underlying F19 server performs two fresh authorizations and two source reads before calling existing `runOwnerSavedRequestAutomation`, which reauthorizes again and verifies actual `CREATE_ATTENTION` persistence.

**Inbox route:** extends #915's existing route with `<InboxRequestRulesPanel>` alongside the original `InboxConsentedDraftPanel` and **protected F15 `InboxProtectedLeadReviewPanel`**. The F15 protected claim/journal action is unchanged. The read-only F15 copy from #913 is *not duplicated* because #915 already has a separate protected F15 journey. Historical F15 reviewed blob lock `docs/delivery/sonic-f15-ir21-reviewed-owner-inbox-source-lock-20261030.json` remains **byte-for-byte unchanged**; its independent Critic now pins both the frozen prior route blob `56516b7aa63750d5a46446e160e507d7481ac1ba` and new additive route blob `b68b99b3680b6f5ff4aa192a7cbda360715b1ef2`. A second independent Critic pins all six original imported Git blobs and asserts preserved F15/consent surfaces.

## Separate business semantics

- F19: OWNER-clicked existing `REQUEST_CREATED` event processing; can persist and verify existing internal attention workflow actions **ONLY if** a trusted backend/published rules are installed. Reports actual new vs replay and exact saved attention counts. This is NOT a missed-message SLA event.
- F15: independently protected OWNER-clicked `UNANSWERED_LEAD_SLA_REVIEW` atomic event candidate; rollout switch defaults OFF, SQL V2 remains **UNAPPLIED**, journal readback cannot be claimed to work on production until DB approved.
- F18: consent-checked reply drafting only; no automated customer send.
- F20 finance/retention: source-only owner review, no financial mutation or outreach.

## Verification, control and next action

Existing IR21 CI is extended to exercise the two original F19 behavior suites, independent F19+IR21 integration Critic, existing protected F15 journey/Critic, TypeScript, changed-file ESLint and Next.js build; its existing disposable PG17 native job is reused. Never claim a live two-owner UAT or actual DB write from source CI.

No new PR; no main/canonical merge, DB install, Supabase credential/tenant mutation, Vercel preview/prod, customer communication, money/paid model actions or device use. Production Chat still owns the exact merge decision and must avoid merging #913 and #915 separately into canonical. **NEXT BATCH:** with P02 #818 owner-specific Auth/RLS/deploy permission, verify distinct tenant A/B owner Inbox request→published rule→persisted attention readback while F15 installed status stays explicitly separately gated; then prioritize completing saved intake→quote→booking customer journey.
