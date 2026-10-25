#!/usr/bin/env node
// Read-only V4 staging source-provenance gate: requires an explicit authorized URL.
// Run: SD_APPROVED_STAGING_HOST=stage.example.com node scripts/delivery/verify-staging-source.mjs https://stage.example.com <40-hex-git-sha>
// This does NOT replace independent hosting-provider deployment metadata.
import assert from "node:assert/strict";

function verifyHealth(body, expectedSha) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "INVALID_HEALTH_SHAPE";
  if (body.ok !== true || body.service !== "servicedesk" || body.status !== "live")
    return "SERVICE_NOT_LIVE";
  if (typeof body.sourceSha !== "string" || body.sourceSha.toLowerCase() !== expectedSha)
    return "SOURCE_SHA_MISMATCH_OR_ABSENT";
  if (!["render", "vercel", "both"].includes(body.sourceProvider))
    return "HOST_SOURCE_PROVIDER_UNVERIFIED";
  return "PASS";
}

if (process.argv[2] === "--self-test") {
  const sha = "a".repeat(40);
  assert.equal(verifyHealth({ ok: true, service: "servicedesk", status: "live",
    sourceSha: sha, sourceProvider: "render" }, sha), "PASS");
  assert.equal(verifyHealth({ ok: true, service: "servicedesk", status: "live",
    sourceSha: "b".repeat(40), sourceProvider: "render" }, sha),
    "SOURCE_SHA_MISMATCH_OR_ABSENT");
  assert.equal(verifyHealth({ ok: true, service: "servicedesk", status: "live" }, sha),
    "SOURCE_SHA_MISMATCH_OR_ABSENT");
  assert.equal(verifyHealth({ ok: true, service: "servicedesk", status: "live",
    sourceSha: sha, sourceProvider: "unknown" }, sha),
    "HOST_SOURCE_PROVIDER_UNVERIFIED");
  assert.equal(verifyHealth({ ok: true, service: "another-product", status: "live",
    sourceSha: sha, sourceProvider: "render" }, sha), "SERVICE_NOT_LIVE");
  console.log("STAGING_PROVENANCE_SELF_TEST=PASS; negative cases verified");
  process.exit(0);
}

const [rawUrl, expectedSha] = process.argv.slice(2);
const host = process.env.SD_APPROVED_STAGING_HOST;
if (!host) {
  console.error("BLOCKED_OWNER: SD_APPROVED_STAGING_HOST must be explicitly set");
  process.exit(2);
}
if (typeof expectedSha !== "string" || !/^[a-f0-9]{40}$/i.test(expectedSha)) {
  console.error("INVALID_EXPECTED_SOURCE_SHA");
  process.exit(2);
}
let base;
try {
  base = new URL(rawUrl);
  if (base.protocol !== "https:" || base.hostname !== host ||
      base.username || base.password || base.search || base.hash ||
      base.pathname !== "/" && base.pathname !== "") throw Error("invalid host");
} catch {
  console.error("STAGING_HOST_NOT_APPROVED_OR_INVALID_URL");
  process.exit(2);
}
try {
  const response = await fetch(new URL("/health", base), {
    method: "GET", redirect: "error",
    headers: { Accept: "application/json", "Cache-Control": "no-store" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json"))
    throw Error("HTTP_NON_JSON_OR_NOT_OK");
  const body = await response.json();
  const status = verifyHealth(body, expectedSha.toLowerCase());
  console.log(JSON.stringify({ state: status, host: base.hostname,
    expectedSha: expectedSha.toLowerCase(),
    observedSha: typeof body?.sourceSha === "string" ? body.sourceSha : null,
    sourceProvider: typeof body?.sourceProvider === "string" ? body.sourceProvider : null }));
  if (status !== "PASS") process.exitCode = 3;
} catch (error) {
  console.error("STAGING_HEALTH_READ_FAILED: " + String(error?.message || error));
  process.exitCode = 3;
}
