# IR17 · Real branch-price quote review · 2026-10-30

**Product goal:** get verified saved branch pricing into a usable AI Studio journey before P03 real-owner UAT. This is **review-only**; no quote is created or issued, no AI model call, provider delivery, payment or pricing write.

## Implemented
- F15 #910 already wires saved request clarification, crew availability, bounded owner business counts into existing authenticated AI Studio.
- F16 adds `requestF16GroundedQuoteReview(workspaceSlug, requestId)`, on-demand server revalidation of authenticated saved request revision and invocation of the existing F01 `proposeAuthorizedGroundedQuoteAlternatives` engine. That engine requires active saved catalog + branch rate book, staff branch scope and two authenticated reads and correct version.
- UI `AiGroundedQuoteAlternatives` is rendered for the selected authorized saved request, displays actual total/deposit/time only after server-grounded verification, and explicitly links missing-price recovery to Settings / service pricing.
- All outputs remain nonbinding staff proposals. Changing saved pricing or sending a customer quote requires the separate authoritative business command, with its own concurrency and permission checks.
- Exactly three F16 source files from separate `sonic-feature/f16-grounded-quote-ui-20261030` branch, integrated with a single `AiStudioWorkbench.tsx` successor preserving F15; exact Git blob hashes pinned in `docs/delivery/sonic-ir17-f16-grounded-quote-source-lock-20261030.json`. IR16 source manifest remains immutable. One narrowly adapted historical test checks both the old and successor workbench hashes.

## Scope and boundaries
F01–F14 feature source remains in stacked draft #909, F15 in draft #910, F16 in this IR17 draft. These are **not** three separately mergebale canonical PRs; Production must choose the final integrated source **once** and avoid duplicating original feature heads.

Production readiness still owns #818 P02 two real authenticated tenant UAT and registration guard, #819 P03 real saved catalogs/price books, P04 onward provider/automation/release gates. No DB/Auth/migration mutation or live user/fixture, Vercel project or preview/deploy, provider/send/charge, canonical or main merge, backup/device change.

**Validation strategy:** targeted F16 and affected F15 workbench/provenance tests, TypeScript, changed-file ESLint and build once. Never re-run 3,800 green suite for isolated additive work; only Production does consolidated full CI/PG17/Chrome/guardian after an authorized integration decision.

**Next source feature:** review saved visit QA or request-to-quote readiness end-to-end in the UI. **Next operational release task:** P02 authorized two-owner browser and registration guard acceptance, then real P03 saved rate books; the absence of prices remains a launch blocker, not something a copilot may guess.
