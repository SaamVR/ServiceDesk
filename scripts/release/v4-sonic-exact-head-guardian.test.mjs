import {test} from "node:test";
import assert from "node:assert/strict";
import {
 requiredGates,validateGuardianConfig,evaluateExactHeadRuns,
 checkExactHead,watchExactHead,
} from "./v4-sonic-exact-head-guardian.mjs";
const sha="a".repeat(40),foreignSha="b".repeat(40);
const branch="feat/servicedesk-v4-reconciled-qa-shell-20261012";
const raw={
 repo:"SaamVR/ServiceDesk",branch,sha,token:"synthetic-qa-token-exact-no-real-github-secret",
};
const goodRuns=()=>requiredGates.map((name,i)=>({
 id:1200+i,name,head_sha:sha,head_branch:branch,
 status:"completed",conclusion:"success",
}));
test("config rejects noncanonical branch, unknown repo, fake SHA and missing token",()=>{
 assert.ok(validateGuardianConfig(raw));
 for(const edit of [
  {branch:"main"},{repo:"evil.com/path?token=x"}, {repo:"a/b/c"},
  {sha:"short"},{token:""},{token:123},
 ]){
  assert.equal(validateGuardianConfig({...raw,...edit}),null);
 }
});
test("only exact-head BOTH successful app+Chrome and PG17 gates can pass",()=>{
 assert.equal(evaluateExactHeadRuns(goodRuns(),sha,branch).state,
  "EXACT_HEAD_SOURCE_PG17_PASS");
 assert.equal(evaluateExactHeadRuns(goodRuns().filter(r=>r.name===requiredGates[0]),sha,branch).state,
  "GATES_PENDING");
 assert.equal(evaluateExactHeadRuns(goodRuns().map(r=>({...r,head_sha:foreignSha})),sha,branch).state,
  "GATES_PENDING");
 assert.equal(evaluateExactHeadRuns(goodRuns().map(r=>({...r,head_branch:"main"})),sha,branch).state,
  "GATES_PENDING");
});
test("newer cancelled or failed exact-head run vetoes an older success",()=>{
 const runs=goodRuns();
 const failed={...runs[0],id:9999,conclusion:"failure"};
 assert.equal(evaluateExactHeadRuns([...runs,failed],sha,branch).state,"GATES_FAILED");
 const cancelled={...failed,conclusion:"cancelled"};
 assert.equal(evaluateExactHeadRuns([...runs,cancelled],sha,branch).state,"GATES_FAILED");
 const running={...failed,status:"in_progress",conclusion:null};
 assert.equal(evaluateExactHeadRuns([...runs,running],sha,branch).state,"GATES_PENDING");
});
test("stale canonical SHA blocks without relying on favorable CI results",async()=>{
 let count=0;
 const result=await checkExactHead(validateGuardianConfig(raw),async url=>{
  count++;
  assert.ok(url.includes("/git/ref/heads/"));
  return {object:{sha:foreignSha}};
 });
 assert.equal(result.state,"STALE_BRANCH_HEAD");
 assert.equal(count,1);
});
test("bounded watcher polls until BOTH gates pass but cannot bless failure or timeout",async()=>{
 let calls=0,slept=0;
 const load=async url=>{
  if(url.includes("/git/ref/heads/"))return {object:{sha}};
  const runs=goodRuns();
  if(++calls===1)runs[1]={...runs[1],status:"in_progress",conclusion:null};
  return {workflow_runs:runs};
 };
 const result=await watchExactHead(validateGuardianConfig(raw),load,async()=>{slept++},{attempts:3,intervalMs:1});
 assert.equal(result.state,"EXACT_HEAD_SOURCE_PG17_PASS");
 assert.equal(result.attempt,2);
 assert.equal(slept,1);
 const alwaysPending=async url=>url.includes("/git/ref/heads/")?
  {object:{sha}}:{workflow_runs:[]};
 const blocked=await watchExactHead(validateGuardianConfig(raw),alwaysPending,async()=>{slept++},{attempts:2,intervalMs:1});
 assert.equal(blocked.state,"GATES_TIMEOUT");
 assert.equal(blocked.attempt,2);
});
