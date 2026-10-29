# P25 — owner branch-pricing readiness, SOURCE-ONLY
Date: 2026-10-29
Owner: ServiceDesk P03 preparation lane. P03 issue #819 remains QUEUED until P02 #818 is DONE.

## User-facing change
A verified owner may have *different* USD branches with two independent pricing blockers:
1. An active, saved but non-quotable book. Owners must review/revise existing prices; first-run setup cannot overwrite it.
2. A USD branch with **no active saved** book. Owners may enter their actual rates through existing, owner-only first-run setup.

Before P25, the first condition returned a single banner and concealed the second. Now the read-only banner displays both warnings and both separately appropriate Settings paths when the actual saved branch evidence supports them.

The banner also visibly refuses readiness when the proof carries a VERIFIED label but is missing the independent saved-book inventory. The catalog readiness counter deduplicates active, supported STANDARD/DEEP/MOVE_OUT service *codes*; repeated rows cannot inflate distinct services.

## Tests and review
- Mixed missing-book/invalid-saved-book owner UI; correct repair vs. first-run action
- Missing/denied book inventory cannot imply readiness
- Selected-branch scope excludes unrelated branches; non-USD branches excluded
- Duplicate, inactive, and unsupported service-code count regression
- Independent critic checks both guidance flows, no direct RPC/client/network side effects
- Source exact-head workflow validation required before any integration decision

## Release boundaries and next work
These are source-only owner readiness improvements, not a rate-book installation, a migration, a quote, or proof that the connected Supabase project has any customer-ready pricing. P03 #819 remains blocked by P02, and no fictional business prices, new Auth users, staging records, real payments, customer notifications, source merges, or Vercel deploys are authorized. Production ownership stays with the existing release integrator.

For the eventual owner-approved P03 run: first complete real P02 A/B acceptance; then save real owner-entered rate configuration with actual authenticated session and gather branch/currency/version conflict receipts. Only mark P03 done after those live readbacks, not after CI.
