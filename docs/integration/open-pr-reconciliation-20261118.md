# ServiceDesk — all-open-PR reconciliation, pinned ed542e40d72a

**Observation date:** 2026-11-18 · **Scope:** all 127 OPEN PRs and their exact head branches at the observation checkpoint.  
**Full machine-readable PR-by-PR ledger:** `docs/integration/open-pr-reconciliation-20261118.json` (127 entries with PR number, full title, branch, SHA, classification, evidence, confidence and candidate scope).

| Classification | Count | Disposition |
|---|---:|---|
| ALREADY_INCORPORATED | 52 | 22 exact commit ancestors (incl. #915) and 30 divergent-history heads whose PR-changed files have exact integrated blob contents; do not merge twice |
| SUPERSEDED_OR_DUPLICATE_PROVISIONAL | 48 | Older changed-file versions or docs/test-only gaps; **do not close or delete** until source-owner semantic review |
| UNIQUE_REVIEW_CANDIDATE | 17 | Different/missing feature modules, security variants or policy files; source-only design/code review, independent tests and owner approval first |
| BLOCKED_OR_REJECTED | 10 | Registration/quote-recovery sensitive branches held behind explicit owner/DBA/security gates |

## High-value unique review tips — never blindly merge stacked predecessors

- **#913**: F15 owner Inbox SLA/readback widgets; four core files absent from current integration. Reconcile against newer F15 atomic semantics.
- **#907**: P44 duplicate LIVE execution security quarantine and provenance tests. Existing `owner-attention-triage.ts` differs. Independent adversarial critic mandatory.
- **#906**: P40 owner-entered pricing scenario matrix + internal automation playbook what-if, two missing standalone modules; #902/#903 are contributing predecessors.
- **#908**: Owner overdue saved-attention evidence and activation actions; #905/#896 predecessor work; P03 blocked until P02 real acceptance.
- **#901**: Zoned attention playbook, also review #907 composition; #897 predecessor.
- **#893**: P03 onboarding commercial actions, missing `OwnerCommercialActionPanel.tsx` and owner automation next action; predecessors #885/#886/#887/#889.
- **#916**: Unique instructions/IDE guidance. Cannot modify project AGENTS/CLAUDE/Copilot policies without governance review.
- **#124**: Legacy bright-tour CSS not present. Design-owner approval required; do not regress newer visual system.

## No blind source integration at this checkpoint

The **17 unique candidates all have zero submitted APPROVED PR reviews** at the observed checkpoint. User-directed consolidation does not provide independent QA/security approval of each candidate. Safe approved code imports made in this audit: **0**. The only authorized consolidation is this evidence-ledger checkpoint; the source tree and protected `main`/`canonical` remain unaltered.

**Release protection:** P02 #818 still 2/7; P03 #819 0/6. Supabase `cpmmgivhlkfbiwzhlcey` inactive; #869 SQL unapplied/unmerged; real two-owner Auth and RLS/Chrome receipts not performed. No DB restart, migration, credentials, provider/payment/customer mutation, Vercel deployment, main/canonical merge, or force-push.

## Deterministic review order

1. Independently confirm top-tip PR head SHA and current integration SHA. Obtain explicit approval per tip and retain critical guards.
2. For each feature family, review the **umbrella/tip** first against all predecessor PRs, and record consumed blob SHAs. Do not import all versions.
3. Resolve overlapping integration paths serially: Inbox #913, P44 #907, P40 #906, overdue #908, P42 #901, P03 commercial #893, governance #916, visual #124.
4. Test contracts then runtime/build/PG17 source tests; real JWT/RLS remains separately owner approved.
5. Update this ledger with actual imported paths/SHAs and runtime CI. Merge to main only after explicit release authority.

**Caution:** A different blob SHA does not necessarily imply a missing feature; even a missing file can be intentionally replaced by another implementation. Thus provisional duplicate classification is not a closure decision.
