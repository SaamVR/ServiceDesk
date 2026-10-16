import { test } from "node:test";
import assert from "node:assert/strict";
import { assessMerchantUatPreflight } from "../v4-merchant-uat-preflight.mjs";

const releaseSha = "3bea4f105fb6d7771d38653d1d12d634e80fd687";
const snapshot = () => ({
  expectedReviewSha:releaseSha, reportedLiveSha:releaseSha,
  provenance:"READ_ONLY_DATABASE_AGGREGATES", fictionalOwnerSessions:0,
  externalEffectsDisabled:true,
  counts:{workspaces:1,activeServices:0,activeUsdBranchBooks:0,
    requests:1,quotes:0,workflowExecutions:0,invoices:0,outboxEvents:0,outboundMessages:0},
});

test("actual read-only staging counts do not imply merchant acceptance",()=>{
  const value=assessMerchantUatPreflight(snapshot());
  assert.equal(value.status,"BLOCKED_PREREQUISITES");
  assert.equal(value.acceptanceVerified,false);
  assert.ok(value.blockers.some(x=>x.includes("second isolated fictional workspace")));
  assert.ok(value.requiredWork.some(x=>x.includes("saved branch price book")));
  assert.ok(value.requiredWork.some(x=>x.includes("invoice")));
  assert.ok(value.requiredWork.some(x=>x.includes("provider delivery UNVERIFIED")));
});

test("stale deployed SHA is never accepted even when fixture counts are complete",()=>{
  const data=snapshot();
  data.reportedLiveSha="a".repeat(40);
  data.fictionalOwnerSessions=2;
  Object.assign(data.counts,{workspaces:2,activeServices:3,activeUsdBranchBooks:2,
    quotes:2,workflowExecutions:1,invoices:1,outboxEvents:1,outboundMessages:1});
  const value=assessMerchantUatPreflight(data);
  assert.equal(value.status,"BLOCKED_PREREQUISITES");
  assert.ok(value.blockers.some(x=>x.includes("LIVE SHA")));
  assert.equal(value.acceptanceVerified,false);
});

test("fail-closed for absent, fractional and fabricated signed-in evidence",()=>{
  assert.equal(assessMerchantUatPreflight({}).status,"EVIDENCE_INVALID");
  const noCount=snapshot(); delete noCount.counts.quotes;
  assert.equal(assessMerchantUatPreflight(noCount).status,"EVIDENCE_INVALID");
  const float=snapshot();float.counts.quotes=0.5;
  assert.equal(assessMerchantUatPreflight(float).status,"EVIDENCE_INVALID");
  const wrongProvenance=snapshot();wrongProvenance.provenance="BROWSER_UAT_PASS";
  assert.equal(assessMerchantUatPreflight(wrongProvenance).status,"EVIDENCE_INVALID");
  const effects=snapshot(); effects.externalEffectsDisabled=false;
  assert.equal(assessMerchantUatPreflight(effects).status,"BLOCKED_PREREQUISITES");
});

test("complete declarations only permit independent review, never assert a commercial PASS",()=>{
  const data=snapshot();data.fictionalOwnerSessions=2;
  Object.assign(data.counts,{workspaces:2,activeServices:3,activeUsdBranchBooks:2,
    quotes:2,workflowExecutions:1,invoices:1,outboxEvents:1,outboundMessages:1});
  const result=assessMerchantUatPreflight(data);
  assert.equal(result.status,"READY_FOR_INDEPENDENT_ACCEPTANCE_REVIEW");
  assert.deepEqual(result.blockers,[]);
  assert.deepEqual(result.requiredWork,[]);
  assert.equal(result.acceptanceVerified,false);
  assert.equal(result.evidenceClass,"OPERATOR_REPORTED_PREFLIGHT_NOT_LIVE_UAT");
});
