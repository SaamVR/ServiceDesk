#!/usr/bin/env node
/**
 * Real HTTP acceptance for a built or LIVE review ServiceDesk.
 * No credentials, RLS bypass, fake tenant data, provider requests or writes.
 *
 * Run in release CI against the exact built HEAD:
 *   node scripts/release/v4-studio-guest-release-contract.mjs
 * Or verify the explicitly approved Render review:
 *   V4_GUEST_ROUTE_ORIGIN=https://servicedesk-v3-frontend-review.onrender.com node scripts/release/v4-studio-guest-release-contract.mjs
 */
const origin = process.env.V4_GUEST_ROUTE_ORIGIN || "http://127.0.0.1:3000";
const approved = new Set([
  "http://127.0.0.1:3000",
  "https://servicedesk-v3-frontend-review.onrender.com",
]);
if (!approved.has(origin)) throw Error("GUEST_RELEASE_BLOCKED: unapproved origin");

const publicPaths = [
  "/", "/features", "/tour", "/pricing", "/integrations",
  "/contact", "/help", "/auth/sign-in", "/auth/sign-up",
];
const modules = [
  "overview", "inbox", "automations", "schedule", "jobs", "requests",
  "quotes", "customers", "invoices", "quality", "reports", "billing", "settings",
];
const workspace = "fictional-guest-no-session";
const scopeHeader = "x-servicedesk-staff-request-target";

function check(condition, name) {
  if (!condition) throw Error("GUEST_RELEASE_FAILED:" + name);
}

async function get(path, headers = {}) {
  return fetch(origin + path, {
    method: "GET",
    redirect: "manual",
    cache: "no-store",
    headers: { "User-Agent": "ServiceDesk-V4-anonymous-release-contract", ...headers },
    signal: AbortSignal.timeout(16000),
  });
}

function expectedTarget(path) {
  const url = new URL(path, origin);
  url.searchParams.delete("_rsc");
  return url.pathname + (url.searchParams.size ? "?" + url.searchParams.toString() : "");
}

async function checkProtected(path, label, extraHeaders) {
  const response = await get(path, extraHeaders);
  check([302, 303, 307, 308].includes(response.status), "denial-status-" + label);
  const location = response.headers.get("location");
  check(Boolean(location), "missing-login-redirect-" + label);
  const login = new URL(location, origin);
  check(login.origin === origin && login.pathname === "/auth/sign-in", "same-origin-login-" + label);
  const next = login.searchParams.get("next");
  check(next === expectedTarget(path), "wrong-post-login-target-" + label);
}

async function main() {
  const publicResults = await Promise.all(publicPaths.map(async path => {
    const response = await get(path);
    check(response.status === 200, "public-status-" + path);
    check((response.headers.get("content-type") || "").includes("text/html"), "public-type-" + path);
    const html = await response.text();
    check(html.includes("ServiceDesk AI") && html.includes("<title"), "public-content-" + path);
    check(!/Application error: a server-side exception has occurred/i.test(html),
      "public-error-" + path);
    return path;
  }));
  const protectedResults = await Promise.all(modules.map(async name => {
    const path = "/app/" + workspace + "/" + name;
    await checkProtected(path, name);
    return name;
  }));
  const extraPaths = [
    "/app/" + workspace + "/jobs?job=visit-42&queue=unassigned",
    "/app/" + workspace + "/requests?search=Deep%20Cleaning",
    "/app/" + workspace + "/inbox?search=Owner%20Review",
    "/app/" + workspace + "/automations?mode=review&_rsc=opaque",
  ];
  for (const path of extraPaths) await checkProtected(path, "filtered-" + extraPaths.indexOf(path));
  await checkProtected(
    "/app/" + workspace + "/inbox",
    "spoofed-client-header",
    { [scopeHeader]: "/app/foreign-workspace/billing" },
  );

  // These nested dynamic segments have no authored Next page. A 404 is more
  // truthful than claiming they are authenticated record-detail routes.
  const missing = await get("/app/" + workspace + "/jobs/visit-42");
  check(missing.status === 404, "unimplemented-nested-path-must-not-pass");
  // The real model-backed staff conversation endpoint is cookie-authenticated.
  // These are *negative* tests only: no staff session, model key, customer
  // message, billing action or provider call is involved.
  const staffAiEndpoint = origin + "/api/internal/ai/draft";
  const fictionalAiRequest = JSON.stringify({
    workspaceSlug: workspace, conversationId: "fictional-conversation",
    messageId: "fictional-message",
  });
  const staffAiCases = [
    { name: "missing-origin", headers: { "content-type": "application/json" },
      body: fictionalAiRequest, status: 403, code: "SAME_ORIGIN_REQUIRED" },
    { name: "foreign-origin",
      headers: { "content-type": "application/json", origin: "https://malicious.example" },
      body: fictionalAiRequest, status: 403, code: "SAME_ORIGIN_REQUIRED" },
    { name: "cross-site",
      headers: { "content-type": "application/json", origin,
        "sec-fetch-site": "cross-site" },
      body: fictionalAiRequest, status: 403, code: "SAME_ORIGIN_REQUIRED" },
    { name: "invalid-role-injection",
      headers: { "content-type": "application/json", origin, "sec-fetch-site": "same-origin" },
      body: JSON.stringify({ ...JSON.parse(fictionalAiRequest), role: "OWNER" }),
      status: 400, code: "REQUEST_SCHEMA_INVALID" },
    { name: "no-staff-session",
      headers: { "content-type": "application/json", origin, "sec-fetch-site": "same-origin" },
      body: fictionalAiRequest, status: 401, code: "AI_STAFF_UNAUTHORIZED" },
  ];
  for (const attempt of staffAiCases) {
    const reply = await fetch(staffAiEndpoint, {
      method: "POST", cache: "no-store", redirect: "manual",
      headers: { "User-Agent": "ServiceDesk-V4-anonymous-release-contract", ...attempt.headers },
      body: attempt.body, signal: AbortSignal.timeout(16000),
    });
    const data = await reply.json().catch(() => null);
    if (reply.status !== attempt.status || data?.code !== attempt.code) {
      // Emit only numeric HTTP status + constrained error category; never log
      // request body, cookies, customer data, model output or auth headers.
      const observedCode = typeof data?.code === "string" &&
        /^[A-Z][A-Z0-9_]{2,79}$/.test(data.code)
          ? data.code : "UNRECOGNIZED_OR_MISSING_CODE";
      console.error("V4_GUEST_DENIAL_DIAGNOSTIC", JSON.stringify({
        case: attempt.name,
        expectedStatus: attempt.status,
        observedStatus: reply.status,
        expectedCode: attempt.code,
        observedCode,
      }));
    }
    check(reply.status === attempt.status &&
      data?.code === attempt.code, "anonymous-staff-ai-" + attempt.name);
    check((reply.headers.get("cache-control") ?? "").includes("no-store"),
      "anonymous-staff-ai-cache-" + attempt.name);
  }
  console.log("V4_GUEST_RELEASE_PASS", JSON.stringify({
    publicRoutes: publicResults.length, guestDeniedModules: protectedResults.length,
    filteredDestinations: extraPaths.length, spoofedHeadersRejected: 1,
    undefinedNestedRoutesFailClosed: 1,
    anonymousStaffAiDenialCases: staffAiCases.length,
    authenticatedOwnerAcceptance: false, tenantRlsAcceptance: false,
    providerDeliveryAcceptance: false,
  }));
}
await main();
