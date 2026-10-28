import test from "node:test";
import assert from "node:assert/strict";
import {ORIGIN,runTwoOwnerReadOnlyAudit}
 from "../v4-p02-two-owner-readonly-acceptance.mjs";

const a="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const b="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const wA="11111111-1111-4111-8111-111111111111";
const wB="22222222-2222-4222-8222-222222222222";
const brA="33333333-3333-4333-8333-333333333333";
const brB="44444444-4444-4444-8444-444444444444";
const brChanged="77777777-7777-4777-8777-777777777777";
const reqA="55555555-5555-4555-8555-555555555555", reqB="66666666-6666-4666-8666-666666666666";
function token(sub){
 const payload={sub,iss:ORIGIN+"/auth/v1",role:"authenticated",aud:"authenticated",
  exp:Math.floor(Date.now()/1000)+1800};
 return [Buffer.from(JSON.stringify({typ:"JWT",alg:"HS256"})).toString("base64url"),
  Buffer.from(JSON.stringify(payload)).toString("base64url"),
  "offline-fake-jwt-not-a-real-session"].join(".");
}
function environment(){
 const tokenA=token(a),tokenB=token(b);
 return {SD_P02_ACCEPTANCE_APPROVED:"READ_ONLY",
  SD_P02_PUBLISHABLE_KEY:"sb_publishable_fictional_offline_only",
  SD_P02_OWNER_A_JWT:tokenA,SD_P02_OWNER_B_JWT:tokenB,
  SD_P02_OWNER_A_WORKSPACE_ID:wA,SD_P02_OWNER_B_WORKSPACE_ID:wB,
  SD_P02_OWNER_A_REQUEST_ID:reqA,SD_P02_OWNER_B_REQUEST_ID:reqB};
}
function harness(env,{fault,afterFinalBranch}={}){
 const calls=[],seen=new Map();
 let secondOwnerStarted=false;
 const fetcher=async(raw,opts)=>{
  const url=new URL(raw);assert.equal(url.origin,ORIGIN);
  assert.equal(opts.redirect,"error");
  const auth=opts.headers.Authorization;
  assert.ok(["Bearer "+env.SD_P02_OWNER_A_JWT,
   "Bearer "+env.SD_P02_OWNER_B_JWT].includes(auth));
  const owner=auth==="Bearer "+env.SD_P02_OWNER_A_JWT?"A":"B";
  if(owner==="B")secondOwnerStarted=true;
  const own=owner==="A"?wA:wB,other=owner==="A"?wB:wA;
  const originalBranch=owner==="A"?brA:brB;
  calls.push({owner,method:opts.method,path:url.pathname});
  let data;
  if(url.pathname==="/auth/v1/user"){
   assert.equal(opts.method,"GET");
   assert.equal(opts.body,undefined);
   data={id:owner==="A"?a:b,email_confirmed_at:"2026-10-01T00:00:00Z",role:"authenticated",aud:"authenticated",is_anonymous:false};
  }else if(url.pathname.endsWith("/rpc/servicedesk_default_branch")){
   assert.equal(opts.method,"POST");
   const {target_workspace}=JSON.parse(opts.body);
   data=target_workspace===own?originalBranch:null;
  }else{
   assert.equal(opts.method,"GET");
   assert.equal(opts.body,undefined);
   const table=url.pathname.split("/").at(-1);
   assert.ok(["workspaces","memberships","requests","workspace_branches"].includes(table));
   const scope=(url.searchParams.get(table==="workspaces"?"id":"workspace_id")??"").slice(3);
   assert.ok(scope===own||scope===other);
   const key=owner+"|"+table+"|"+scope;
   seen.set(key,(seen.get(key)??0)+1);
   const count=seen.get(key);
   if(scope!==own)data=[];
   else if(table==="requests"){
    assert.equal(url.searchParams.get("id"),"eq."+(own===wA?reqA:reqB));
    data=[{id:own===wA?reqA:reqB,workspace_id:own}];
   }
   else if(table==="workspaces")data=[{id:scope}];
   else if(table==="memberships"){
    if(owner==="A"&&count>1&&
      (fault==="membership-revoked"||
       fault==="membership-revoked-during-B"&&secondOwnerStarted))data=[];
    else data=[{workspace_id:own,user_id:owner==="A"?a:b,
     role:owner==="A"&&count>1&&fault==="membership-demoted"?"DISPATCHER":"OWNER",
     status:"ACTIVE"}];
   }else {
    if(owner==="A"&&count>1&&fault==="default-removed")data=[];
    else data=[{id:owner==="A"&&count>1&&(fault==="branch-changed"||
      fault==="branch-changed-during-B"&&secondOwnerStarted)?
     brChanged:originalBranch,workspace_id:own,is_default:true,active:true}];
    if(owner==="A"&&count>1&&afterFinalBranch)afterFinalBranch();
   }
  }
  return new Response(JSON.stringify(data),{status:200,
   headers:{"content-type":"application/json"}});
 };
 return {fetcher,calls,seen};
}
test("rechecks active owner membership and current default branch after the other probes",async()=>{
 const env=environment(),h=harness(env);
 const output=await runTwoOwnerReadOnlyAudit(env,h.fetcher);
 assert.deepEqual(output.checks.map(x=>x.owner),["A","B"]);
 assert.equal(output.result,"PASS");
 assert.equal(output.noWrites,true);
 assert.equal(h.calls.length,28);
 assert.equal(h.calls.filter(x=>x.method==="POST").length,4);
 assert.equal(h.calls.filter(x=>x.method==="GET").length,24);
 for(const tag of ["A","B"]){
  const scope=tag==="A"?wA:wB;
  assert.equal(h.seen.get(tag+"|memberships|"+scope),2);
  assert.equal(h.seen.get(tag+"|workspace_branches|"+scope),2);
 }
 assert.ok(!JSON.stringify(output).includes(env.SD_P02_OWNER_A_JWT));
 assert.ok(!JSON.stringify(output).includes(env.SD_P02_PUBLISHABLE_KEY));
});
for(const [fault,message] of [
 ["membership-revoked","OWNER_AUTHORITY_CHANGED_DURING_AUDIT"],
 ["membership-demoted","OWNER_ACTIVE_MEMBERSHIP_UNVERIFIED"],
 ["membership-revoked-during-B","OWNER_AUTHORITY_CHANGED_DURING_AUDIT"],
 ["branch-changed-during-B","OWNER_AUTHORITY_CHANGED_DURING_AUDIT"],
 ["default-removed","OWNER_AUTHORITY_CHANGED_DURING_AUDIT"],
 ["branch-changed","OWNER_AUTHORITY_CHANGED_DURING_AUDIT"],
]){
 test("fails closed if owner authority changes after first reads: "+fault,async()=>{
  const env=environment(),h=harness(env,{fault});
  await assert.rejects(runTwoOwnerReadOnlyAudit(env,h.fetcher),new RegExp(message));
  assert.ok(h.calls.every(x=>x.method==="GET"||x.method==="POST"&&
   x.path.endsWith("/rpc/servicedesk_default_branch")));
 });
}
test("does not report PASS when a JWT expires mid-audit",async()=>{
 const realNow=Date.now,anchor=realNow();
 Date.now=()=>anchor;
 try {
  const env=environment();
  const h=harness(env,{afterFinalBranch:()=>{Date.now=()=>anchor+3600_000;}});
  await assert.rejects(runTwoOwnerReadOnlyAudit(env,h.fetcher),
   /OWNER_SESSION_EXPIRED_DURING_AUDIT/);
  assert.ok(h.calls.every(x=>x.method==="GET"||x.method==="POST"));
 } finally {Date.now=realNow;}
});
