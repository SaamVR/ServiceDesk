#!/usr/bin/env node
/**
 * Read-only GitHub Actions release guardian for the V4 canonical development
 * branch. It observes TWO matching exact commit CI results; it never deploys,
 * writes to issues/PRs, modifies DB, calls providers or elevates release status.
 *
 * A pass means source/application/Chrome and ephemeral PG17 worker CI only,
 * NOT staging merchant acceptance, commercial model inference or release.
 */
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";

export const requiredGates=[
 "ServiceDesk V4 reconciled exact-HEAD full RC",
 "V4 integrated internal quote source recovery PG17 and worker",
];
const shaPattern=/^[a-f0-9]{40}$/i;
const repoPattern=/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
export function validateGuardianConfig(raw){
 if(!raw || !shaPattern.test(raw.sha??"") ||
    typeof raw.repo!=="string" || !repoPattern.test(raw.repo) ||
    raw.branch!=="feat/servicedesk-v4-reconciled-qa-shell-20261012")
    return null;
 const token=typeof raw.token==="string" ? raw.token : "";
 if(token.length<20 || token.length>2000)return null;
 return {repo:raw.repo,branch:raw.branch,sha:raw.sha.toLowerCase(),token};
}
export function evaluateExactHeadRuns(runs,sha,branch){
 if(!Array.isArray(runs))return {state:"GATES_UNAVAILABLE",gates:[]};
 const gates=requiredGates.map(name=>{
  const exact=runs.filter(r=>r && r.name===name && r.head_sha===sha &&
    r.head_branch===branch && Number.isSafeInteger(r.id));
  // Most recent exact-head dispatch, not an older green run that was
  // superseded by a failed, cancelled or pending rerun.
  const latest=exact.sort((a,b)=>b.id-a.id)[0];
  return {name,runId:latest?.id??null,
   status:latest?.status??"missing",
   conclusion:latest?.conclusion??null};
 });
 if(gates.some(x=>x.status==="completed" && x.conclusion!=="success"))
  return {state:"GATES_FAILED",gates};
 if(gates.every(x=>x.status==="completed" && x.conclusion==="success"))
  return {state:"EXACT_HEAD_SOURCE_PG17_PASS",gates};
 return {state:"GATES_PENDING",gates};
}
async function githubGet(url,token){
 const response=await fetch(url,{
  method:"GET",redirect:"error",
  headers:{Accept:"application/vnd.github+json",
   Authorization:"Bearer "+token,"X-GitHub-Api-Version":"2022-11-28"},
  signal:AbortSignal.timeout(12000),
 });
 if(!response.ok)throw Error("GitHub read not available: "+response.status);
 const data=await response.json();
 if(!data || typeof data!=="object")throw Error("Invalid GitHub JSON");
 return data;
}
export async function checkExactHead(config,load=githubGet){
 const base="https://api.github.com/repos/"+config.repo;
 const branch=await load(base+"/git/ref/heads/"+
  encodeURIComponent(config.branch),config.token);
 if(branch?.object?.sha!==config.sha)
  return {state:"STALE_BRANCH_HEAD",gates:[]};
 const answer=await load(base+"/actions/runs?branch="+
  encodeURIComponent(config.branch)+"&per_page=100",config.token);
 return evaluateExactHeadRuns(answer?.workflow_runs,config.sha,config.branch);
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function watchExactHead(config,load=githubGet,sleep=delay,{
 attempts=60,intervalMs=12000,
}={}){
 for(let n=1;n<=attempts;n++){
  const result=await checkExactHead(config,load);
  if(result.state!=="GATES_PENDING")return {...result,attempt:n};
  if(n<attempts)await sleep(intervalMs);
 }
 return {state:"GATES_TIMEOUT",gates:[],attempt:attempts};
}
function outcomeMarkdown(result,sha){
 const lines=[
  "### V4 SONIC exact-head source CI guardian",
  "",
  "Commit: \`"+sha+"\`",
  "",
  "| Source gate | Run | Result |",
  "|---|---|---|",
 ];
 for(const gate of result.gates){
  lines.push("| "+gate.name+" | "+(gate.runId??"none")+
   " | "+gate.status+"/"+(gate.conclusion??"unverified")+" |");
 }
 lines.push("","**"+result.state+"** — not staging owner UAT, deployed provider verification, production or commercial AI authorization.","");
 return lines.join("\n");
}
async function main(){
 const config=validateGuardianConfig({
  repo:process.env.GITHUB_REPOSITORY,
  sha:process.env.GITHUB_SHA,
  branch:process.env.GITHUB_REF_NAME,
  token:process.env.GITHUB_TOKEN,
 });
 if(!config){
  process.stderr.write("V4 SONIC guardian configuration invalid or noncanonical.\n");
  process.exitCode=2;return;
 }
 let result;
 try{result=await watchExactHead(config);}
 catch{result={state:"GATES_UNAVAILABLE",gates:[]};}
 // The Actions summary only includes source check names/numbers and SHA.
 const body=outcomeMarkdown(result,config.sha);
 if(process.env.GITHUB_STEP_SUMMARY){
  const {appendFile}=await import("node:fs/promises");
  await appendFile(process.env.GITHUB_STEP_SUMMARY,body);
 }else process.stdout.write(body);
 if(result.state!=="EXACT_HEAD_SOURCE_PG17_PASS")process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 await main();
}
