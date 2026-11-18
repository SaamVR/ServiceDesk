# SONIC semantic PR follow-up — six high-priority candidates (2026-11-18)

**Scope:** Source-only review of #913, #907, #906, #908, #901 and #893. Pinned integrated HEAD `2f3c1cc21005ce8f555ecde9514a5e0d0d8438a5`, [draft #915](https://github.com/SaamVR/ServiceDesk/pull/915); original [127-PR inventory](https://github.com/SaamVR/ServiceDesk/blob/6926bc60c4b62bc2caac9556125ba27539e3c467/docs/integration/open-pr-reconciliation-20261118.json). This is an additive review checkpoint, **not approval** to merge any candidate.

## Reconciliation freshness

- Production main is `56872ccbd7fbe6de043c35d9d8d37d32c4b726ac`; #915 remains open/draft/unmerged at the observed HEAD.
- Since original audit SHA `6926bc60...`, integration advanced **two fast-forward commits**: owner pricing-readiness implementation, targeted tests/critics and a successor source lock; original 127-entry inventory remained readable unchanged.
- Exact-head [integrated CI #44202705888](https://github.com/SaamVR/ServiceDesk/actions/runs/44202705888) **5/5 success**, [independent critic #44202705831](https://github.com/SaamVR/ServiceDesk/actions/runs/44202705831) **success**, [browser CI #44202705822](https://github.com/SaamVR/ServiceDesk/actions/runs/44202705822) **two source/synthetic jobs success** but **protected real two-owner authenticated job SKIPPED**. These are source gates, not P02 live UAT.
- Last inventory: 52 already incorporated; 48 provisional duplicates; 17 unique review candidates; 10 blocked/rejected. **No classification is changed in this follow-up and zero unique source imports were made.**
- Current live review counts checked on all six candidates: **0 submitted reviews each**, thus 0 APPROVED. This snapshot does not attest to the other 11 candidates' current review state.

## Source-level findings and dispositions

| PR | Observed change vs current integration | Review disposition |
|---|---|---|
| [#913](https://github.com/SaamVR/ServiceDesk/pull/913) | Four F15 SLA read-only UI/server modules absent; current integration has *different* owner-gated Inbox F15 manual escalation and review evidence paths. No established functional equivalence. | UNIQUE_AWAITING_APPROVAL; compare overlapping journeys |
| [#907](https://github.com/SaamVR/ServiceDesk/pull/907) | `owner-attention-triage.ts` differs: current execution Map silently retains last duplicate LIVE ID; candidate quarantines duplicate IDs. Candidate also uses strict `trustedQuoteInstant` where current uses `Date.parse`. | **BLOCKED_SECURITY_REVIEW**; high-priority regression/critic |
| [#906](https://github.com/SaamVR/ServiceDesk/pull/906) | Two absent standalone modules: nine unsaved owner-rate scenarios and fictional internal attention what-if. Existing live pricing does not imply these previews are present. | UNIQUE_AWAITING_APPROVAL; P03 source-only |
| [#908](https://github.com/SaamVR/ServiceDesk/pull/908) | Three absent owner overdue-attention UI/action/next-step modules. | UNIQUE_AWAITING_APPROVAL; align with current attention model |
| [#901](https://github.com/SaamVR/ServiceDesk/pull/901) | Absent manual attention review playbook. Depends on security-correct triage. | UNIQUE_AWAITING_APPROVAL; after #907 |
| [#893](https://github.com/SaamVR/ServiceDesk/pull/893) | Absent owner commercial-action panel and automation next-step module. Latest owner pricing-readiness changes require conflict review. | UNIQUE_AWAITING_APPROVAL; product decision |

**Caution on #913:** PR title is IR19 F18 consent-checked reply drafts, **not** "F15 only." The four cited absent F15 files are one historical subfeature within that stacked PR. The current integration already contains `InboxConsentedDraftPanel.tsx` and `InboxProtectedLeadReviewPanel.tsx`; compare semantic behavior, never replace the whole stack blindly.

**#907 code-level concern:** Existing `new Map(...map(row => [row.id,row]))` overwrites duplicate LIVE IDs; #907's candidate `duplicateLiveExecutionIds` set removes/quarantines ambiguous IDs. Existing `Date.parse` may accept a timezone-free deadline; candidate uses strict `trustedQuoteInstant` (existing helper in integration). This is a static behavioral difference with plausible false-ready consequences. It is **not** a demonstrated runtime data leak or production vulnerability; validate on isolated tests before importing.

## Ordered next actions

1. Security/QA independently review #907 and run the exact P43 duplicate-ID and P41 malformed-time regression contracts on a safe isolated candidate, without importing the whole P42/P44 stack.
2. Integrator review provenance and historic source-lock critics before altering the shared attention triage file.
3. Product + security resolve #913 F15 read-only versus current atomic/manual Inbox flow; keep F18 consent/draft behavior.
4. Frontend/QA test #906 nine-scenario unsaved form matrix and fictional playbook what-if without inventing rates or treating previews as execution.
5. Review #901 and #908 against hardened triage; check branch scope, unauthorized actor, missing evidence and read-only boundaries.
6. Compare #893 guidance with latest P03 owner pricing readiness.
7. Continue remaining 11 unique candidate reviews, then semantically validate the 48 provisional duplicates; retain original PRs until supported decisions.
8. Keep registration #869 separate for DBA authorization, P02 2/7 and P03 0/6. Do not deploy or promote main without scoped approval.

## Mutation and release receipt

**This follow-up changes documentation only on an isolated review branch.** No accepted feature import, source behavior, tenant fixtures, SQL, paid/provider event, Vercel deploy, canonical/main merge or PR closures. Owner and independent reviewer decisions remain pending. Machine-readable review: `docs/integration/open-pr-semantic-review-20261118.json`.

## Second review wave — remaining 11 of the 17 candidates

The nine predecessor PRs below were independently re-read at their **live draft HEADs**. Each has **zero submitted reviews**, and the cited unique module blobs were compared byte-for-byte against the named later composite. In all **10 checked path pairs**, Git blob SHAs match exactly:

| Historical predecessor | Review composite | Compared unique payload |
|---|---|---|
| [#905](https://github.com/SaamVR/ServiceDesk/pull/905) | #908 | OverdueAttentionReview UI + projection |
| [#903](https://github.com/SaamVR/ServiceDesk/pull/903) | #906 | Fictional playbook event what-if |
| [#902](https://github.com/SaamVR/ServiceDesk/pull/902) | #906 | Owner pricing scenario matrix |
| [#897](https://github.com/SaamVR/ServiceDesk/pull/897) | #901 | Attention review playbook |
| [#896](https://github.com/SaamVR/ServiceDesk/pull/896) | #908 | Owner activation next action |
| [#889](https://github.com/SaamVR/ServiceDesk/pull/889) | #893 | Owner commercial action panel |
| [#887](https://github.com/SaamVR/ServiceDesk/pull/887) | #893 | Owner automation next action |
| [#886](https://github.com/SaamVR/ServiceDesk/pull/886) | #893 | Owner commercial action panel |
| [#885](https://github.com/SaamVR/ServiceDesk/pull/885) | #893 | Owner automation next action |

**Disposition:** `REVIEW_THROUGH_COMPOSITE` for these **cited paths only**, not a global PR supersession approval. Importing a predecessor and its selected composite would duplicate these unique files. No older PR was closed or reclassified in the original 127-entry inventory.

The last two unique candidates are independent decisions:

- [#916](https://github.com/SaamVR/ServiceDesk/pull/916) has four absent IDE/coding policy files (`.agents/skills/karpathy-guidelines/SKILL.md`, `.cursor/rules/karpathy-guidelines.mdc`, `.github/copilot-instructions.md`, `CLAUDE.md`). **Zero reviews, governance-owner approval required**; do not modify `AGENTS.md` silently.
- [#124](https://github.com/SaamVR/ServiceDesk/pull/124) has absent legacy `src/app/tour/BrightTour.module.css`. **Zero reviews, design-owner approval required**, confirm compatibility with newer tour/brand before import.

**Coverage accounting:** 17/17 initially unique candidates have now received a pinned, cited-path review. They can be managed as **six primary feature review tips + nine byte-identical predecessor source paths + two governance/design decisions**. This is **not** full PR semantic acceptance, and the 48 provisional duplicates still require review. Original totals 52/48/17/10 remain unchanged. All 17 unique candidates have zero submitted reviews at the time checked, hence zero automatic approvals.

Machine evidence remains in this report's companion JSON.

## Third review wave — 10 of 48 provisional duplicates

This wave compares the **identified high-value source module** at each provisional PR head to exact integrated HEAD `2f3c1c`; it does **not** establish full-PR equivalence. Four paths are byte-identical to integration; four have meaningful divergent versions; two are older source versions whose current successor must preserve intended behavior.

| PR | Checked path/result | Disposition for follow-up |
|---|---|---|
| [#904](https://github.com/SaamVR/ServiceDesk/pull/904) | `owner-attention-triage.ts` differs from current; **exact same blob as #907** | Candidate duplicate-LIVE-ID security remedy, retain under #907 review |
| [#899](https://github.com/SaamVR/ServiceDesk/pull/899) | `owner-attention-triage.ts` differs; exact same blob as #901 | Candidate strict zoned attention deadline remedy |
| [#898](https://github.com/SaamVR/ServiceDesk/pull/898) | `owner-automation-draft-recommendations.ts` identical to integration | Byte-identical sampled module, complete semantic review still needed |
| [#895](https://github.com/SaamVR/ServiceDesk/pull/895) | `owner-pricing-revision-access.ts` identical | Byte-identical sampled module |
| [#892](https://github.com/SaamVR/ServiceDesk/pull/892) | `owner-attention-triage.ts` identical | Current older triage lacks #904/#907 guards |
| [#891](https://github.com/SaamVR/ServiceDesk/pull/891) | `owner-automation-activation.ts` identical | Byte-identical sampled module |
| [#890](https://github.com/SaamVR/ServiceDesk/pull/890) | `quote-pipeline.ts` differs; **exact same stricter blob in #893** | Potential zoned quote-clock behavior missing |
| [#888](https://github.com/SaamVR/ServiceDesk/pull/888) | `request-quote-price-readiness.ts` differs; **exact same stricter blob in #893** | Potential false-ready branch pricing projection |
| [#880](https://github.com/SaamVR/ServiceDesk/pull/880) | `owner-automation-activation.ts` older than integrated | Superset check pending; do not roll back |
| [#877](https://github.com/SaamVR/ServiceDesk/pull/877) | `OwnerCleaningPricingSetupForm.tsx` older than latest integrated | Current source has newer owner pricing changes; no rollback |

### Critical static false-readiness candidates

**#888:** Current `quotePriceReadiness` can choose `selectedBranchId` or the sole `activeBranchIds[0]` when the saved request's `branchId` is absent. The candidate refuses to guess a request branch, requires independent `existingBookBranchIds`, authorization in current branch scope and supported USD currency. That is an observable projection difference; the server is still responsible for authoritative quote creation. The specific candidate **8-case** Vitest file `tests/e2e/v4-p36-owner-request-quote-price-preflight.test.ts` is absent at integration HEAD. Recommend independent regression before any source change.

**#890:** Current `quote-pipeline.ts` uses `Date.parse` to assess snapshot and quote expiry. The unimported candidate uses `trustedQuoteInstant`, rejects timezone-free, impossible civil dates and invalid offset, and routes uncertain expiry to review. Its **4-case** zoned-clock test `tests/e2e/v4-p38-quote-pipeline-zoned-clock.test.ts` is absent. Queue correctness, not an independently proven authorization bypass.

**#904/#899:** Current attention triage also lacks P43 duplicate identity and P41 strict-clock protections; their **6-case** and **5-case** candidate test files are absent from integration. #904 source is byte-identical to the #907 review tip; import no old head separately.

**Priority:** #907 + #888 + #890 are security/false-ready review candidates. Do not call these provisional PRs safely superseded until their behavior is preserved by an independently tested and authorized implementation. Do not claim runtime test failure without executing the exact repository tests.

The initial 127-entry ledger is preserved; the 48 provisional labels remain provisional rather than silently promoting unapproved source. **38 provisional PRs have not yet had this follow-up semantic check.**
