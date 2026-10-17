#!/usr/bin/env node
/**
 * Live PUBLIC, NO-SECRETS smoke for the operator-provided Codex Gateway.
 *
 * Deliberately makes NO authenticated model calls and sends NO customer data.
 * Confirms from a GitHub-hosted runner that public HTTPS GET and POST arrive
 * at the real gateway auth boundary, rather than a Cloudflare block page.
 */
const BASE = "https://codex-api.ezcomo.shop";
const LIMIT_MS = 12_000;
const checks = [];
const syntheticBody = JSON.stringify({
  model: "codex",
  stream: false,
  messages: [{role: "user", content: "Synthetic unauthenticated access-control check, no customer data"}],
});

async function expectRoute(name, pathname, expectedStatus, init = {}) {
  const signal = AbortSignal.timeout(LIMIT_MS);
  const started = Date.now();
  let response;
  try {
    response = await fetch(BASE + pathname, {
      ...init,
      signal,
      cache: "no-store",
      redirect: "manual",
    });
  } catch (error) {
    const result = {
      name, outcome: "FAIL", classification: error?.name === "TimeoutError"
        ? "timeout" : "network_failure",
    };
    checks.push(result);
    return result;
  }
  const {status} = response;
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.toLowerCase().includes("application/json");
  let json = null;
  if (isJson && Number(response.headers.get("content-length") || 0) <= 16384) {
    try {
      const text = await response.text();
      if (text.length <= 16384) json = JSON.parse(text);
    } catch {
      json = null;
    }
  } else {
    await response.body?.cancel();
  }
  const originHealth = name === "health"
    ? (json?.ok === true && json?.codex === true)
    : json?.error === "unauthorized";
  const passed = status === expectedStatus && isJson && originHealth;
  const result = {
    name, outcome: passed ? "PASS" : "FAIL",
    status, expectedStatus,
    json: isJson,
    gatewaySemantics: Boolean(originHealth),
    elapsedMs: Date.now() - started,
    // Only metadata; never expose provider error bodies or cloudflare tokens.
    ...(status === 403 ? {classification: "edge_or_waf_rejection"} : {}),
  };
  checks.push(result);
  return result;
}

await expectRoute("health", "/health", 200);
await expectRoute("models_anonymous_denied", "/v1/models", 401);
await expectRoute("models_invalid_bearer_denied", "/v1/models", 401, {
  headers: {Authorization: "Bearer synthetic-invalid-key-not-a-secret"},
});
await expectRoute("chat_post_anonymous_denied", "/v1/chat/completions", 401, {
  method: "POST",
  headers: {"content-type": "application/json"},
  body: syntheticBody,
});
await expectRoute("chat_post_invalid_bearer_denied", "/v1/chat/completions", 401, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    Authorization: "Bearer synthetic-invalid-key-not-a-secret",
  },
  body: syntheticBody,
});
const report = {
  kind: "PUBLIC_GATEWAY_HTTP_REACHABILITY_ONLY",
  providerVerified: false,
  authenticatedModelExecuted: false,
  gateway: BASE,
  checks,
  passed: checks.every(item => item.outcome === "PASS"),
};
console.log(JSON.stringify(report, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) {
  const {appendFile} = await import("node:fs/promises");
  const rows = checks.map(c => `| ${c.name} | ${c.status ?? c.classification} | ${c.outcome} |`).join("\n");
  await appendFile(process.env.GITHUB_STEP_SUMMARY,
    `## ServiceDesk Codex Gateway — unauthenticated public HTTP smoke\n\n` +
    `**Provider verification: NOT established.** No gateway key or real inference is used.\n\n` +
    `| Check | HTTP status/error | Result |\n|---|---|---|\n${rows}\n\n`);
}
if (!report.passed) process.exitCode = 1;
