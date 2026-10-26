# P02 — Verified owner workspace readback, authenticated session and saved membership proof

**Security checkpoint:** 2026-10-26 · **Source canonical:** `1003075d1bfcefb6415d6c9a4bdda9c57a0546ff` · **Control:** #808 · **Production P02:** #818 · **SONIC GAP:** #846.

## Concrete vulnerability in the app's trust boundary

The previous `loadVerifiedOwnerWorkspace(auth,userId,slug)` queried `memberships` using the **caller-supplied** `userId`, `role='OWNER'` and `status='ACTIVE'`, but selected only `workspace_id`. It relied on filter behavior/row-level security to attest that the row really represented that owner. The function itself could not reject a staff/revoked/foreign membership row if its database or mock backend returned inconsistent fields, and it did not compare the passed user ID with a freshly verified `auth.auth.getUser()` subject. Existing trusted routes separately called `getUser()`, so this is **defense-in-depth against future callers, response anomalies or auth drift**, not proof of a currently exploitable production cross-tenant bypass.

## Implemented and isolated source changes

- The helper now checks that `userId` is a valid UUID and matches `auth.auth.getUser().data.user.id` at the moment of readback. No fallback to unverified local session, `user_metadata` or arbitrary client header.
- The membership query requests `workspace_id,user_id,role,status` and verifies every row matches the authenticated subject, has exactly `OWNER/ACTIVE`, and belongs to a valid workspace UUID. Mixed/duplicate results fail closed; no partial whitelist behavior.
- Authenticated read errors and rejected thenables return stable `DENIED`/`QUERY_FAILED` results instead of allowing unhandled promises or echoing private exception bodies.
- Existing workspace `id/slug/name/timezone/currency` validation remains intact, including explicit matching the owner-membership workspace ID. Server-side route and QA seeding still check email confirmation/allowlist independently.
- Existing `tests/e2e/p02-verified-owner-readback-integrity.test.ts` now mocks the verified `auth.getUser()` call and full saved membership evidence. Additional adversarial coverage in `tests/e2e/p02-owner-session-membership-adversarial.test.ts` covers forged users, staff, revoked/foreign rows, duplicate/mixed results, source exceptions, wrong tenant IDs and invalid caller inputs.

## Explicit non-authority

**CONTRACT_TESTED** after exact-head source CI only. These changes do not install migration 0065, provision controlled fictional OWNER A/B users, inspect the live primary database, authorize QA write fixtures, deploy V4 on Render, certify RLS, alter customer communications, or merge canonical. P02 #818 stays open until owner-approved, real signed-in readbacks and negative RLS/RPC evidence are recorded. The existing primary Supabase's unsafe definer function remains a separate Product/Production-controlled migration approval blocker.

Do not merge both this patch and unreviewed overlapping authentication changes without comparing exact paths/branches. No main/canonical writes, paid provider access, finance, customer sends, background tasks, credentials or device deletion is authorized by this patch. The completed F08 feature-source freeze remains intact.

**Acceptance gate:** Focused P02 existing + new tests, full `pnpm check:rc`, CI merge-tree parity and critic-integrity checks must be SUCCESS at the exact final draft PR SHA. A passing test does not count as a staged owner journey or a sellable SaaS release.
