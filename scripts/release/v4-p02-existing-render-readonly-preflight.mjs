#!/usr/bin/env node
/**
 * P02 reuse-existing-service preflight. No credentials, data writes or deploys.
 * Run only with:
 *   SD_P02_RENDER_READONLY_PERMISSION=READ_ONLY
 *   SD_P02_RENDER_EXPECTED_SHA=<40-hex reviewed V4 commit>
 * The URL is deliberately fixed to the owner's EXISTING Render service.
 *
 * A PASS proves only an HTTP host-reported SHA and guest access controls.
 * It does NOT prove the provider's actual build metadata, two authenticated
 * owners, migration 0065, subscription health or production readiness.
 */
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const EXISTING_HOST = "servicedesk-v3-frontend-review.onrender.com";
export const ORIGIN = "https://" + EXISTING_HOST;
// Pinned to the owner-approved GitHub-only V4 P02 release-candidate branch.
// A syntactically valid V3 SHA must never produce a V4 preflight PASS.
export const REVIEWED_P02_RC_SHA = "ac78ff7737c95aa1b29b679d2b8ede57e5dfcae4";
const SHA = /^[a-f0-9]{40}$/i;
const PUBLIC_PATHS = Object.freeze([
  { key: "hosting-sha", path: "/health", accept: "application/json" },
  { key: "signin-controls", path: "/auth/sign-in", accept: "text/html" },
  { key: "anonymous-owner-boundary",
    path: "/api/internal/inbox/delivery?workspaceSlug=sd-p02-unauthorized-probe",
    accept: "application/json" },
]);

export function validateP02RenderReadOnlyConfig(input) {
  if (input?.permission !== "READ_ONLY" ||
      typeof input.expectedSha !== "string" || !SHA.test(input.expectedSha) ||
      input.expectedSha.toLowerCase() !== REVIEWED_P02_RC_SHA ||
      input.existingHost !== EXISTING_HOST ||
      input.existingServiceId !== "srv-db5p1s142hec739noohg") return null;
  return { expectedSha: input.expectedSha.toLowerCase(), origin: ORIGIN };
}

export function evaluateP02RenderProbe(key, response, sha) {
  const status = response?.status ?? null;
  if (key === "hosting-sha") {
    const obj = response?.json;
    if (status !== 200 || !obj || typeof obj !== "object" || Array.isArray(obj) ||
        obj.ok !== true || obj.service !== "servicedesk" || obj.status !== "live" ||
        obj.sourceProvider !== "render" || !SHA.test(obj.sourceSha ?? "")) {
      return { key, state: "UNVERIFIED_OR_UNAVAILABLE", status };
    }
    return { key, state: obj.sourceSha.toLowerCase() === sha ?
      "HOST_REPORTED_SOURCE_MATCH" : "SOURCE_MISMATCH", status };
  }
  if (key === "signin-controls") {
    const body = response?.body ?? "";
    return { key, state: status === 200 &&
        /name=["']email["']/i.test(body) &&
        /name=["']password["']/i.test(body) ?
      "PUBLIC_CONTROLS_PRESENT" : "MISSING_CONTROLS", status };
  }
  if (key === "anonymous-owner-boundary") {
    return { key, state: status === 401 ? "ANONYMOUS_DENIED" :
      "ANONYMOUS_NOT_VERIFIED", status };
  }
  throw Error("UNRECOGNIZED_PROBE");
}

async function boundedGet(url, accept) {
  const response = await fetch(url, {
    method: "GET", redirect: "error",
    headers: { Accept: accept, "Cache-Control": "no-store" },
    signal: AbortSignal.timeout(12000),
  });
  const size = Number(response.headers.get("content-length"));
  if (Number.isFinite(size) && size > 32768) throw Error("RESPONSE_TOO_LARGE");
  const body = await response.text();
  if (body.length > 32768) throw Error("RESPONSE_TOO_LARGE");
  let json;
  if (response.headers.get("content-type")?.includes("application/json")) {
    try { json = JSON.parse(body); } catch { json = null; }
  }
  return { status: response.status, body, json };
}

export async function runP02RenderReadOnlyPreflight(config, get = boundedGet) {
  if (!config || config.origin !== ORIGIN || !SHA.test(config.expectedSha ?? ""))
    throw Error("INVALID_P02_RENDER_CONFIG");
  const checks = [];
  for (const probe of PUBLIC_PATHS) {
    const url = new URL(probe.path, ORIGIN);
    if (url.origin !== ORIGIN) throw Error("UNEXPECTED_HOST");
    try {
      const r = await get(url.toString(), probe.accept);
      checks.push(evaluateP02RenderProbe(probe.key, r, config.expectedSha));
    } catch {
      checks.push({ key: probe.key, state: "UNAVAILABLE_OR_TIMEOUT", status: null });
    }
  }
  const pass = checks.map(x => x.state).join("|") ===
    "HOST_REPORTED_SOURCE_MATCH|PUBLIC_CONTROLS_PRESENT|ANONYMOUS_DENIED";
  return {
    result: pass ? "HOST_ONLY_PREFLIGHT_PASS" : "HOST_ONLY_PREFLIGHT_BLOCKED",
    existingRenderService: "srv-db5p1s142hec739noohg",
    expectedSourceSha: config.expectedSha,
    checks,
    independentlyVerifiedRenderDeployment: false,
    mainDatabaseMigrationAccepted: false,
    authenticatedOwnerAcceptance: false,
    productionPromotionApproved: false,
    noStateChangingOperations: true,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = validateP02RenderReadOnlyConfig({
    permission: process.env.SD_P02_RENDER_READONLY_PERMISSION,
    expectedSha: process.env.SD_P02_RENDER_EXPECTED_SHA,
    existingHost: EXISTING_HOST,
    existingServiceId: "srv-db5p1s142hec739noohg",
  });
  if (!config) {
    process.stderr.write("P02_RENDER_PREFLIGHT_REQUIRES_EXPLICIT_READONLY_APPROVAL_AND_SHA\n");
    process.exitCode = 2;
  } else {
    const result = await runP02RenderReadOnlyPreflight(config);
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    if (result.result !== "HOST_ONLY_PREFLIGHT_PASS") process.exitCode = 1;
  }
}
