#!/usr/bin/env node
/**
 * P02: real authenticated two-owner RLS denial proof for the existing ServiceDesk Supabase.
 * READ ONLY application data: GET owner-scoped workspaces, memberships, requests;
 * POST only a known read-only SQL function (servicedesk_default_branch).
 *
 * No signup, writes, private keys, HTTP redirects, customer records in stdout,
 * or use of service_role tokens. This is NOT a deployment or production approval.
 *
 * Required (provided securely via a local environment/CI secret store, never chat):
 *  SD_P02_ACCEPTANCE_APPROVED=READ_ONLY
 *  SD_P02_PUBLISHABLE_KEY=sb_publishable_...
 *  SD_P02_OWNER_A_JWT=<real signed-in owner A JWT>
 *  SD_P02_OWNER_B_JWT=<real signed-in owner B JWT>
 *  SD_P02_OWNER_A_WORKSPACE_ID=<uuid> ; SD_P02_OWNER_B_WORKSPACE_ID=<uuid>
 *  SD_P02_OWNER_A_REQUEST_ID=<uuid> ; SD_P02_OWNER_B_REQUEST_ID=<uuid>
 * Supabase host is pinned to the previously owner-approved main ServiceDesk project.
 */
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const PROJECT_REF = "cpmmgivhlkfbiwzhlcey";
export const ORIGIN = "https://" + PROJECT_REF + ".supabase.co";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jwtClaims(token) {
  if (typeof token !== "string" || token.length > 16384 || token.split(".").length !== 3)
    throw Error("INVALID_OWNER_JWT");
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
  } catch { throw Error("INVALID_OWNER_JWT"); }
}

export function validateInputs(env) {
  if (env.SD_P02_ACCEPTANCE_APPROVED !== "READ_ONLY")
    throw Error("READ_ONLY_ACCEPTANCE_NOT_ENABLED");
  const key = env.SD_P02_PUBLISHABLE_KEY;
  if (typeof key !== "string" || !key.startsWith("sb_publishable_") ||
      key.length > 1024) throw Error("PUBLISHABLE_KEY_REQUIRED");
  const entries = ["A", "B"].map(tag => {
    const jwt = env["SD_P02_OWNER_" + tag + "_JWT"];
    const id = env["SD_P02_OWNER_" + tag + "_WORKSPACE_ID"];
    if (!UUID.test(id || "")) throw Error("EXPECTED_WORKSPACE_ID_INVALID");
    const requestId = env["SD_P02_OWNER_" + tag + "_REQUEST_ID"];
    if (!UUID.test(requestId || "")) throw Error("EXPECTED_SAVED_REQUEST_FIXTURE_REQUIRED");
    const claims = jwtClaims(jwt);
    if (claims.role !== "authenticated" || !UUID.test(claims.sub || ""))
      throw Error("SIGNED_IN_OWNER_SESSION_REQUIRED");
    if (!Number.isSafeInteger(claims.exp) ||
        Number(claims.exp) * 1000 <= Date.now())
      throw Error("EXPIRED_OR_UNVERIFIABLE_OWNER_JWT");
    if (claims.iss !== ORIGIN + "/auth/v1")
      throw Error("WRONG_SUPABASE_PROJECT_JWT");
    return { tag, token: jwt, expectedWorkspace: id, expectedRequest: requestId, subject: claims.sub };
  });
  if (entries[0].subject === entries[1].subject ||
      entries[0].expectedWorkspace === entries[1].expectedWorkspace ||
      entries[0].expectedRequest === entries[1].expectedRequest)
    throw Error("OWNERS_AND_WORKSPACES_MUST_BE_DIFFERENT");
  return { key, entries };
}

export async function runTwoOwnerReadOnlyAudit(
  env,
  fetcher = fetch,
) {
  const { key, entries } = validateInputs(env);

  // The locally decoded JWT claims are NOT a proof of a current Auth user.
  // The official Auth /user endpoint validates the bearer token and returns
  // the current server-side identity. This is a GET with a publishable key;
  // do not log the full Auth user, JWT, email, or response body.
  const verifyAuthOwner = async owner => {
    const res = await fetcher(ORIGIN + "/auth/v1/user", {
      method: "GET", redirect: "error", signal: AbortSignal.timeout(15000),
      headers: {
        apikey: key, Authorization: "Bearer " + owner.token,
        Accept: "application/json", "Cache-Control": "no-store",
      },
    });
    if (!res.ok || !res.headers.get("content-type")?.includes("application/json"))
      throw Error("AUTH_SERVER_USER_CHECK_FAILED");
    let user;
    try { user = await res.json(); }
    catch { throw Error("AUTH_SERVER_USER_CHECK_FAILED"); }
    if (!user || typeof user !== "object" || Array.isArray(user) ||
        user.id !== owner.subject || user.is_anonymous === true ||
        typeof user.email_confirmed_at !== "string" ||
        !Number.isFinite(Date.parse(user.email_confirmed_at)))
      throw Error("AUTH_SERVER_OWNER_IDENTITY_UNVERIFIED");
  };
  // Validate BOTH identities before any tenant reads. An expired/revoked or
  // changed session must never be reported as a usable independent owner.
  for (const owner of entries) await verifyAuthOwner(owner);
  const checked = [];
  const finalAuthorityReadbacks = [];
  for (const owner of entries) {
    const foreign = entries.find(item => item.tag !== owner.tag);
    const headers = {
      apikey: key, Authorization: "Bearer " + owner.token,
      Accept: "application/json",
      "Cache-Control": "no-store",
    };
    const request = async (path, options = {}) => {
      const url = new URL("/rest/v1/" + path, ORIGIN);
      if (url.origin !== ORIGIN) throw Error("UNAPPROVED_TARGET");
      const res = await fetcher(url.toString(), {
        method: options.method ?? "GET",
        redirect: "error", signal: AbortSignal.timeout(15000),
        headers: { ...headers, ...(options.body ? { "Content-Type": "application/json" } : {}) },
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      });
      if (!res.ok || !res.headers.get("content-type")?.includes("application/json"))
        throw Error("AUTHENTICATED_DATABASE_REQUEST_FAILED");
      return await res.json();
    };
    // Count-only checks are not a proof of OWNER authority: a STAFF row,
    // stale membership or mis-scoped response could otherwise pass.
    // Independently validate the row identity *and* the verified JWT subject.
    const scoped = async (table, workspaceId, requestId, membershipSubject = owner.subject) => {
      // The foreign-membership witness must query that foreign OWNER's known
      // saved identity. Filtering by our own actor would return zero even when
      // an incorrectly broad RLS policy exposes the foreign OWNER row.
      if (table === "memberships" &&
          membershipSubject !== owner.subject && membershipSubject !== foreign.subject)
        throw Error("UNAPPROVED_MEMBERSHIP_SUBJECT");
      const projection = {
        workspaces: "id",
        memberships: "workspace_id,user_id,role,status",
        requests: "id,workspace_id",
        workspace_branches: "id,workspace_id,is_default,active",
      }[table];
      if (!projection) throw Error("UNAPPROVED_TABLE");
      if (table === "requests" && !UUID.test(requestId || ""))
        throw Error("EXPECTED_SAVED_REQUEST_FIXTURE_REQUIRED");
      const filter = new URLSearchParams({
        select: projection,
        [table === "workspaces" ? "id" : "workspace_id"]: "eq." + workspaceId,
        ...(table === "memberships" ? {
          user_id: "eq." + membershipSubject, role: "eq.OWNER", status: "eq.ACTIVE",
        } : {}),
        ...(table === "requests" ? { id: "eq." + requestId } : {}),
        ...(table === "workspace_branches" ? {
          is_default: "eq.true", active: "eq.true",
        } : {}),
        limit: "2",
      });
      const data = await request(table + "?" + filter.toString());
      if (!Array.isArray(data) || data.length > 2)
        throw Error("UNEXPECTED_DATABASE_SHAPE");
      for (const row of data) {
        if (!row || typeof row !== "object" || Array.isArray(row) ||
            Object.getPrototypeOf(row) !== Object.prototype)
          throw Error("UNEXPECTED_DATABASE_SHAPE");
        if (table === "workspaces" && row.id !== workspaceId)
          throw Error("DATABASE_ROW_SCOPE_UNVERIFIED");
        if (table === "memberships" &&
            (row.workspace_id !== workspaceId || row.user_id !== membershipSubject ||
             row.role !== "OWNER" || row.status !== "ACTIVE"))
          throw Error("OWNER_ACTIVE_MEMBERSHIP_UNVERIFIED");
        if (table === "requests" &&
            (row.workspace_id !== workspaceId || row.id !== requestId))
          throw Error("DATABASE_ROW_SCOPE_UNVERIFIED");
        if (table === "workspace_branches" &&
            (row.workspace_id !== workspaceId || !UUID.test(row.id ?? "") ||
             row.is_default !== true || row.active !== true))
          throw Error("DEFAULT_BRANCH_SAVED_SCOPE_UNVERIFIED");
      }
      return data;
    };
    for (const table of ["workspaces", "memberships", "requests"]) {
      const ownRows = await scoped(table, owner.expectedWorkspace, owner.expectedRequest);
      const foreignRows = await scoped(
        table, foreign.expectedWorkspace, foreign.expectedRequest, foreign.subject,
      );
      // A second or duplicated owner membership is not an unambiguous proof.
      // Foreign denial is not meaningful without a saved row that its owner can read.
      if (table === "requests" && ownRows.length !== 1)
        throw Error("EXPECTED_OWNER_REQUEST_FIXTURE_MISSING");
      if (table !== "requests" && ownRows.length !== 1)
        throw Error("EXPECTED_OWNER_ACCESS_MISSING_" + table.toUpperCase());
      if (foreignRows.length !== 0)
        throw Error("FOREIGN_TENANT_DATA_EXPOSED_" + table.toUpperCase());
    }
    // Verify the saved *branch* independently of the SECURITY DEFINER RPC:
    // a valid-looking unrelated UUID is not evidence of an authorized result.
    const ownDefaults = await scoped("workspace_branches",owner.expectedWorkspace);
    const foreignDefaults = await scoped("workspace_branches",foreign.expectedWorkspace);
    if (ownDefaults.length !== 1)
      throw Error("DEFAULT_BRANCH_OWN_ROW_NOT_UNAMBIGUOUS");
    if (foreignDefaults.length !== 0)
      throw Error("FOREIGN_TENANT_DATA_EXPOSED_WORKSPACE_BRANCHES");
    const branch = async id => request("rpc/servicedesk_default_branch", {
      method: "POST", body: { target_workspace: id },
    });
    const ownBranch = await branch(owner.expectedWorkspace);
    const foreignBranch = await branch(foreign.expectedWorkspace);
    if (ownBranch !== ownDefaults[0].id)
      throw Error("DEFAULT_BRANCH_OWN_RPC_NOT_VERIFIED");
    if (foreignBranch !== null)
      throw Error("FOREIGN_DEFAULT_BRANCH_DISCLOSURE");

    // Defer both final authority reads until BOTH owners' full scope/RPC
    // matrices have finished. Checking owner A before auditing owner B could
    // miss a revocation of owner A while owner B's calls are in flight.
    finalAuthorityReadbacks.push(async () => {
      const finalMembership = await scoped("memberships", owner.expectedWorkspace);
      const finalDefault = await scoped("workspace_branches", owner.expectedWorkspace);
      if (finalMembership.length !== 1 || finalDefault.length !== 1 ||
          finalDefault[0].id !== ownDefaults[0].id)
        throw Error("OWNER_AUTHORITY_CHANGED_DURING_AUDIT");
      const finalClaims = jwtClaims(owner.token);
      if (!Number.isSafeInteger(finalClaims?.exp) ||
          finalClaims.exp * 1000 <= Date.now())
        throw Error("OWNER_SESSION_EXPIRED_DURING_AUDIT");
    });

    checked.push({ owner: owner.tag, scope: "OWN_WORKSPACE_ALLOWED_FOREIGN_DENIED",
      defaultBranch: "AUTHORIZED_ONLY", authenticated: true });
  }
  // No PASS until both owners have been rechecked after the *entire*
  // matrix. This narrows TOCTOU exposure but remains non-atomic; signed-in
  // browser/session acceptance is still a separate Production gate.
  for (const recheck of finalAuthorityReadbacks) await recheck();
  // Recheck Auth server identities after both owners' database matrices.
  // This catches an Auth user/session changed during the read-only probe;
  // the overall audit is still non-atomic and is NOT a browser UAT.
  for (const owner of entries) await verifyAuthOwner(owner);
  // A JWT that expired during the other owner's final readback must not be
  // counted as a currently usable session.
  for (const owner of entries) {
    const finalClaims = jwtClaims(owner.token);
    if (!Number.isSafeInteger(finalClaims?.exp) ||
        finalClaims.exp * 1000 <= Date.now())
      throw Error("OWNER_SESSION_EXPIRED_DURING_AUDIT");
  }
  return { result: "PASS", project: PROJECT_REF,
    checks: checked, noWrites: true,
    note: "Real owner JWT read checks only; no browser or provider acceptance implied." };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await runTwoOwnerReadOnlyAudit(process.env);
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } catch (error) {
    // Do not include token values, URLs, response bodies or owner IDs in logs.
    const message = String(error?.message ?? "UNEXPECTED_ERROR");
    const safe = /^[A-Z0-9_]+$/.test(message) ? message : "AUDIT_FAILED";
    process.stderr.write(JSON.stringify({ result: "FAIL", reason: safe }) + "\n");
    process.exitCode = 1;
  }
}
