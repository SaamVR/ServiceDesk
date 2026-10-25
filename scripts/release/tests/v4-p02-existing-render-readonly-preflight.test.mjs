import test from "node:test";
import assert from "node:assert/strict";
import {
  EXISTING_HOST, ORIGIN, REVIEWED_P02_RC_SHA, validateP02RenderReadOnlyConfig,
  evaluateP02RenderProbe, runP02RenderReadOnlyPreflight,
} from "../v4-p02-existing-render-readonly-preflight.mjs";

const SHA = REVIEWED_P02_RC_SHA;
const accepted = {
  permission: "READ_ONLY", expectedSha: SHA, existingHost: EXISTING_HOST,
  existingServiceId: "srv-db5p1s142hec739noohg",
};
const health = { status: 200, json: { ok:true, service:"servicedesk", status:"live",
  sourceSha:SHA, sourceProvider:"render" } };
const signin = { status: 200,
  body: '<form><input name="email"><input name="password"></form>' };
const denied = { status: 401, body:"" };
function fakeGet(changes = {}) {
  const urls = [];
  const get = async (url, accept) => {
    urls.push({ url, accept });
    if (url.includes("/health")) return changes.health || health;
    if (url.includes("/auth/sign-in")) return changes.signin || signin;
    return changes.boundary || denied;
  };
  return { get, urls };
}

test("refuses unapproved/freeform hosts, unknown services and unreviewed source", () => {
  assert.deepEqual(validateP02RenderReadOnlyConfig(accepted),
    { expectedSha: SHA, origin: ORIGIN });
  for (const overrides of [
    { permission: undefined },
    { permission: "DEPLOY" },
    { existingHost: "another-render-service.onrender.com" },
    { existingServiceId: "srv-wrong" },
    { expectedSha: "unknown" },
    { expectedSha: "1234567" },
    { expectedSha: "3962aa5c84c3aa5f47ad72b62d51ae4382467708" },
    { expectedSha: "a".repeat(40) },
  ]) {
    assert.equal(validateP02RenderReadOnlyConfig({ ...accepted, ...overrides }), null);
  }
});

test("passes only current exact V4 host SHA + signin + anonymous denial", async () => {
  const f = fakeGet();
  const result = await runP02RenderReadOnlyPreflight(
    validateP02RenderReadOnlyConfig(accepted), f.get);
  assert.equal(result.result, "HOST_ONLY_PREFLIGHT_PASS");
  assert.equal(result.independentlyVerifiedRenderDeployment, false);
  assert.equal(result.mainDatabaseMigrationAccepted, false);
  assert.equal(result.authenticatedOwnerAcceptance, false);
  assert.equal(result.productionPromotionApproved, false);
  assert.equal(result.noStateChangingOperations, true);
  assert.equal(f.urls.length, 3);
  assert.ok(f.urls.every(x => new URL(x.url).hostname === EXISTING_HOST));
  assert.deepEqual(f.urls.map(x => x.accept),
    ["application/json", "text/html", "application/json"]);
  assert.equal(JSON.stringify(result).includes("sd-p02-unauthorized-probe"), false);
});

test("rejects suspended/free-tier, old V3, missing SHA and spoofed identity", async () => {
  const scenarios = [
    { health: { status:503,body:"Free Tier Usage Exceeded"} },
    { health: { ...health, json:{...health.json,sourceSha:"b".repeat(40)} } },
    { health: { ...health, json:{...health.json,sourceSha:undefined} } },
    { health: { ...health, json:{...health.json,sourceProvider:"vercel"} } },
    { health: { ...health, json:{...health.json,service:"other"} } },
    { signin: { status:200, body:"Sign in" } },
    { boundary: { status:200, body:"[]" } },
    { boundary: { status:302,body:"" } },
    { boundary: { status:403,body:"" } },
  ];
  for (const scenario of scenarios) {
    const result = await runP02RenderReadOnlyPreflight(
      validateP02RenderReadOnlyConfig(accepted), fakeGet(scenario).get);
    assert.equal(result.result, "HOST_ONLY_PREFLIGHT_BLOCKED",
      JSON.stringify(scenario));
  }
});

test("network failures produce blocked status without logging response contents", async () => {
  const output = await runP02RenderReadOnlyPreflight(
    validateP02RenderReadOnlyConfig(accepted), async () => { throw Error("token=SECRET"); });
  assert.equal(output.result, "HOST_ONLY_PREFLIGHT_BLOCKED");
  assert.equal(JSON.stringify(output).includes("SECRET"), false);
  assert.equal(output.checks.length, 3);
  assert.ok(output.checks.every(x => x.state === "UNAVAILABLE_OR_TIMEOUT"));
});

test("enforces exact required schema and deliberately disclaims deployed readiness", () => {
  assert.equal(evaluateP02RenderProbe("hosting-sha", health, SHA).state,
    "HOST_REPORTED_SOURCE_MATCH");
  assert.equal(evaluateP02RenderProbe("hosting-sha", {
    ...health, json: {...health.json,sourceSha:"b".repeat(40)},
  }, SHA).state,"SOURCE_MISMATCH");
  assert.equal(evaluateP02RenderProbe("anonymous-owner-boundary",{status:401},SHA).state,
    "ANONYMOUS_DENIED");
  assert.throws(() => evaluateP02RenderProbe("unknown",{status:200},SHA),
    /UNRECOGNIZED_PROBE/);
});
