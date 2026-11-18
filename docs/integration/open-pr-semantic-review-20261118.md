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
