# ServiceDesk P02: eliminate false-positive two-owner acceptance

**Date:** 2026-10-26. **Track:** SONIC source-only hardening, Production P02 #818. **Source baseline:** `ac78ff7737c95aa1b29b679d2b8ede57e5dfcae4`. **Authorization:** No primary database write, fake account creation, migration execution, Render deployment or canonical merge authorized by this document.

## Observed acceptance runner gap

The existing `scripts/release/v4-p02-two-owner-readonly-acceptance.mjs` counted an RLS-visible membership `workspace_id` without demanding a matching authenticated JWT `sub`, `OWNER` role and `ACTIVE` status. A STAFF/CREW account with access to the workspace could pass that membership **presence** test while the summary claimed verified two-owner access. The same runner accepted any syntactically valid result from `servicedesk_default_branch(uuid)` for the user's own workspace, without comparing it to a separately observed active saved default branch. This could produce a false `PASS` if the definer returned an unrelated UUID.

## Implemented source repair (draft PR, **not deployed**)

1. Membership read requests now include `workspace_id`, `user_id`, `role`, and `status`, with database filters to current decoded signed-in subject, `OWNER`, `ACTIVE`; all four fields are independently checked. Decoded JWT identity is **not a signature verification**; the Supabase API must validate the bearer JWT itself.
2. Every returned `workspaces`, `requests`, `memberships` and `workspace_branches` row is checked against the requested workspace. Out-of-scope or malformed rows fail the entire audit, never count toward proof.
3. Every owner must independently see **exactly one** active default branch under authenticated table RLS; their corresponding privileged default-branch RPC must return **that identical saved ID**. The other owner must see **no branch** via direct table RLS and **no UUID** via the foreign workspace RPC.
4. The runner remains READ ONLY: GET on saved tables, POST only to the already documented read-only default-branch RPC, `redirect:"error"`, exact pinned project origin, public/publishable key only, no token/customer record output, no sign-up or write path.
5. The test-fixture lane models owner A/B unique identities, active role and saved branch. The independently authored adversarial lane denies staff impersonation, revoked membership, wrong JWT subject, duplicate owner/branch, foreign workspace rows, mismatched default branch RPC and foreign RPC disclosure.
6. The completion summary remains restricted to sanitized `owner:A/B`, no IDs, no emails, no bearer tokens or provider response bodies. Source-only tests and mocked responses must never be presented as an actual production tenant PASS.

## Owner's live staging checklist (not performed)

- **Before live probe:** separately authorize a reviewed 0065 membership-scoped function update and verified migration ledger/rehearsal with rollback. The current primary database has historically been observed with a foreign default-branch SECURITY DEFINER exposure; no owner may be counted as isolated until fresh denial readback.
- Use **two real, separately controlled fictional QA accounts** (different auth subjects and workspaces), with legitimate OWNER ACTIVE membership and each an active default branch. Put bearer JWTs and publishable key in secure CI/Work runtime secrets; never paste tokens or IDs into the PR.
- Run the existing authorized read-only command with `SD_P02_ACCEPTANCE_APPROVED=READ_ONLY`; independently authenticate issuer/signature through the database API, confirm SQL function ACL, actual two-owner own positive and foreign negative, protected browser onboarding, and save sanitized call counts/negative receipts.
- The existing suspended V3 Render service is **not** an active V4 staging proof; Production must explicitly approve a V4 deploy/branch and rollback before claiming V4 route acceptance.
- Only Production may mark #818 COMPLETE when all six mandatory task boxes have true saved authenticated/DB/route receipts; this isolated source patch only raises the quality of the test gate.

## Source tests expected

`node --test scripts/release/tests/v4-p02-two-owner-readonly-acceptance.test.mjs scripts/release/tests/v4-p02-two-owner-authorization-proof.test.mjs` plus the full source `pnpm check:rc` exact candidate SHA; merge-tree parity and critic integrity. If source checks pass, classify **CONTRACT_TESTED**. Two-owner tenancy remains **CONFIGURATION_BLOCKED** until installed security SQL and independently controlled sessions are verified.

**Interaction with feature freeze:** F08 #816 and draft #841 remain untouched. New event/action feature expansion still requires an approved change order, not this P02 security repair.
