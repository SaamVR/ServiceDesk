/**
 * #153: Directly probe the authenticated SECURITY DEFINER default-branch RPC.
 *
 * Table RLS alone cannot prove that a privileged RPC denies foreign workspace
 * identifiers. No writes, elevations, customer rows, user identifiers or
 * bearer tokens are emitted. Require a known positive default branch for EACH
 * of two distinct real owner sessions before asserting the cross-tenant deny.
 * A null from an empty, unconfigured second workspace is NOT an RLS proof.
 */
function reject(fail, code) { fail(code); throw new Error(code); }
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export async function readAuthenticatedOwnerDefaultBranch(actor, fail) {
  if (!actor?.client || !uuid.test(actor.id ?? "") || !actor.userId) {
    reject(fail, "DEFAULT_BRANCH_OWNER_SESSION_UNVERIFIED");
  }
  const result = await actor.client.from("workspace_branches")
    .select("id,workspace_id,is_default,active")
    .eq("workspace_id", actor.id)
    .eq("is_default", true)
    .eq("active", true)
    .limit(2);
  if (result.error || !Array.isArray(result.data) ||
    result.data.length !== 1 ||
    result.data[0]?.workspace_id !== actor.id ||
    result.data[0]?.is_default !== true ||
    result.data[0]?.active !== true ||
    !uuid.test(result.data[0]?.id ?? "")) {
    reject(fail, "DEFAULT_BRANCH_OWN_ROW_NOT_UNAMBIGUOUS");
  }
  return result.data[0].id;
}

export async function verifyTwoOwnerDefaultBranchRpcBoundary(a, b, fail) {
  if (!a?.client || !b?.client ||
    !uuid.test(a.id ?? "") || !uuid.test(b.id ?? "") ||
    !a.userId || !b.userId || a.userId === b.userId || a.id === b.id) {
    reject(fail, "DEFAULT_BRANCH_TWO_DISTINCT_OWNERS_REQUIRED");
  }
  // Both branches must exist and be visible to their OWN signed-in sessions.
  // Otherwise a foreign null is vacuous (no second branch to disclose).
  const aBranch = await readAuthenticatedOwnerDefaultBranch(a, fail);
  const bBranch = await readAuthenticatedOwnerDefaultBranch(b, fail);
  if (aBranch === bBranch) reject(fail, "DEFAULT_BRANCH_CROSS_TENANT_ID_COLLISION");
  for (const [owner, foreign, expectedOwn] of [[a, b, aBranch], [b, a, bBranch]]) {
    const own = await owner.client.rpc("servicedesk_default_branch", {target_workspace:owner.id});
    if (own.error || own.data !== expectedOwn) {
      reject(fail, "DEFAULT_BRANCH_OWN_RPC_NOT_VERIFIED");
    }
    // A foreign workspace ID is already known by independent setup; the RPC
    // must reveal NO branch ID to a different authenticated owner.
    const negative = await owner.client.rpc("servicedesk_default_branch", {target_workspace:foreign.id});
    const deniedByAuth = negative.error?.code === "42501" && negative.data == null;
    if (!(deniedByAuth || (!negative.error && negative.data === null))) {
      reject(fail, "DEFAULT_BRANCH_FOREIGN_RPC_EXPOSURE_OR_UNVERIFIED");
    }
  }
  return true;
}
