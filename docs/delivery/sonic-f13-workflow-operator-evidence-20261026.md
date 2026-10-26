# ServiceDesk F13 — Persisted Workflow Operator Evidence Desk

**Issue:** #860 · **Master:** #808 · **Canonical at assignment:** `d8b77cbb3a62f7187ff79e5ffb0b2b0392d6e2be`. Feature Chat source only, not release approval.

## Why this batch
The canonical ServiceDesk V4 Automation Studio has rule authoring, saved event evaluation, a narrow WorkflowEvidenceStrip and attention recovery queue. The full saved workflow execution/action attempt inspector and intervention queue already exist but only appear inside AI Studio. Creating another automation planner, another simulated engine, or an unrelated policy would duplicate mature code while operators still cannot review failures where they manage automations.

## Source delta
- **Policy lane** `f13-guidance`: fixed, read-only advice from the existing persisted inspector state. Ambiguous attempts block replay; explicit failed states need human source/ledger review; owner-approval-required remains separate authority; processing does not mean late/failed; completed source status does not prove external delivery.
- **UI lane** `f13-ui`: existing WorkflowExecutionInspector displays read-only next steps and a stable `#workflow-evidence` location. Reuses the existing isolated per-attempt evidence, no second backend, no new mutable provider functionality.
- **Automation wiring lane** `f13-automations-wiring`: both Automation Studio branches (with no open attention and with recovery queue) render the same inspector from `selectWorkflowInspectorClientSnapshot(data)`; never pass raw operational rows.
- **Studio link lane** `f13-ai-studio-link`: navigates from AI Studio to the real Automation Studio inspector without triggering business commands.
- **Tests lane** `f13-regression`: confirms conservative ordering, invalid-data denial, zero authority, no customer/provider delivery claim.
- **Independent critic lane** `f13-critic`: validates both server render branches, same inspector reuse, branch-mismatched action exclusion and browser source projection.
- **Governance lane** `f13-governance`: this handoff. Coordinator integrates source-only DRAFT after current canonical merge-base and checks.

## Explicit guardrails
No database writer, scheduler, service-role mutation, token charge, model invocation, external message, payment, replay, auto approval, auto rule publish, migration, P02 owner creation, device modification or deployment. Already shipped workflow mutation forms remain as before; F13 adds **no** new command or authorization.

The browser receives only existing allowlisted rule version and run/action evidence. Existing source cap (up to 1,000 executions/2,000 attempts) and workflowAvailable unknown handling must remain visible; no all-clear from empty data. All suspected provider receipts are displayed as unverified. No inference from P02 auth UAT in source-only CI.

## Production conditions
Reconcile latest canonical, reject overlapping source changes, verify true authenticated OWNER-A/B workspaces, cross-branch action exclusion, zero-row and failed-source states, mobile keyboard/focus/anchor, workflow receipt consistency, and any old legacy PR overlap before choosing a merge. Do not mark original #173 workflow tasks LIVE from a F13 source test. Feature branch remains draft unmerged and Vercel auto deploy disabled; explicit project/SHA/env permission required for any deployment.
