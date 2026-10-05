# ServiceDesk V2 — Cycle 2 Worker 3: Field + Dispatch Productization

Date: 2026-10-05
Accepted W3 source head: `966bcb70ef332d7241bedea6ad1a78cfebf81bf5`
Integration merge: `c6cda79273e4027aea564c7e377acb41b7efef2f`
Integration branch: `feat/servicedesk-v2-integrate`

## Accepted from Cycle 1

- deterministic dispatch recommendation domain with no recommendation-side mutation
- schedule overlap, availability, service-constraint and workload ranking
- explicit human-approval requirement
- crew/day timeline and collision exposure
- crew field read models
- field evidence/checklist server-action adapters
- crew sync/conflict state model
- operational exception derivation
- focused V2 tests

## Why Cycle 1 remained partial

The implementation is not yet a production feature:
- Crew Today / Job Detail are not wired into authoritative production route loaders
- dispatch UI is not yet integrated into the staff Schedule/Jobs product surface
- assignment approval remains intentionally unavailable without an authoritative command boundary
- sync persistence is `SESSION_MEMORY_ONLY`; this is not durable offline support
- UI currently exposes implementation/authority wording inappropriate for end users
- field time labels are hard-coded to UTC instead of workspace/business timezone

## Cycle 2 mission

Productize the accepted foundation without violating authority boundaries.

1. Rebase conceptually on the current integration branch by using the assigned fresh branch; do not reset or replay old work manually.
2. Run focused V2 tests/typecheck first where executable.
3. Wire Crew Today and Crew Job Detail to existing authoritative snapshot/server boundaries when available. No fixtures in production.
4. Replace internal/developer-facing copy with concise field-worker language while preserving truth semantics.
5. Add workspace/business timezone as an explicit presentation input; remove hard-coded UTC assumptions.
6. Integrate dispatch recommendation/timeline components into reusable staff Schedule/Jobs modules with no overlap mutation; keep them modular for Worker 2.
7. Inspect existing authoritative crew-assignment command. If it exists, add a safe dispatcher approval adapter with workspace/role/version guards. If it does not exist, keep approval disabled and publish the exact missing command contract rather than inventing persistence.
8. Improve sync handling truthfully:
   - do not claim offline durability;
   - add a real durable queue only if existing browser persistence/service-worker architecture supports it safely;
   - otherwise provide online/pending/conflict UX and explicitly label offline capability as unavailable in product-neutral wording.
9. Reuse Worker 1 shared primitives where already present on integration; do not create a competing design system.
10. Add focused tests for timezone presentation, authorization, approval boundary, route adapters, stale-version behavior and no recommendation-side mutation.
11. Commit/push multiple substantive slices.

## Completion

Return:
`SERVICEDESK_W3_V2_FIELD_DISPATCH_CYCLE2_COMPLETE`
or
`SERVICEDESK_W3_V2_FIELD_DISPATCH_CYCLE2_PARTIAL_BLOCKED`

Report branch, HEAD, route wiring completed, authoritative commands reused, tests/checks, offline truth state, UI integration seams for Worker 2, and remaining blockers.
