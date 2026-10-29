# ServiceDesk IR15 — dedicated feature integration lane (2026-10-30)

## Scope and authority
Source-only **integration review**. No canonical/main merge, no staging/prod DB or Auth mutation, no Vercel project/import/preview/deployment, no provider sending/payment/AI spend, no customer fixture, no cleanup, no device move. Product readiness control remains P02 #818, followed by P03 #819 and the unchanged P04–P12 program in #808. The source-integration lane does not claim that production-readiness work has completed or is executing unattended.

## Reviewed source parents
- P36 owner journey [draft #900](https://github.com/SaamVR/ServiceDesk/pull/900): `cb28d52912c4d2b2ad4e8b663b339db3241a3c84`, from P34 #894.
- IR14 AI/automation feature bundle [draft #865](https://github.com/SaamVR/ServiceDesk/pull/865): `5bd1d365c6afd149f3619ffe5317231fd8a7de6f`, from independent feature drafts #841/#852/#854/#857/#859/#861.
- Branch `sonic-integration/ir15-feature-p36-union-20261030` is based on P36; it **does not merge either PR to canonical**.

## What was genuinely integrated
1. AI saved-record intake, pricing suggestions, dispatch/QA, finance/BI, consent/retention, versioned what-if, typed proposed triggers/actions, audit/failure reviews from the F08 bundle.
2. F09–F11 strict source-only event, rule/action and operational exception proposals.
3. F12 owner automation opportunities, authorized proof/preview and existing authenticated view.
4. F13/F14 persisted workflow evidence inspection and accessible owner anomaly handoff.
5. P36 retained owner pricing branch/CAS preflight, actual Settings scope wiring, deterministic playbook next-step links and owner attention triage.

### Merge conflict and resolution
The only common changed path across #865 and #900 is `src/features/operations/OperationalProductRoute.tsx`. Exact IR14 route bytes cannot be copied because that would overwrite the later P36 authorized `scope={data.branchScope}` revision fix. IR15 retains the exact P36 route and applies the two IR14 owner/staff workflow-inspector rendering sites using the preexisting browser-safe projection `selectWorkflowInspectorClientSnapshot(data)`. This is **one reviewed reconciled source object**, not an exact untouched copy from either PR.

The machine-readable manifest `sonic-ir15-p36-f14-union-source-lock-20261030.json` pins 77 unchanged IR14 Git blobs, both prior route blob SHA identities and the explicitly reconciled route SHA. It also records two historical source-lock test adaptations, pinning both previous/revised Git SHA1 objects. The original IR14/P36 source manifests and canonical repository are not altered. Do not double merge original feature PRs and their composite.

## Deliberate non-live gates
- F06/F09 typed event/action proposals do not publish new shared contract actions. Fourteen AI agent journeys are not declared operational, 27 starter playbooks are not 27 active jobs and the 72-operation backlog is not completed.
- Internal workflow review is read-only; no worker replay or external provider send is introduced.
- P02 two-owner JWT/browser UAT and registration security guard remain open; P03 still has zero accepted real owner pricing readback. A passing source integration is not approval to deploy or sell.

## CI strategy (avoid repeated validation)
A single source-only targeted integration check covers existing AI/F08–F14 cross-feature suites, historical and IR15 exact-source locks, pricing/owner negative regressions, TypeScript and changed-file ESLint. **Do not rerun a full 3,800+ test/check:rc suite for this source-only branch after already-green parents**; reserve the one consolidated full/Chrome/PG17/guardian pass for a separately authorized production-boundary merge gate. If focused CI fails, repair its specific introduced integration regression instead of repeating unrelated green tests.

## Production handoff
Review this branch/PR independently of the P02 owner onboarding and security lane. Treat all source candidates as DRAFT. To advance release, obtain distinct owner authorization for exact target/SHA and next P02 operational tasks. No background/ongoing independent lane execution is implied by this document.
