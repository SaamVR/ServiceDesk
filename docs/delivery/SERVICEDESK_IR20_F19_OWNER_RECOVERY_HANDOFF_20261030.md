# ServiceDesk IR20 / F19 — authoritative owner-quality and quote recovery

Date: 2026-10-30
Repository: SaamVR/ServiceDesk
Source-only branch: sonic-integration/ir20-f19-authoritative-recovery-20261030

## Strict source parent
IR19 draft #913 at `2f348199f8cd769cdde9c9ded543200f4388b5ef`. IR19 includes IR18 #912, IR17 #911, IR16 #910, IR15 #909 and earlier P36. None are merged to canonical/main. Do NOT merge a previous composite alongside the next one: choose a single reviewed head and one controlled authorization decision.

## Added usable owner journeys
- Independent Quality Case lane: `sonic-feature/f19-quality-case-followthrough-20261030` — maps authorized Quality case to its own saved job/field evidence, distinguishes OPEN/IN_REVIEW/RESOLVED and incomplete evidence, offers exact job link and on-demand F17/F02 double-read review only for eligible visit states. Exposes no guessed media, no automatic resolution/rework and no customer contact.
- Independent Quote Recovery lane: `sonic-feature/f19-quote-specific-renewal-20261030` — the EXISTING Quotes supplementary panel now requires an explicit selected saved quote and verifies its source request branch under current role scope. Computes a unique newest quote version, links directly to both current quote and source request; ambiguous newest versions have no trusted direct link. Refuses source time that is not a trusted timestamp; no automatic quote creation/approval/send/repricing.
- Independent Critic lane: `sonic-critic/f19-owner-journey-adversarial-20261030` — negative checks for scope, absent source rows, no automatic effects and no false media proof.
- Integrator: imports seven exact file-owned blobs, replaces ONLY quality page and the quote recovery panel, never edits historical `OperationalProductRoute.tsx`, protects immutable original IR18 source lock and adapts two historical tests under a narrowly pinned IR20 successor manifest. Manifest: `docs/delivery/sonic-ir20-f19-owner-recovery-source-lock-20261030.json`.

## Source acceptance vs release
New functionality is source-tested only until authorized real two-owner browser acceptance exists. P02 issue #818 remains OPEN and includes the uninstalled registration guard; P03 #819 still lacks accepted real branch price books. No production Auth/DB migrations or writes, model/provider calls, messages, charges, auto-running workflow, Vercel preview/deployment, canonical/main merge, backup or device cleanup. All new code is additive and review-only.

## Test budget (no validation loop)
Run one focused gate for 4 F19 source/critic files + 2 directly affected historical F17/IR18 suites, TypeScript, changed-file lint and Next.js source build. Do not repeatedly rerun full 3,800+ suite. A production integrator later owns one consolidated full/PG17/browser/security acceptance gate after explicitly authorized release conditions.

## Next urgent work
Separate **production-readiness stream** must obtain owner-specific authorization to activate P02 staging guard/two-owner authenticated UAT; then real owner rates and P03 saved quote calculations. Feature stream should favor complete record-to-command journeys with explicit staff approval once production source is authorized. Keep independent QA critic veto. Continue only on exact current GitHub SHA, not the stale chat ledger.
