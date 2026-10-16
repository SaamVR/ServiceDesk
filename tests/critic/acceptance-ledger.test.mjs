import test from "node:test";
import assert from "node:assert/strict";
import { validateCriticAcceptance, REQUIRED_DIMENSIONS } from "../../scripts/release/critic-acceptance-ledger.mjs";

const link = "https://github.com/SaamVR/ServiceDesk/actions/runs/38908381771";
const sha = "7c826383c61c1a68c7701b2b937e4cb0695c5abf";
function blockedLedger() {
  return {
    sourceSha: sha,
    deployedSha: "5b876a7a806b5b63eca8e1b9396a3a7509240ec6",
    verdict: "BLOCKED",
    commercialReady: false,
    dimensions: Object.fromEntries(REQUIRED_DIMENSIONS.map(key => [key, {
      status: "BLOCKED", proofMode: "SOURCE_ONLY", evidence: [link],
    }])),
  };
}

test("truthful blocked release remains valid", () => {
  assert.deepEqual(validateCriticAcceptance(blockedLedger()), []);
});
test("mocked CI cannot certify merchant-level commercial outcome", () => {
  const record = blockedLedger();
  record.dimensions.businessEffectiveness.status = "PASS";
  assert.match(validateCriticAcceptance(record).join("\n"), /AUTHORIZED_REAL/);
});
test("a different live SHA cannot receive deployment PASS", () => {
  const record = blockedLedger();
  record.dimensions.deployed = { status: "PASS", proofMode: "AUTHORIZED_REAL", evidence: [link] };
  assert.match(validateCriticAcceptance(record).join("\n"), /exactly the accepted source SHA/);
});
test("overall PASS and commercial ready must pass every required dimension", () => {
  const record = blockedLedger();
  record.verdict = "PASS";
  record.commercialReady = true;
  const errors = validateCriticAcceptance(record).join("\n");
  assert.match(errors, /Overall PASS/);
  assert.match(errors, /Commercial readiness/);
});
test("PASS must retain GitHub evidence links", () => {
  const record = blockedLedger();
  record.dimensions.implementation = { status: "PASS", proofMode: "SOURCE_ONLY", evidence: [] };
  assert.match(validateCriticAcceptance(record).join("\n"), /PASS without/);
});
test("unknown status and non-GitHub links fail validation", () => {
  const record = blockedLedger();
  record.dimensions.security = { status: "UNKNOWN", evidence: ["https://example.com/claim"] };
  assert.match(validateCriticAcceptance(record).join("\n"), /missing\/invalid/);
});
