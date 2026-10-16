/** Exact-source parity for the isolated Render REVIEW pull request.
 * Pure evaluation; this script never deploys, contacts providers or mutates.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const SHA=/^[0-9a-f]{40}$/;
export function evaluateReviewMergeTreeParity({
  expectedHeadSha, expectedBaseSha, expectedMergeSha,
  observedHeadSha, observedBaseSha, observedMergeSha,
  controllerTreeSha, mergeTreeSha,
}) {
  const values=[expectedHeadSha,expectedBaseSha,expectedMergeSha,
    observedHeadSha,observedBaseSha,observedMergeSha,
    controllerTreeSha,mergeTreeSha];
  if(values.some(value=>typeof value!=="string" || !SHA.test(value)))
    return {ok:false,code:"REVIEW_PARITY_SHA_INVALID"};
  if(expectedHeadSha!==observedHeadSha ||
      expectedBaseSha!==observedBaseSha ||
      expectedMergeSha!==observedMergeSha)
    return {ok:false,code:"REVIEW_PARITY_MERGE_IDENTITY_MISMATCH"};
  if(controllerTreeSha!==mergeTreeSha)
    return {ok:false,code:"REVIEW_PARITY_TREE_MISMATCH"};
  return {ok:true,code:"REVIEW_MERGE_TREE_EQUALS_CONTROLLER",sourceSha:expectedHeadSha,
    controllerTreeSha,mergeTreeSha,reviewMergeSha:observedMergeSha};
}

if (process.argv[1] && fileURLToPath(import.meta.url)===resolve(process.argv[1])) {
  const git=(name)=>execFileSync("git",["rev-parse",name],
    {encoding:"utf8",timeout:10000}).trim();
  try {
    if(process.env.GITHUB_EVENT_NAME!=="pull_request")
      throw new Error("REVIEW_PARITY_REQUIRES_PULL_REQUEST_MERGE_REF");
    const result=evaluateReviewMergeTreeParity({
      expectedHeadSha:process.env.REVIEW_PR_HEAD_SHA,
      expectedBaseSha:process.env.REVIEW_PR_BASE_SHA,
      expectedMergeSha:process.env.GITHUB_SHA,
      observedHeadSha:git("HEAD^2"),
      observedBaseSha:git("HEAD^1"),
      observedMergeSha:git("HEAD"),
      controllerTreeSha:git("HEAD^2^{tree}"),
      mergeTreeSha:git("HEAD^{tree}"),
    });
    console.log(JSON.stringify(result));
    if(!result.ok) process.exitCode=1;
  } catch(error) {
    console.error("REVIEW_PARITY_UNVERIFIED",error instanceof Error?error.message:"unknown");
    process.exitCode=1;
  }
}
