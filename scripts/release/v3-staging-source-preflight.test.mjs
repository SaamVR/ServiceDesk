import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateStagingInputs,
  evaluateHealth,
  evaluateSignIn,
  evaluateAnonymousBoundary,
  runV3StagingPreflight,
} from "./v3-staging-source-preflight.mjs";

const sha = "a".repeat(40);
const options = {
  permission: "1",
  origin: "https://v3-review.example.test/",
  allowedHost: "v3-review.example.test",
  expectedSha: sha,
  workspace: "isolated-review",
};
const health = {
  status: 200,
  json: { ok: true, service: "servicedesk", status: "live", sourceSha: sha, sourceProvider: "render" },
};
const signIn = {
  status: 200,
  body: '<form><input name="email" type="email" /><input name="password" type="password" /></form>',
};

test("requires explicit approved HTTPS origin, matching exact host, immutable SHA and QA workspace", () => {
  assert.deepEqual(validateStagingInputs(options), {
    origin: options.origin.slice(0, -1), expectedSha: sha, workspace: options.workspace,
  });
  const overrides = [
    { permission: "0" },
    { origin: "http://v3-review.example.test/" },
    { origin: "https://v3-review.example.test:443/auth" },
    { origin: "https://someone@v3-review.example.test/" },
    { origin: "https://v3-review.example.test/?session=secret" },
    { origin: "https://production.example.test/" },
    { allowedHost: "127.0.0.1", origin: "https://127.0.0.1/" },
    { allowedHost: "localhost", origin: "https://localhost/" },
    { allowedHost: "service.internal", origin: "https://service.internal/" },
    { expectedSha: "not-a-git-sha" },
    { workspace: "../../production" },
    { workspace: "x".repeat(41) },
  ];
  for (const override of overrides) {
    assert.equal(validateStagingInputs({ ...options, ...override }), undefined, JSON.stringify(override));
  }
});

test("host source SHA is not inferred from a user flag and conflicts fail closed", () => {
  assert.equal(evaluateHealth({ status: 200, json: { ok: true, status: "live" } }, sha).status, "HOST_SHA_UNAVAILABLE");
  assert.equal(evaluateHealth({ ...health, json: { ...health.json, sourceSha: "b".repeat(40) } }, sha).status, "HOST_SHA_MISMATCH");
  assert.equal(evaluateHealth({ ...health, json: { ...health.json, sourceSha: "" } }, sha).status, "HOST_SHA_UNAVAILABLE");
  assert.equal(evaluateHealth({ ...health, status: 503 }, sha).status, "HTTP_UNAVAILABLE");
  assert.equal(evaluateHealth(health, sha).status, "HOST_REPORTED_SHA_MATCH");
});

test("anonymous staff delivery boundary must reject unauthenticated requests with 401", () => {
  assert.equal(evaluateAnonymousBoundary({ status: 401 }).status, "ANONYMOUS_DENIED");
  for (const status of [200, 302, 403, 404, 500, 503]) {
    assert.equal(evaluateAnonymousBoundary({ status }).status, "FAIL");
  }
});

test("sign-in check requires real user credential controls rather than a generic page", () => {
  assert.equal(evaluateSignIn(signIn).status, "PASS");
  assert.equal(evaluateSignIn({ ...signIn, body: "Sign in" }).status, "FAIL");
  assert.equal(evaluateSignIn({ ...signIn, body: '<input name="email">' }).status, "FAIL");
});

test("performs only three sequential no-data GET probes with safe metadata output", async () => {
  const config = validateStagingInputs(options);
  const calls = [];
  const result = await runV3StagingPreflight(config, async (url, opts) => {
    calls.push([url, opts.accept]);
    if (url.endsWith("/health")) return health;
    if (url.endsWith("/auth/sign-in")) return signIn;
    return { status: 401, json: { code: "DELIVERY_TRIAGE_UNAUTHORIZED" } };
  });
  assert.equal(result.result, "PREFLIGHT_PASS");
  assert.equal(result.independentlyVerifiedHostingMetadata, false);
  assert.equal(result.authenticatedBrowserAcceptance, false);
  assert.equal(result.providerDeliveryAcceptance, false);
  assert.equal(result.checks.length, 3);
  assert.deepEqual(calls.map(x => new URL(x[0]).pathname),
    ["/health", "/auth/sign-in", "/api/internal/inbox/delivery"]);
  assert.deepEqual(result.checks.map(x => x.http), [200, 200, 401]);
  assert.equal(JSON.stringify(result).includes("isolated-review"), false);
});

test("unauthorized-success or an unprovable host commit blocks staging preflight", async () => {
  const config = validateStagingInputs(options);
  const unauthorizedSuccess = await runV3StagingPreflight(config, async (url) => {
    if (url.endsWith("/health")) return health;
    if (url.endsWith("/auth/sign-in")) return signIn;
    return { status: 200, json: { items: [] } };
  });
  assert.equal(unauthorizedSuccess.result, "PREFLIGHT_BLOCKED");
  const missingSha = await runV3StagingPreflight(config, async url => {
    if (url.endsWith("/health")) return { ...health, json: { ...health.json, sourceSha: undefined } };
    if (url.endsWith("/auth/sign-in")) return signIn;
    return { status: 401 };
  });
  assert.equal(missingSha.result, "PREFLIGHT_BLOCKED");
});
