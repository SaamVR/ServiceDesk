# P01 — Complete open PR source reconciliation

Canonical V4 exact SHA: 974e9f040071b1a2c1199c7ff6fb652a67812a47. Audit UTC: 2026-10-25T05:17:36.965849+00:00.
Open PRs: 67; classes: DEFER=25, MERGE_CANDIDATE=19, REBUILD=8, SUPERSEDED=15

A class is a SAFE TRIAGE suggestion, not independent review or merge approval.

| PR | Decision | Different/all files | Reason |
|---|---|---:|---|
| [#21](https://github.com/SaamVR/ServiceDesk/pull/21) Professionalize V2 jobs and quality workspace | DEFER | 1/1 | Earlier V3/visual base; cannot replay into V4 without redesign review |
| [#67](https://github.com/SaamVR/ServiceDesk/pull/67) Frontend V3: workflow-first staff shell and r | DEFER | 5/5 | Earlier V3/visual base; cannot replay into V4 without redesign review |
| [#68](https://github.com/SaamVR/ServiceDesk/pull/68) V3 registration: verified signup, owner works | DEFER | 23/34 | Earlier V3/visual base; cannot replay into V4 without redesign review |
| [#69](https://github.com/SaamVR/ServiceDesk/pull/69) Frontend V3: operational Inbox triage, queue  | DEFER | 6/6 | Earlier V3/visual base; cannot replay into V4 without redesign review |
| [#70](https://github.com/SaamVR/ServiceDesk/pull/70) Frontend V3: replace fake marketing hero with | DEFER | 3/4 | Earlier V3/visual base; cannot replay into V4 without redesign review |
| [#71](https://github.com/SaamVR/ServiceDesk/pull/71) V3 signup database: verified PG17 migration,  | DEFER | 3/3 | Earlier V3/visual base; cannot replay into V4 without redesign review |
| [#72](https://github.com/SaamVR/ServiceDesk/pull/72) Fix V3 signup runtime: modern Supabase key an | DEFER | 7/10 | Earlier V3/visual base; cannot replay into V4 without redesign review |
| [#73](https://github.com/SaamVR/ServiceDesk/pull/73) V3 account emails: SSR-safe signup and recove | DEFER | 3/5 | Earlier V3/visual base; cannot replay into V4 without redesign review |
| [#74](https://github.com/SaamVR/ServiceDesk/pull/74) V3 Auth callback: persist verified sessions w | DEFER | 1/8 | Earlier V3/visual base; cannot replay into V4 without redesign review |
| [#80](https://github.com/SaamVR/ServiceDesk/pull/80) V3 coordinated backend: workspace-choice doma | DEFER | 27/82 | Earlier V3/visual base; cannot replay into V4 without redesign review |
| [#83](https://github.com/SaamVR/ServiceDesk/pull/83) V3 Studio OS frontend redesign — operational  | DEFER | 35/107 | Earlier V3/visual base; cannot replay into V4 without redesign review |
| [#104](https://github.com/SaamVR/ServiceDesk/pull/104) V3 route bridge: WhatsApp, staff AI draft, re | DEFER | 6/6 | Earlier V3/visual base; cannot replay into V4 without redesign review |
| [#105](https://github.com/SaamVR/ServiceDesk/pull/105) V3 integration candidate: Studio OS + coordin | DEFER | 54/216 | Earlier V3/visual base; cannot replay into V4 without redesign review |
| [#120](https://github.com/SaamVR/ServiceDesk/pull/120) V4 Clean Air — bright image-led cleaning home | DEFER | 7/14 | Earlier V3/visual base; cannot replay into V4 without redesign review |
| [#122](https://github.com/SaamVR/ServiceDesk/pull/122) V4 Clean Air site-wide redesign: eight distin | DEFER | 9/24 | Earlier V3/visual base; cannot replay into V4 without redesign review |
| [#124](https://github.com/SaamVR/ServiceDesk/pull/124) V4 Clean Air guided tour + true local-only sa | DEFER | 13/28 | Earlier V3/visual base; cannot replay into V4 without redesign review |
| [#125](https://github.com/SaamVR/ServiceDesk/pull/125) V4 Clean Air guided tour: cleaning-first jour | DEFER | 9/29 | Earlier V3/visual base; cannot replay into V4 without redesign review |
| [#126](https://github.com/SaamVR/ServiceDesk/pull/126) V4 Clean Air Studio OS: white/aqua authentica | DEFER | 11/27 | Earlier V3/visual base; cannot replay into V4 without redesign review |
| [#127](https://github.com/SaamVR/ServiceDesk/pull/127) V4 Clean Air integrated visual candidate — si | DEFER | 16/39 | Earlier V3/visual base; cannot replay into V4 without redesign review |
| [#224](https://github.com/SaamVR/ServiceDesk/pull/224) V4 current-controller recovery: transactional | REBUILD | 5/12 | Competing migration 0063/transaction journal versions; choose one after SQL review |
| [#227](https://github.com/SaamVR/ServiceDesk/pull/227) V4 protected replay on race-tested 0063 journ | REBUILD | 2/5 | Competing migration 0063/transaction journal versions; choose one after SQL review |
| [#253](https://github.com/SaamVR/ServiceDesk/pull/253) V4 durable accepted-quote journal 0063 — reba | REBUILD | 6/17 | Competing migration 0063/transaction journal versions; choose one after SQL review |
| [#259](https://github.com/SaamVR/ServiceDesk/pull/259) V4 internal quote recovery: reconcile tested  | REBUILD | 10/21 | Competing migration 0063/transaction journal versions; choose one after SQL review |
| [#280](https://github.com/SaamVR/ServiceDesk/pull/280) V4 quote recovery source integration: journal | REBUILD | 9/21 | Competing migration 0063/transaction journal versions; choose one after SQL review |
| [#307](https://github.com/SaamVR/ServiceDesk/pull/307) V4 current-controller quote recovery: verifie | REBUILD | 9/21 | Competing migration 0063/transaction journal versions; choose one after SQL review |
| [#371](https://github.com/SaamVR/ServiceDesk/pull/371) V4 staff requests: verified cleaning quote ne | MERGE_CANDIDATE | 3/4 | Small current diff; manual semantics/CI needed before merging |
| [#564](https://github.com/SaamVR/ServiceDesk/pull/564) R15A Core: fail closed on incomplete tenant p | REBUILD | 2/2 | Critical core/schema delta requires integrated rebase and SQL review |
| [#565](https://github.com/SaamVR/ServiceDesk/pull/565) R15B AI: refuse unapproved symbol prices and  | MERGE_CANDIDATE | 1/2 | Small current diff; manual semantics/CI needed before merging |
| [#566](https://github.com/SaamVR/ServiceDesk/pull/566) R15C Product: saved quote review must exclude | MERGE_CANDIDATE | 1/2 | Small current diff; manual semantics/CI needed before merging |
| [#567](https://github.com/SaamVR/ServiceDesk/pull/567) R15 CRITIC-01 independent: merchant usefulnes | DEFER | 1/1 | Historic QA or critic only; not on launch critical path |
| [#568](https://github.com/SaamVR/ServiceDesk/pull/568) R15 Product: truthful owner price-book readin | MERGE_CANDIDATE | 4/4 | Small current diff; manual semantics/CI needed before merging |
| [#569](https://github.com/SaamVR/ServiceDesk/pull/569) R15 Core: reject ambiguous effective price-bo | REBUILD | 2/2 | Critical core/schema delta requires integrated rebase and SQL review |
| [#570](https://github.com/SaamVR/ServiceDesk/pull/570) R15 Connectors: exact recovered outbox recipi | MERGE_CANDIDATE | 2/2 | Small current diff; manual semantics/CI needed before merging |
| [#571](https://github.com/SaamVR/ServiceDesk/pull/571) R15D Product: exact zoned expiry proof for st | MERGE_CANDIDATE | 2/4 | Small current diff; manual semantics/CI needed before merging |
| [#573](https://github.com/SaamVR/ServiceDesk/pull/573) R15 CRITIC-01: independent adversarial review | DEFER | 1/1 | Historic QA or critic only; not on launch critical path |
| [#596](https://github.com/SaamVR/ServiceDesk/pull/596) R19A Core: reject ambiguous saved rate-card a | SUPERSEDED | 0/2 | All changed-file blobs identical to canonical |
| [#597](https://github.com/SaamVR/ServiceDesk/pull/597) R19B AI: require civil-valid zoned owner brie | MERGE_CANDIDATE | 1/2 | Small current diff; manual semantics/CI needed before merging |
| [#598](https://github.com/SaamVR/ServiceDesk/pull/598) R19C Product: reject forged delivery clock an | MERGE_CANDIDATE | 1/2 | Small current diff; manual semantics/CI needed before merging |
| [#599](https://github.com/SaamVR/ServiceDesk/pull/599) R19D Connectors: refuse malformed recovered t | SUPERSEDED | 0/2 | All changed-file blobs identical to canonical |
| [#600](https://github.com/SaamVR/ServiceDesk/pull/600) CRITIC-01 R19: independent merchant efficacy  | DEFER | 1/1 | Historic QA or critic only; not on launch critical path |
| [#602](https://github.com/SaamVR/ServiceDesk/pull/602) R19E Critic follow-up: owner brief second-rea | MERGE_CANDIDATE | 1/2 | Small current diff; manual semantics/CI needed before merging |
| [#607](https://github.com/SaamVR/ServiceDesk/pull/607) R20A Core: fail closed on duplicate-priced ow | SUPERSEDED | 0/2 | All changed-file blobs identical to canonical |
| [#608](https://github.com/SaamVR/ServiceDesk/pull/608) R20B Connectors: reject impossible and unzone | SUPERSEDED | 0/2 | All changed-file blobs identical to canonical |
| [#609](https://github.com/SaamVR/ServiceDesk/pull/609) R20C Product: invoice checkout preflight refu | SUPERSEDED | 0/2 | All changed-file blobs identical to canonical |
| [#610](https://github.com/SaamVR/ServiceDesk/pull/610) R20D Calendar: reject malformed outbox claim  | SUPERSEDED | 0/2 | All changed-file blobs identical to canonical |
| [#612](https://github.com/SaamVR/ServiceDesk/pull/612) CRITIC-01 R20: independent merchant-usefulnes | DEFER | 2/2 | Historic QA or critic only; not on launch critical path |
| [#615](https://github.com/SaamVR/ServiceDesk/pull/615) R20 integration: pricing, WhatsApp chronology | SUPERSEDED | 0/8 | All changed-file blobs identical to canonical |
| [#618](https://github.com/SaamVR/ServiceDesk/pull/618) CRITIC-01 R21: independent merchant usefulnes | DEFER | 1/1 | Historic QA or critic only; not on launch critical path |
| [#631](https://github.com/SaamVR/ServiceDesk/pull/631) Frontend lane: searchable accessible AI Studi | SUPERSEDED | 0/8 | All changed-file blobs identical to canonical |
| [#633](https://github.com/SaamVR/ServiceDesk/pull/633) Frontend/AI: persisted workflow execution ins | MERGE_CANDIDATE | 1/7 | Small current diff; manual semantics/CI needed before merging |
| [#645](https://github.com/SaamVR/ServiceDesk/pull/645) AI-A: bound saved quote reviewer to exact rec | MERGE_CANDIDATE | 2/7 | Small current diff; manual semantics/CI needed before merging |
| [#650](https://github.com/SaamVR/ServiceDesk/pull/650) Frontend AI: canonical-based owner diagnostic | MERGE_CANDIDATE | 2/15 | Small current diff; manual semantics/CI needed before merging |
| [#661](https://github.com/SaamVR/ServiceDesk/pull/661) SONIC UX-1: long-running AI draft, safe human | SUPERSEDED | 0/11 | All changed-file blobs identical to canonical |
| [#662](https://github.com/SaamVR/ServiceDesk/pull/662) SONIC UX-2: trusted delivery sample, Stop che | SUPERSEDED | 0/7 | All changed-file blobs identical to canonical |
| [#665](https://github.com/SaamVR/ServiceDesk/pull/665) SONIC UX-3: replay-aware workflow evidence an | SUPERSEDED | 0/7 | All changed-file blobs identical to canonical |
| [#668](https://github.com/SaamVR/ServiceDesk/pull/668) SONIC UX-4: search, filter and safely prefill | MERGE_CANDIDATE | 2/6 | Small current diff; manual semantics/CI needed before merging |
| [#681](https://github.com/SaamVR/ServiceDesk/pull/681) R35 L22 · Verified Gregorian dispatch days an | MERGE_CANDIDATE | 1/6 | Small current diff; manual semantics/CI needed before merging |
| [#682](https://github.com/SaamVR/ServiceDesk/pull/682) R35 L07 · Evidence-verified field quality dea | SUPERSEDED | 0/5 | All changed-file blobs identical to canonical |
| [#683](https://github.com/SaamVR/ServiceDesk/pull/683) R35 L23 · Invoice reminder resets on ledger d | SUPERSEDED | 0/3 | All changed-file blobs identical to canonical |
| [#685](https://github.com/SaamVR/ServiceDesk/pull/685) R35 L21 · Actionable, source-grounded owner q | SUPERSEDED | 0/5 | All changed-file blobs identical to canonical |
| [#687](https://github.com/SaamVR/ServiceDesk/pull/687) R35 L13 · Direct AI Studio command palette, t | SUPERSEDED | 0/3 | All changed-file blobs identical to canonical |
| [#689](https://github.com/SaamVR/ServiceDesk/pull/689) R35 L13/18 · Real owner AI workflow proposal  | MERGE_CANDIDATE | 2/12 | Small current diff; manual semantics/CI needed before merging |
| [#706](https://github.com/SaamVR/ServiceDesk/pull/706) SONIC R36 AI-E: photo classification input an | MERGE_CANDIDATE | 2/4 | Small current diff; manual semantics/CI needed before merging |
| [#716](https://github.com/SaamVR/ServiceDesk/pull/716) SONIC R37 AI-E: owner-trusted automation draf | MERGE_CANDIDATE | 3/5 | Small current diff; manual semantics/CI needed before merging |
| [#723](https://github.com/SaamVR/ServiceDesk/pull/723) SONIC R38 C25: exact saved owner Inbox delive | MERGE_CANDIDATE | 2/3 | Small current diff; manual semantics/CI needed before merging |
| [#750](https://github.com/SaamVR/ServiceDesk/pull/750) SONIC R42 L21: batch prepare up to 12 saved-b | MERGE_CANDIDATE | 3/5 | Small current diff; manual semantics/CI needed before merging |
| [#830](https://github.com/SaamVR/ServiceDesk/pull/830) F01 draft: persisted intake classification an | DEFER | 4/4 | New Feature Chat F01 PR; do not merge in P01 |

## Overlap hotspots

- tests/e2e/staff-v3-navigation.test.tsx (10 PRs): #67, #68, #83, #105, #120, #122, #124, #125, #126, #127
- src/components/shell/MarketingNavV3.module.css (9 PRs): #68, #83, #105, #120, #122, #124, #125, #126, #127
- src/features/auth/RegistrationShell.module.css (8 PRs): #68, #83, #105, #122, #124, #125, #126, #127
- src/features/operations/OperationalProductRoute.tsx (7 PRs): #69, #83, #105, #371, #645, #668, #681
- tests/providers/v2-migration-rehearsal.test.ts (7 PRs): #68, #105, #224, #253, #259, #280, #307
- src/components/product/StaffAppShell.tsx (6 PRs): #67, #68, #83, #105, #126, #127
- src/features/product/BrightHomeExperience.module.css (6 PRs): #120, #122, #124, #125, #126, #127
- tests/e2e/v4-clean-air-home.test.tsx (6 PRs): #120, #122, #124, #125, #126, #127
- .github/workflows/v2-release-focused.yml (5 PRs): #67, #68, #69, #72, #73
- .github/workflows/v4-quote-source-recovery-rc.yml (5 PRs): #224, #253, #259, #280, #307
- scripts/release/v3-public-browser-proof.mjs (5 PRs): #105, #120, #122, #124, #126
- scripts/release/v3-public-browser-proof.test.mjs (5 PRs): #105, #120, #122, #124, #126
- src/features/operations/StaffOverviewDashboard.module.css (5 PRs): #67, #68, #83, #105, #127
- src/features/product/BrightProductPages.module.css (5 PRs): #122, #124, #125, #126, #127
- src/server/workflows/customer-quote-source-recovery.ts (5 PRs): #224, #253, #259, #280, #307
- tests/db/v4-quote-accepted-source-recovery.test.ts (5 PRs): #224, #253, #259, #280, #307
- tests/e2e/v4-clean-public-pages.test.tsx (5 PRs): #122, #124, #125, #126, #127
- .github/workflows/v4-quote-recovery-integrated-pg17.yml (4 PRs): #253, #259, #280, #307
- src/components/shell/MarketingShell.tsx (4 PRs): #68, #70, #105, #120
- src/app/api/internal/workflows/quote-source/route.ts (3 PRs): #227, #253, #259
- src/app/auth/continue/route.ts (3 PRs): #68, #72, #83
- src/features/operations/OperationalProductRoute.module.css (3 PRs): #69, #83, #105
- src/features/operations/OwnerQuoteAcceptedAutomationControl.tsx (3 PRs): #259, #280, #307
- src/features/operations/OwnerQuoteRecoveryQueue.tsx (3 PRs): #259, #280, #307
- src/features/operations/operational-product-runtime.ts (3 PRs): #72, #105, #568
- src/server/workflows/owner-quote-recovery-queue.ts (3 PRs): #259, #280, #307
- tests/db/v4-owner-quote-recovery-queue.test.ts (3 PRs): #259, #280, #307
- tests/e2e/v3-ai-staff-http.test.ts (3 PRs): #80, #104, #105
- docs/execution/v4-quote-source-recovery-staging-acceptance.md (2 PRs): #224, #227
- src/app/auth/confirm/route.ts (2 PRs): #68, #72
- src/app/auth/sign-in/page.tsx (2 PRs): #68, #105
- src/app/auth/sign-up/page.tsx (2 PRs): #68, #105
- src/app/page.tsx (2 PRs): #68, #105
- src/app/tour/page.tsx (2 PRs): #105, #124
- src/app/tour/tour.module.css (2 PRs): #125, #127
- src/components/product/StaffCleanAirV4.module.css (2 PRs): #126, #127
- src/components/product/StaffCommandPalette.tsx (2 PRs): #83, #105
- src/components/product/StaffWorkspaceV3.module.css (2 PRs): #67, #68
- src/features/onboarding/onboarding-product-runtime.ts (2 PRs): #68, #72
- src/features/operations/AiStudioWorkspace.tsx (2 PRs): #633, #650

## Manual critical-path priority

1. Evaluate P01/P02 onboarding, prices and confirmed target; P03 service catalog and real rate books before any invented business SUCCESS.
2. P05 select a SINGLE reviewed 0063 recovery design from #307, #280, #259, #253, #224, #227; no schema application without separate owner approval.
3. P08 review AI Studio candidates #650/#645/#662/#661/#631/#633 and latest Feature Chat #830; no bulk merging.
4. Older V3/visual PRs cannot be bulk replayed against current V4 source.

## Authority and evidence

Only exact SHA and Git changed-file blob were compared. No runtime integration, user approval or production deploy is implied.
Do not close source PRs on the basis of this audit without an explicit closing/cleanup approval.
Render My Workspace requires owner workspace confirmation. Supabase connected project contains no priced services/books or completed quote.
No source changes, databases writes, paid API invocations, production deploys, or deletion occurred in this audit.
