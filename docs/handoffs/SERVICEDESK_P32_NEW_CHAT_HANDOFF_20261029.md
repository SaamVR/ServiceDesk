# ServiceDesk AI V4 SONIC — P32 New-Chat Handoff
Generated 2026-10-29. Repository: SaamVR/ServiceDesk.
Canonical: feat/servicedesk-v4-reconciled-qa-shell-20261012 @ cd218fcf196b7046c0bf6d7c0b990bb8d6bf9411.
Latest integrated source candidate: draft PR #883 @ 64a0034cc5028b7a129b6ca9b19873988407e1ab.

## Mandatory recovery first
Read this file in full, then reconcile live issues #808/#818/#819 and draft PRs #869/#871/#876/#877/#879/#880/#881/#882/#883 before source changes. Live GitHub overrides this snapshot. Do not burn the runtime re-running green checks without a concrete reason. After recovery, continue useful new source features/automation from the backlog. GitHub Actions first; device/RDC only when genuinely out of scope.

## Exact source state
All listed PRs are DRAFT, OPEN, UNMERGED, based on canonical cd218fcf.
- #876 ad9072d58bdba7f7238ec4cb92ac3d2e7467a174 — P25 mixed saved-book repair + first-run readiness — 7/7 GREEN.
- #877 9ebcba822a9cf1410fdce7dbee08588b1b958c7b — P26 truthful first-run pricing form states — 6/6 GREEN.
- #879 1a301ae2a9640eb268940ccdf58194b8ba173649 — P28 mixed/contradictory pricing evidence — 3/3 GREEN.
- #880 7e9ed171a7aad14294ae90efbc589af41f25d84a — P29 automation activation supported-cleaning + saved-book proof — 7/7 GREEN.
- #881 e3589f09a765e83caf95ee8287b48e14bc147f04 — P30 integrated P25/26/28/29, 14 exact source objects — 12/12 GREEN. Full run #40877133286: 765 test files / 3,773 tests PASS, TS + Next build PASS, ESLint 0 errors / 49 warnings.
- #882 d43bf0da3a054f662dc6cb90ec1369a1300a3525 — P31 truthful supported cleaning types vs active catalog items — 3/3 GREEN.
- #883 64a0034cc5028b7a129b6ca9b19873988407e1ab — P32 integrated owner setup/pricing/automation journey, 17 exact source objects — 12/12 GREEN as reconciled 2026-10-29.

P32 exact provenance: #876 owns 6 files, #877 2, #879 2, #880 4, #882 3. It retains earlier inner locks and adds docs/delivery/sonic-p03-p32-source-provenance-20261029.json + tests/e2e/v4-p32-owner-feature-provenance.test.ts.

DO NOT merge source PRs AND a composite. If #883 is later selected, originals are provenance/review lanes only.

## Delivered functionality
1. Owner pricing readiness can show saved-but-invalid repair and a different missing first-run branch together.
2. VERIFIED without independent existingBookBranchIds fails closed.
3. First-run form distinguishes unavailable evidence, configured branch, genuinely unpriced USD branch and unsupported currency; never overwrites saved rates.
4. Commercial onboarding counts repair-needed and missing books separately and rejects foreign/contradictory active-vs-saved evidence.
5. Automation activation credits only supported cleaning services and independently saved active books.
6. Owner onboarding distinguishes total active catalog items from distinct STANDARD/DEEP/MOVE_OUT cleaning types and fails closed on impossible counts.
7. QA covers mixed, missing, foreign, GBP, duplicate, contradictory, unavailable and selected-branch states.
8. Git blob provenance protects integrated source identity and release boundaries.

## P02/P03 production boundary
#818 P02 remains prerequisite for #819 P03. Earlier P02 source candidates #869/#871 are green, but live install/UAT is NOT authorized.
Latest development read-only Supabase observations: project cpmmgivhlkfbiwzhlcey PG17; 1 confirmed nonanonymous Auth user; 1 workspace; 1 branch; 0 saved services; 0 rate cards; 0 branch price books; servicedesk_security absent; authenticated can still execute servicedesk_register_owner_workspace(text,text,text,text); migration 0065 repair recorded.

Source CI is NOT live acceptance. Generic Continue does NOT authorize guarded migration install, Auth users/tenants, fictional prices/customer data, canonical/main merge, Vercel deploy, provider/payment actions, or destructive cleanup. Separate owner approval required for backup + live guard default CLOSED, real two-owner UAT, real P03 owner-entered pricing/readback, canonical merge, and production deploy.

## Multilane deadline workflow
Operate as a large engineering team with separable lanes: control tower/backlog, feature A/B/C, AI/automation, owner UX, pricing/quote correctness, branch/currency authorization, adversarial QA, security critic, accessibility, provenance/integration, CI receipts, docs/handoff, production-boundary reviewer, and research only when fresh external facts matter.
Use isolated branches from canonical unless deliberately rehearsing integration. Keep file ownership disjoint. Integrate exact reviewed blobs only. Run specialist CI + full source CI + independent critic on integrated head. Never weaken product behavior to satisfy tests; only repair stale fixtures when their data no longer matches their scenario.

## Next development batch
P32 is source-green: do not spend another run proving it.
1. Recover remaining feature/automation backlog from #808 and repository source.
2. Prioritize real AI/automation functionality: owner activation, attention events, playbooks and operational evidence; find missing automation or false-ready/unknown behavior and implement useful feature slices, not test-only churn.
3. Continue P03 source UX: catalog configuration, pricing revision/version/conflict guidance, quote readiness and recovery; never invent business prices.
4. Add accessibility/keyboard/status semantics where owner blockers are unclear.
5. Use isolated source PRs + negative QA + independent critic; composite only after source heads green.
6. Keep a small read-only production-security lane for drift detection, never live mutation.
7. If P03/automation has no meaningful source gap, advance the next unblocked #808 source feature rather than manufacturing readiness tests.

## Device policy
ServiceDesk sole development device preference: samvr. Do not move it to samai. GitHub Actions is default. Device only for out-of-scope work. Backup-first consolidation remains; no deletion of source/backups/credentials/shared dependencies without exact cleanup manifest and final approval.

## Required end-of-run report
Always report tasks implemented, exact branches/commits/PRs, CI receipts/failures/refinements, blockers, next batch, and whether any live DB/Auth/provider/deploy/merge mutation occurred. Never claim production-ready, P02/P03 complete, real two-owner acceptance, or live pricing without real operational evidence.
