# ServiceDesk AI V2 — Release and migration rehearsal runbook

Status: IMPLEMENTED / OPERATIONAL EVIDENCE NOT YET CLAIMED

This runbook defines the release procedure. It does not authorize production or ServiceDesk staging mutation by itself, and it does not convert authored tests into provider, browser, or migration operational evidence.

## 1. Freeze the exact candidate

Record the canonical Git SHA. Run the repository RC gate against that exact SHA:

- `pnpm typecheck`
- `pnpm test`
- `pnpm lint`
- `pnpm build`

Keep the resulting build/deploy receipt bound to the same SHA. A later commit invalidates that executable receipt for release promotion.

## 2. Build the migration rehearsal plan

Use the exact `supabase/migrations/*.sql` inventory from the frozen candidate. The repository helper `buildMigrationRehearsalPlan` sorts the inventory and creates a SHA-256 fingerprint bound to the build SHA.

The current repository migration head is expected to be `0058_v2_enterprise_governance.sql`.

Do not hand-edit the fingerprint.

## 3. Rehearse only on disposable non-production infrastructure

The accepted rehearsal target is:

- target class: `DISPOSABLE_NON_PRODUCTION`
- data class: `SYNTHETIC_ONLY`
- rollback mode: `DATABASE_RESTORE_OR_DISPOSABLE_RESET`

Do not use the production database. Do not use the dedicated ServiceDesk staging project merely to satisfy this runbook without separate owner authorization.

A valid rehearsal must prove all three operations on the same plan fingerprint:

1. Upgrade from the agreed baseline through the migration head.
2. Roll back by restoring/resetting the disposable database. The repo does not pretend every forward SQL migration has a safe generated inverse.
3. Clean up the disposable environment.

Record PASS/FAIL for each stage. If any stage fails, release remains blocked.

## 4. Browser acceptance

Run the frozen candidate in a real browser at the requested responsive matrix:

- desktop 1440×900
- tablet 834×1112
- mobile 390×844

Exercise the real staff journey and responsive/accessibility surfaces. Source-level E2E tests do not substitute for this browser receipt.

## 5. Controlled provider acceptance

Provider verification requires a controlled provider receipt bound to the exact candidate/operation. Configuration presence, fixtures, authored tests, UI status, or an old receipt do not count.

Payment remains sandbox/demo only and must never be described as live-payment verified.

## 6. External evidence blockers

Keep these explicit instead of manufacturing evidence:

- Second vertical: `BUYER_EVIDENCE_BLOCKED` until two real buyers share the same model.
- Provider-specific accounting export: blocked until provider choice/API eligibility is real.
- Saved payment methods / automatic charging: blocked until eligible provider account plus mandate/cancellation/failure policy exists.
- Facebook/Instagram: blocked until demand/API approval exists.
- Voice recording/transcription: blocked until provider capability and consent policy are proven.

## 7. Release decision

Production release may be called ready only when every release-blocking gate in the V2 release registry is in an accepted state. Non-blocking roadmap expansion such as the second vertical may remain buyer-evidence blocked without being misreported as completed.

Never merge evidence claims that are not backed by a receipt.
