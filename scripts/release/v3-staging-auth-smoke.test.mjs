import { test, after } from "node:test";
// The same bounded release CI runs the new V3 provenance and auth-negative checks.
import "./v3-staging-source-preflight.test.mjs";
import assert from "node:assert/strict";
import {
  DEFAULT_PREVIEW,
  PATHS,
  validatedPreviewUrl,
  safePublicRedirect,
  assessSmokeResult,
  disabledSubmitPresent,
  runSmoke,
} from "./v3-staging-auth-smoke.mjs";

test("rejects credential-bearing, internal, external and malformed origins", () => {
  assert.equal(validatedPreviewUrl(DEFAULT_PREVIEW), DEFAULT_PREVIEW);
  for (const input of [
    "http://servicedesk-v2-multilane-gate.onrender.com",
    "https://example.com",
    "https://unrelated-production-service.onrender.com",
    "https://servicedesk-v2-multilane-gate.onrender.com:444",

    "https://localhost:10000",
    "https://token@servicedesk-v2-multilane-gate.onrender.com",
    "https://servicedesk-v2-multilane-gate.onrender.com/auth",
    "https://servicedesk-v2-multilane-gate.onrender.com/?token=sensitive",
    "not a URL",
  ]) assert.equal(validatedPreviewUrl(input), null, input);
});

test("disabled signup requires an actual disabled submit control, not just a notice", () => {
  const spec = PATHS[0];
  const notice = spec.phrase;
  assert.equal(disabledSubmitPresent('<button type="submit" disabled="">Create</button>'), true);
  assert.equal(disabledSubmitPresent('<button disabled type="submit">Create</button>'), true);
  assert.equal(disabledSubmitPresent('<button type="submit">Create</button>'), false);
  assert.equal(disabledSubmitPresent('<button disabled type="button">Cancel</button>'), false);
  assert.equal(assessSmokeResult(DEFAULT_PREVIEW, spec, {
    status: 200, body: notice + '<button type="submit">Create account</button>',
  }).status, "FAIL");
  assert.equal(assessSmokeResult(DEFAULT_PREVIEW, spec, {
    status: 200, body: notice + '<button disabled="" type="submit">Create account</button>',
  }).status, "PASS");
});

test("signed-out callback stays at public sign-in despite a spoofed next", () => {
  assert.equal(safePublicRedirect(DEFAULT_PREVIEW, "/auth/sign-in", "/auth/sign-in"), true);
  assert.equal(safePublicRedirect(DEFAULT_PREVIEW, DEFAULT_PREVIEW + "/auth/sign-in", "/auth/sign-in"), true);
  assert.equal(safePublicRedirect(DEFAULT_PREVIEW, "https://example.invalid/auth/sign-in", "/auth/sign-in"), false);
  assert.equal(safePublicRedirect(DEFAULT_PREVIEW, "https://localhost:10000/auth/sign-in", "/auth/sign-in"), false);
  assert.equal(safePublicRedirect(DEFAULT_PREVIEW, "//example.invalid/auth/sign-in", "/auth/sign-in"), false);
  assert.equal(safePublicRedirect(DEFAULT_PREVIEW, "", "/auth/sign-in"), false);
});

test("distinguishes cold start from application rejection", () => {
  const spec = PATHS[0];
  assert.deepEqual(assessSmokeResult(DEFAULT_PREVIEW, spec, { status: 503, body: "" }), {
    key: spec.key, status: "COLD_START_503", http: 503,
  });
  assert.equal(assessSmokeResult(DEFAULT_PREVIEW, spec, {
    status: 200, body: "Account registration is not available on this preview yet.<button type='submit' disabled>Create account</button>",
  }).status, "PASS");
  assert.equal(assessSmokeResult(DEFAULT_PREVIEW, spec, {
    status: 200, body: "Create your account now!",
  }).status, "FAIL");
});

const originalFetch = globalThis.fetch;
after(() => { globalThis.fetch = originalFetch; });

function mockedResponse(path) {
  const spec = PATHS.find(x => path.endsWith(x.path));
  assert.ok(spec, "Unexpected smoke route");
  return {
    status: spec.redirect ? 303 : 200,
    headers: { get: name => name.toLowerCase() === "location" ? DEFAULT_PREVIEW + "/auth/sign-in" : null },
    text: async () => spec.requireDisabledSubmit
      ? spec.phrase + '<button disabled="" type="submit">Create account</button>'
      : spec.phrase ?? "",
  };
}

test("runs all read-only routes and records successful readiness", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, method: options.method });
    return mockedResponse(url);
  };
  const result = await runSmoke(DEFAULT_PREVIEW, { attempts: 1, delayMs: 0 });
  assert.equal(result.result, "PASS");
  assert.equal(result.coldStart503Observed, false);
  assert.equal(result.checks.length, PATHS.length);
  assert.equal(calls.length, PATHS.length);
  assert.ok(calls.every(x => x.method === "GET"));
});

test("a recovering Render 503 is visible and strict mode rejects it", async () => {
  let number = 0;
  globalThis.fetch = async (url) => {
    number += 1;
    if (number <= PATHS.length) return {
      status: 503, headers: { get: () => null }, text: async () => "",
    };
    return mockedResponse(url);
  };
  const result = await runSmoke(DEFAULT_PREVIEW, { attempts: 2, delayMs: 0, strictAvailability: true });
  assert.equal(result.result, "FAIL_AVAILABILITY");
  assert.equal(result.coldStart503Observed, true);
  assert.equal(result.attempts, 2);
  assert.ok(result.checks.every(x => x.status === "PASS"));
});
