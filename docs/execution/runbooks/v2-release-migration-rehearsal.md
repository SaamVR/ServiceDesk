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

## 4. Browser acceptance — two distinct release gates

Run the frozen candidate in real Chrome at the responsive matrix:

- desktop 1440×900
- tablet 834×1112
- mobile 390×844

**Public responsive smoke is not authenticated staff acceptance.** Preserve two independently captured, exact-build receipts:

1. `RESPONSIVE_BROWSER`: public home, pricing and tour responsive/console/accessibility checks. Bind `SERVICEDESK_BROWSER_ACCEPTANCE_RECEIPT` and `SERVICEDESK_BROWSER_ACCEPTANCE_BUILD_SHA` to the exact candidate.
2. `AUTHENTICATED_STAFF_BROWSER`: real staff sign-in, workspace/branch authorization, core customer enquiry → quote → booking, inbox/handover, dispatch/quality, and relevant Settings workflows. Check permission denials, error/focus states, desktop/tablet/mobile overflow and browser console. Capture a distinct `staff-browser:redacted:<receipt-id>` reference and its `SERVICEDESK_STAFF_BROWSER_ACCEPTANCE_BUILD_SHA`, both for the same exact SHA.

Both gates must pass separately. Reusing the public receipt as the staff receipt, using another build's receipt, or merely running E2E/fixture tests does not qualify. Do not manufacture authenticated acceptance when login credentials, permissions, data or real-browser access are unavailable. Keep the staff gate `CONFIGURATION_BLOCKED` and document the exact blocker.

The server-side release registry additionally expects a distinct `BROWSER_RECEIPT` with `scope: "AUTHENTICATED_STAFF"` and the exact candidate `buildSha`. Do not record a public-only browser matrix under that scope.

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
