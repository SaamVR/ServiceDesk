# R29 — 0065 membership-scoped default-branch definer release candidate
Status: IMPLEMENTED / SOURCE-ONLY; staged DDL and real owner test CONFIGURATION_BLOCKED.

Security issue [#153](https://github.com/SaamVR/ServiceDesk/issues/153) and direct two-owner proof [PR #632](https://github.com/SaamVR/ServiceDesk/pull/632).

Existing installed `servicedesk_default_branch(target_workspace)` may return the default branch UUID to an authenticated nonmember if the workspace UUID is known. The new SQL `0065_v4_default_branch_membership_authority.sql` is a release-ordered copy of the previously independently reviewed and disposable-PG17-tested candidate. It narrows direct output to active members of the target workspace, retaining the legitimate `service_role` internal path **only when the SQL database role also matches** and preserving `authenticated` trigger execution grants.

This change is not deployed. **Connected staging installed through migration 0062.** Before staging DDL, separately approve/reconcile and install 0063, 0064, 0065 in release order, back up schema, verify transaction/rollback plan, and run the two owner A/B signed-in direct RPC acceptance and legitimate trigger insert under live policies. Existing `v4-private-rls-proof.mjs` refuses false safety from empty workspaces or ordinary table RLS. Never mark #153 complete from PG17 fixture checks alone.

Disposable PG17 CI applies the exact 0065 source artifact after historical 0053 and 0062 trigger setup, exercises owner A/B positive and foreign negative RPC, revoked identity, absent identity, forged service claim, actual service-role lookup and branch-default insert. This protects the migration content itself rather than only its former review-note copy.

No remote devices, connected SQL writes, user/account creation, provider calls or production deployment.
