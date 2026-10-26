# ServiceDesk F12 — Owner automation opportunity workbench (Feature-only)

**Issue:** [#858](https://github.com/SaamVR/ServiceDesk/issues/858) · control [#808](https://github.com/SaamVR/ServiceDesk/issues/808). Base canonical `d5e86b369c46384278be8006812a3e27c41da21e`.

## Product delta and strict source truth
This feature makes the existing **saved-workday-based** `suggestOwnerAutomationOpportunities` useful in the UI. Instead of adding another mock planner, the new `/app/[workspace]/automations/opportunities` owner page:
1. Loads the lightweight authenticated `resolveStaffActor` owner and branch scope at render, **not** the expensive full operational staff snapshot. This is UI scope discovery only, not acceptance proof.
2. On explicit click, invokes a **server action** that reuses the existing double-owner-workday and actor-resolution engine, with correct `workspace_branches` active membership queries on both branch checks (the existing generic `branches` fallback is deliberately overridden). Denies untrusted slugs, forged workspaces, inactive branches or invalid result contracts.
3. Returns a bounded browser-safe projection of only `CRITICAL_ATTENTION` or `OPEN_REQUEST` positive counts to **future** `ATTENTION_OPENED` or `REQUEST_CREATED` internal `CREATE_ATTENTION` drafts. Does NOT pretend existing queued work was processed.
4. The client independently validates all source labels, scope, action types, summary keys, counts and explicit false-effect booleans, then shows safe locally fixed labels.
5. Allows a second explicit **fictional** rule-engine preview via the **existing** owner-protected `requestOwnerWorkflowWhatIf`. It never publishes, saves or sends anything.
6. Adds navigation from the existing Automation Studio. No paid AI provider call is required.

The server action still depends on the operational database and valid signed-in active OWNER/branch records at runtime; green unit/CI results are NOT a real two-tenant staging read, source-receipt proof or deployed feature. The opportunity engine uses future-event inferences from saved *workspace-aggregate queue counts* (NOT filtered by the currently selected branch), not a stored-rule writer nor a tenant-scoped event journal. The selected active branch only scopes the proposed future rule/preview. The UI must never imply that displayed queue counts belong to that branch. The browser never receives raw customer records, private notes, API keys or billing amounts.

## Disjoint source ownership and critic
- Action: `sonic-feature/f12-owner-action-20261026` owns `owner-opportunity-preview-action.ts` and independent tests.
- Browser contract: `sonic-feature/f12-browser-contract-20261026` owns `owner-opportunity-preview-proof.ts` and its adversarial tests.
- Workbench: `sonic-feature/f12-owner-workbench-20261026` owns `OwnerOpportunityWorkbench.tsx` and private CSS module.
- Route: `sonic-feature/f12-route-access-20261026` owns new owner route and the Automation Studio discoverability link.
- Critic: `sonic-feature/f12-critic-20261026` adds crosslane old-engine and new-result no-side-effect tests.
- Governance: `sonic-feature/f12-governance-20261026` owns this exact-source handoff.
- Integration: `sonic-feature/f12-integrated-20261026` combines disjoint Git blob paths into a DRAFT PR.

## Production gates
The Feature lane cannot merge the draft, apply database migrations, create a real owner, call a paid model/provider, send emails/WhatsApp, mutate a financial record, publish a rule, deploy or change device state. Production must independently verify authoritative workspace_branches active membership and two distinct OWNER identities, proper stable workday loader, real saved source rows, branch switch revocation, browser navigation and accessibility on approved staging; only then decide merge and deployment. Existing F08–F11 drafts remain separately unmerged. No task in #173 becomes LIVE because F12 source tests pass. Publish and retroactive processing are deliberately unsupported here.
