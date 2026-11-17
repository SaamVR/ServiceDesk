# F26 — Active crew dispatch safeguard (2026-11-06)

Existing ServiceDesk source successor [PR #915](https://github.com/SaamVR/ServiceDesk/pull/915) remains OPEN/DRAFT and feature flag `SERVICEDESK_F26_OWNER_DISPATCH_ENABLED` OFF.

## Proven defect and implemented source safeguard

The installed source migration `0011_visit_field_runtime.sql` ASSIGN branch requires only a non-null `visit.crew_id`; an otherwise valid applied-deposit booking could be assigned to an inactive crew or one without any active authorized crew member. That is an unsafe operational transition.

**Backend lane:** `readActiveBookedVisitCrew` verifies exact tenant+quote+visit+request+branch+capacity-slot+active crew, then bounded active crew-member records joined to ACTIVE workspace memberships. The existing F26 handler checks this proof after the first verified paid booking and again immediately before ASSIGN, with the same crew, slot, visit version, signed-in owner and active member fingerprint. Missing, cross-tenant, revoked, inactive, ambiguous or drifted evidence vetoes dispatch. No provider, customer, payment or booking call added.

**Independent QA lane:** real scoped query-path `f26-active-crew-readiness.test.ts` covers inactive crew/member/membership, foreign branch, wrong slot, revoked roles, duplicate/over-limit rows; existing `f26-owner-verified-booking-dispatch.test.ts` checks that inactive/changed crew cannot reach the transition. Independent critic guards F26's source lineage.

**Integration:** same existing IR21 focused workflow; no additional PR or duplicate CI. Exact source Git blobs in `sonic-f26-active-crew-safeguard-lock-20261106.json`.

## Release veto: application check is not a database race lock

Two signed-in source reads **do not atomically lock an active crew membership against revocation**. The present `servicedesk_transition_visit` SQL does not check crew.active or active crew membership under the visit transition lock. Before enabling F26, DBA/Production must separately review and authorize a transactional crew-readiness guard inside the existing ASSIGN RPC, with lock-order and crew-revocation adversarial testing. **Do not install a new migration, activate the flag, dispatch a real job, or represent these source tests as live acceptance**. P02 #818 distinct signed-in owners and P03 #819 authentic pricing remain blockers; Supabase `cpmmgivhlkfbiwzhlcey` is INACTIVE at last read-only check.

Next: Production owner authorizes restore/environment/real JWTs; DBA approves atomic ASSIGN preconditions; integration runs real saved paid booking and crew eligibility with signed-in tenant denial.
