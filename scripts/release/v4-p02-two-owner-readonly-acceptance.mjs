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
    const claims = jwtClaims(jwt);
    if (claims.role !== "authenticated" || !UUID.test(claims.sub || ""))
      throw Error("SIGNED_IN_OWNER_SESSION_REQUIRED");
    if (claims.exp && Number(claims.exp) * 1000 <= Date.now())
      throw Error("EXPIRED_OWNER_JWT");
    if (claims.iss && !String(claims.iss).startsWith(ORIGIN + "/auth/v1"))
      throw Error("WRONG_SUPABASE_PROJECT_JWT");
    return { tag, token: jwt, expectedWorkspace: id, subject: claims.sub };
  });
  if (entries[0].subject === entries[1].subject ||
      entries[0].expectedWorkspace === entries[1].expectedWorkspace)
    throw Error("OWNERS_AND_WORKSPACES_MUST_BE_DIFFERENT");
  return { key, entries };
}

export async function runTwoOwnerReadOnlyAudit(
  env,
  fetcher = fetch,
) {
  const { key, entries } = validateInputs(env);
  const checked = [];
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
    const scoped = async (table, workspaceId) => {
      const filter = new URLSearchParams({
        select: table === "memberships" ? "workspace_id" : "id",
        [table === "workspaces" ? "id" : "workspace_id"]: "eq." + workspaceId,
        limit: "2",
      });
      const data = await request(table + "?" + filter.toString());
      if (!Array.isArray(data) || data.length > 2)
        throw Error("UNEXPECTED_DATABASE_SHAPE");
      return data.length;
    };
    for (const table of ["workspaces", "memberships", "requests"]) {
      const ownRows = await scoped(table, owner.expectedWorkspace);
      const foreignRows = await scoped(table, foreign.expectedWorkspace);
      if (table !== "requests" && ownRows < 1)
        throw Error("EXPECTED_OWNER_ACCESS_MISSING_" + table.toUpperCase());
      if (foreignRows !== 0)
        throw Error("FOREIGN_TENANT_DATA_EXPOSED_" + table.toUpperCase());
    }
    const branch = async id => request("rpc/servicedesk_default_branch", {
      method: "POST", body: { target_workspace: id },
    });
    const ownBranch = await branch(owner.expectedWorkspace);
    const foreignBranch = await branch(foreign.expectedWorkspace);
    if (!UUID.test(ownBranch || "") || foreignBranch !== null)
      throw Error("FOREIGN_DEFAULT_BRANCH_DISCLOSURE_OR_OWN_BRANCH_MISSING");
    checked.push({ owner: owner.tag, scope: "OWN_WORKSPACE_ALLOWED_FOREIGN_DENIED",
      defaultBranch: "AUTHORIZED_ONLY", authenticated: true });
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
