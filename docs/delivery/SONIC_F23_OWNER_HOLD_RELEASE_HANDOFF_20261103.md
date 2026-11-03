# SONIC F23 — Explicit owner release of unused quote hold

**Repository:** SaamVR/ServiceDesk
**Integration:** Existing open draft #915 (`sonic-integration/ir21-f20-real-finance-retention-20261030`)
**Source parent:** `0b910cb10f6b16d9b4f874063a1e726797179f91`
**Status:** SOURCE ONLY / feature flag OFF / no production or connected Supabase writes.

## Business boundary
The existing verified-payment application (migration `0010_e03_verified_payment_rpc.sql`) creates actual visits and CONFIRMED holds. F23 explicitly does **not** create or cancel a visit, issue/reconcile a payment, notify a customer or alter verified payment applications. It allows the human owner to free an unused HELD capacity claim so the owner can recheck availability and offer another slot later.

## Independent file-owned engineering work
- Backend lane: `src/server/workflows/owner-verified-quote-hold-release.ts`: three signed-in owner/ALL-branch checks, two current saved-source reads (accepted unique quote, request/crew branch, held slot, quote-wide visit/payment exclusions), and exact status=HELD/expiry compare-and-set, post-write saved release readback.
- Owner UI lane: `OwnerQuoteHoldReleasePanel.tsx` and `OwnerSavedHoldReleaseControls.tsx` integrated into existing Quotes route; **one** selected, current accepted quote with exactly one active saved hold. Explicit one-click release; no silent retries on ambiguous write/readback.
- Server boundary: `verified-hold-release-action.ts` validates UUID selections and collapses failures. `SERVICEDESK_F23_OWNER_HOLD_RELEASE_ENABLED` defaults OFF, and privileged database mode must explicitly be SERVICE_ROLE.
- Independent security critic: `tests/ai/f23-owner-held-slot-release.test.ts` + `tests/ai/f23-owner-hold-release-critic.test.ts`, including invalid roles, quote/branch drift, paid/visited exclusions, stale holds and unverifiable mutation.

## Release prerequisites
Production owner must approve the environment, exact deployed SHA, feature switch, rollback plan and real owner A/B authenticated tenant isolation (P02). P03 needs authentic branch services/prices. The integrated source is not an operational release or a booking confirmation. A released hold should not be represented as immediately reusable capacity until the authoritative schedule is refreshed.

## Source provenance
Exact file-path and Git blob SHAs are pinned in `docs/delivery/sonic-f23-owner-unused-hold-source-lock-20261103.json`. Past F15 immutable lock and existing F21/F22 sources are not modified by F23. One focused application CI gate is sufficient; no duplicated full-suite loops.
