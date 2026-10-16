import test from "node:test";
import assert from "node:assert/strict";
import {evaluateReviewMergeTreeParity} from "../v4-review-merge-tree-parity.mjs";
const sha=n=>n.repeat(40);
const valid={
  expectedHeadSha:sha("a"),observedHeadSha:sha("a"),
  expectedBaseSha:sha("b"),observedBaseSha:sha("b"),
  expectedMergeSha:sha("c"),observedMergeSha:sha("c"),
  controllerTreeSha:sha("d"),mergeTreeSha:sha("d"),
};
test("identical controller and virtual review merge tree certifies source-only parity",()=>{
  const result=evaluateReviewMergeTreeParity(valid);
  assert.equal(result.ok,true);
  assert.equal(result.code,"REVIEW_MERGE_TREE_EQUALS_CONTROLLER");
  assert.equal(result.sourceSha,valid.expectedHeadSha);
});
test("review-specific source overwrite or omission prevents parity",()=>{
  assert.deepEqual(evaluateReviewMergeTreeParity({...valid,mergeTreeSha:sha("e")}),
    {ok:false,code:"REVIEW_PARITY_TREE_MISMATCH"});
});
test("stale PR head, base or checkout identity cannot certify an unrelated merge",()=>{
  for(const key of ["observedHeadSha","observedBaseSha","observedMergeSha"]){
    assert.deepEqual(evaluateReviewMergeTreeParity({...valid,[key]:sha("f")}),
      {ok:false,code:"REVIEW_PARITY_MERGE_IDENTITY_MISMATCH"});
  }
});
test("missing, malformed or nonhex object identities fail closed",()=>{
  for(const value of ["",undefined,"f".repeat(39),"not-a-commit"]) {
    assert.deepEqual(evaluateReviewMergeTreeParity({...valid,expectedHeadSha:value}),
      {ok:false,code:"REVIEW_PARITY_SHA_INVALID"});
  }
});
