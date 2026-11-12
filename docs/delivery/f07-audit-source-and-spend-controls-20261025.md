# F07 source-bound owner audit and misleading-success controls — 2026-10-25

**Control:** #808 / **F07:** #815. **Owner:** Feature Chat creates additive source-only review code, Production Chat owns canonical integration, database schema, migrations, provider acceptance and operational activation.

## Source inventory (verified in canonical at F07 start)

- `loadOperationalStaffSnapshot` already exposes workspace/actor, saved `workflow_executions` (bounded to 1000), `workflow_action_executions` (bounded to 2000), `workflowAvailable` and branch scope. The action DTO includes `state`, `attemptNumber`, `errorCode`, and `replayOfActionExecutionId`, but **no authenticated provider-delivery receipt**.
- Existing `src/server/ai/automation-failure-triage.ts` is a *pure* classifier of supplied failure records, not a saved-owner loader; preserve it. Existing `src/server/ai/action-audit.ts` already downgrades model `COMPLETED` claims to `PROPOSED`; preserve that guard.
- Supabase 0014 introduced saved `workspace_usage_counters` (`AI_ACTIONS`), `workspace_usage_limits` and monthly periods; it does **not** record provider input/output tokens, billed currency, provider invoice amount, request cost, model tier or reliable paid usage.
- Existing `src/server/integrations/outbox/failure-policy.ts` is the provider dispatch classification source. F07 must not change its retry/suppression semantics or issue outbox commands.

## Lane A — source-authorized workflow and provider-related warning reviewer

`src/server/ai/f07-saved-workflow-critic.ts` re-reads the existing server-side, owner-authorized operational snapshot twice; requires workspace OWNER and `ALL` branch scope, bounded source page arrays and immutable source identity. It does not use customer messages, provider bodies, emails, addresses, billing amounts or private model reasoning. It creates static owner warnings only for:
- persisted `FAILED` action attempts, not new provider retry tasks
- contradictory `COMPLETED` workflow with non-success/non-suppressed action
- `PARTIAL_FAILED` workflow executions
- external-send action marked `SUCCEEDED` **without separately authenticated delivery evidence**; `SUCCEEDED` is not proof an email/WhatsApp was delivered
- unknown, potentially poisoned `errorCode`: show only a classification, never copy raw code or provider payload
- replay attempts with consistent saved same-run lineage requiring idempotency review, never queue automatic retries

All suspicious cross-tenant/branch/parent/action-index, missing replay source, duplicated attempt, invalid timestamp, non-allowlisted state, truncated source boundary or in-flight source revision fails closed. The digest proves only equality of the two supplied, bounded snapshot projections; it does not attest to older unseen rows.

## Lane B — AI model-spend warning truth boundary

`src/server/ai/f07-saved-ai-usage-review.ts` resolves current workspace OWNER twice and re-reads saved workspace-scoped `AI_ACTIONS` counters/limit twice. It validates exactly shaped records, UUIDs, periods, nonnegative safe counts, no duplicated periods, monotonic period interval and source changes. It can flag approaching/reached **platform AI_ACTIONS limits** and missing current-period history.

**Critical distinction:** This is not actual model billing: a saved `AI_ACTIONS` counter is not necessarily one model request or one charge. The output always reports `MODEL_SPEND_AMOUNT_UNVERIFIED`, `spendAmountMinor:null`, `currency:null`, token/cost evidence unavailable and prohibits any dollar/taka or provider success claim. Empty history yields UNKNOWN, never zero spend. No model API, usage consume or balance mutation occurs.

## Future Production authority, acceptance and replay safety

1. Owner/branch authorization and source integrity must remain valid at **actual persistence and provider processing time**, not just as a read-time snapshot. Consider per-branch scoped, purpose-specific roles rather than assuming owner access from a DTO.
2. Add or reuse documented, server-authorized provider delivery receipts and outbox job IDs, status transitions and retry budgets if enabling a factual delivery dashboard. Label raw provider codes untrusted. Preserve opt-out/quiet-hours veto and idempotent replay controls; never retry from AI output.
3. Model spending can only be shown from an independently authenticated, complete provider usage/billing ledger with model, token usage, currency, pricing/version, business date and refund/adjustment treatment. Implement request-level linkage and cost caps with separately approved DB changes; do not infer cost from `workspace_usage_counters` or `AI_ACTIONS`.
4. Run two-workspace/branch rejection and adversarial replay/source-change tests in Production staging after owner approval; do not treat the local source test suite as live acceptance. Recheck quota/pagination if source exceeds bounded loader limits.
5. Keep the F07 PR draft and untouched provider/outbox/SQL/contracts; Production exclusively owns schema approvals, canonical merge, external sends and release.

**Acceptance boundary:** F07 may be marked SOURCE_VERIFIED when the isolated code/tests, exact SHA, critic, CI, issue and interface documentation are recorded. It is **not** PROVIDER_VERIFIED or OPERATIONS_VERIFIED. All warnings are review suggestions and may not trigger outbound actions.
