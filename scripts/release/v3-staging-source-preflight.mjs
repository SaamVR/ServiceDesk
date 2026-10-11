#!/usr/bin/env node
/**
 * Read-only, no-cookie, no-provider V3 staging provenance and auth preflight.
 * NEVER infer deployment identity from a user-supplied SHA alone.
 *
 * Required (no default target, no secrets):
 *   V3_STAGING_PERMISSION=1
 *   V3_STAGING_ORIGIN=https://explicit-approved-staging.example
 *   V3_STAGING_ALLOWED_HOST=explicit-approved-staging.example
 *   V3_STAGING_EXPECTED_SHA=<40-char exact integrated code SHA>
 *   V3_STAGING_QA_WORKSPACE=<owner-approved nonproduction workspace slug>
 *
 * Run: node scripts/release/v3-staging-source-preflight.mjs
 *
 * A matching host-reported SHA is a useful precondition, not an independently
 * authenticated provider deployment receipt or an authenticated browser PASS.
 */
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const shaPattern = /^[a-f0-9]{40}$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateStagingInputs(input) {
  if (input.permission !== "1" || !shaPattern.test(input.expectedSha ?? "") ||
      typeof input.allowedHost !== "string" ||
      !/^[a-z0-9.-]+$/.test(input.allowedHost) ||
      input.allowedHost.length > 253 ||
      input.allowedHost === "localhost" ||
      input.allowedHost.endsWith(".localhost") ||
      input.allowedHost.endsWith(".local") ||
      input.allowedHost.endsWith(".internal") ||
      /^(?:[0-9]+\.){3}[0-9]+$/.test(input.allowedHost) ||
      !slugPattern.test(input.workspace ?? "") ||
      input.workspace.length > 40) return undefined;
  try {
    const u = new URL(input.origin);
    if (u.protocol !== "https:" || !u.hostname || u.hostname !== input.allowedHost ||
        u.port || u.username || u.password || u.pathname !== "/" ||
        u.search || u.hash) return undefined;
    return {
      origin: u.origin,
      expectedSha: input.expectedSha.toLowerCase(),
      workspace: input.workspace,
    };
  } catch { return undefined; }
}

function result(key, status, http) {
  return { key, status, http };
}

export function evaluateHealth(response, expectedSha) {
  if (response.status !== 200) return result("host-commit", "HTTP_UNAVAILABLE", response.status);
  const json = response.json;
  if (!json || typeof json !== "object" || Array.isArray(json) ||
      json.ok !== true || json.service !== "servicedesk" || json.status !== "live" ||
      !shaPattern.test(json.sourceSha ?? "") ||
      !["render", "vercel", "both"].includes(json.sourceProvider)) {
    return result("host-commit", "HOST_SHA_UNAVAILABLE", response.status);
  }
  return result("host-commit",
    json.sourceSha.toLowerCase() === expectedSha ? "HOST_REPORTED_SHA_MATCH" : "HOST_SHA_MISMATCH",
    response.status);
}

export function evaluateSignIn(response) {
  const body = response.body ?? "";
  return result("public-signin",
    response.status === 200 &&
    /name=["']email["']/i.test(body) &&
    /name=["']password["']/i.test(body)
      ? "PASS" : "FAIL",
    response.status);
}

export function evaluateAnonymousBoundary(response) {
  // Exact 401 from the server-owned authenticated loader. 403, 503,
  // redirects, or a 200 must not be promoted as successful anonymous proof.
  return result("anonymous-delivery-access",
    response.status === 401 ? "ANONYMOUS_DENIED" : "FAIL",
    response.status);
}

async function boundedGet(url, { accept }) {
  const response = await fetch(url, {
    method: "GET",
    redirect: "manual",
    credentials: "omit",
    headers: { Accept: accept, "Cache-Control": "no-cache" },
    signal: AbortSignal.timeout(15_000),
  });
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > 64 * 1024) {
    throw new Error("Staging GET exceeded the bounded response size.");
  }
  const raw = await response.text();
  if (raw.length > 64 * 1024) {
    throw new Error("Staging GET exceeded the bounded response size.");
  }
  const contentType = response.headers.get("content-type") ?? "";
  let json;
  if (contentType.includes("application/json")) {
    try { json = JSON.parse(raw); } catch { json = undefined; }
  }
  return { status: response.status, json, body: raw };
}

export async function runV3StagingPreflight(config, fetchGet = boundedGet) {
  const checks = [];
  const destinations = [
    ["/health", "application/json"],
    ["/auth/sign-in", "text/html"],
    ["/api/internal/inbox/delivery?workspaceSlug=" + encodeURIComponent(config.workspace), "application/json"],
  ];
  for (const [i, [path, accept]] of destinations.entries()) {
    try {
      const response = await fetchGet(config.origin + path, { accept });
      checks.push(i === 0 ? evaluateHealth(response, config.expectedSha)
        : i === 1 ? evaluateSignIn(response) : evaluateAnonymousBoundary(response));
    } catch {
      checks.push(result(
        ["host-commit", "public-signin", "anonymous-delivery-access"][i],
        "NETWORK_OR_RESPONSE_FAILURE", null,
      ));
    }
  }
  return {
    result: checks[0].status === "HOST_REPORTED_SHA_MATCH" &&
      checks[1].status === "PASS" &&
      checks[2].status === "ANONYMOUS_DENIED" ? "PREFLIGHT_PASS" : "PREFLIGHT_BLOCKED",
    checks,
    independentlyVerifiedHostingMetadata: false,
    authenticatedBrowserAcceptance: false,
    providerDeliveryAcceptance: false,
  };
}

async function main() {
  const config = validateStagingInputs({
    permission: process.env.V3_STAGING_PERMISSION,
    origin: process.env.V3_STAGING_ORIGIN,
    allowedHost: process.env.V3_STAGING_ALLOWED_HOST,
    expectedSha: process.env.V3_STAGING_EXPECTED_SHA,
    workspace: process.env.V3_STAGING_QA_WORKSPACE,
  });
  if (!config) {
    process.stderr.write(JSON.stringify({
      result: "PREFLIGHT_BLOCKED",
      reason: "Explicit nonproduction target, exact host, SHA, workspace and permission required",
    }) + "\n");
    process.exitCode = 2;
    return;
  }
  const outcome = await runV3StagingPreflight(config);
  // Do not print URLs with workspace identifiers, response bodies, cookies or
  // customer data; output only check names and status codes.
  process.stdout.write(JSON.stringify(outcome, null, 2) + "\n");
  if (outcome.result !== "PREFLIGHT_PASS") process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
