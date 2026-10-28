import test from "node:test";
import assert from "node:assert/strict";
import { ORIGIN, runTwoOwnerReadOnlyAudit } from "../v4-p02-two-owner-readonly-acceptance.mjs";

const A="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const WA="11111111-1111-4111-8111-111111111111";
const WB="22222222-2222-4222-8222-222222222222";
const BA="33333333-3333-4333-8333-333333333333";
const BB="44444444-4444-4444-8444-444444444444";
const RA="55555555-5555-4555-8555-555555555555", RB="66666666-6666-4666-8666-666666666666";
function mockJwt(user){
 const payload={iss:ORIGIN+"/auth/v1",sub:user,role:"authenticated",
  exp:Math.floor(Date.now()/1000)+1800};
 return [Buffer.from(JSON.stringify({alg:"HS256",typ:"JWT"})).toString("base64url"),
  Buffer.from(JSON.stringify(payload)).toString("base64url"),"fake-not-a-signed-owner"].join(".");
}
const tokens=[mockJwt(A),mockJwt(B)];
const env={
 SD_P02_ACCEPTANCE_APPROVED:"READ_ONLY",
 SD_P02_PUBLISHABLE_KEY:"sb_publishable_local_only_no_real_credentials",
 SD_P02_OWNER_A_JWT:tokens[0],SD_P02_OWNER_B_JWT:tokens[1],
 SD_P02_OWNER_A_WORKSPACE_ID:WA,SD_P02_OWNER_B_WORKSPACE_ID:WB,
 SD_P02_OWNER_A_REQUEST_ID:RA,SD_P02_OWNER_B_REQUEST_ID:RB,
};
function harness(fault){
 const calls=[];
 const fetcher=async(input,options)=>{
  const url=new URL(input);
  assert.equal(url.origin,ORIGIN);
  assert.equal(options.redirect,"error");
  const me=options.headers.Authorization==="Bearer "+tokens[0]?0:1;
  const own=me===0?WA:WB,other=me===0?WB:WA;
  const ownBranch=me===0?BA:BB,otherBranch=me===0?BB:BA;
  assert.equal(options.headers.apikey,env.SD_P02_PUBLISHABLE_KEY);
  assert.equal(options.headers.Accept,"application/json");
  calls.push({method:options.method,path:url.pathname});
  let data;
  if(url.pathname==="/auth/v1/user"){
   assert.equal(options.method,"GET");
   assert.equal(options.body,undefined);
   data={id:me===0?A:B,email_confirmed_at:"2026-10-01T00:00:00Z",is_anonymous:false};
  }else if(url.pathname.endsWith("/rpc/servicedesk_default_branch")){
   assert.equal(options.method,"POST");
   const {target_workspace}=JSON.parse(options.body);
   assert.ok([own,other].includes(target_workspace));
   data=target_workspace===own?(fault==="wrong-rpc"?otherBranch:ownBranch):
    fault==="foreign-rpc-leak"?otherBranch:null;
  }else{
   assert.equal(options.method,"GET");
   const table=url.pathname.split("/").at(-1);
   assert.ok(["workspaces","memberships","requests","workspace_branches"].includes(table));
   const key=table==="workspaces"?"id":"workspace_id";
   const target=(url.searchParams.get(key)||"").replace(/^eq\./,"");
   assert.ok([own,other].includes(target));
   assert.equal(url.searchParams.get("limit"),"2");
   if(table==="memberships"){
    assert.equal(url.searchParams.get("user_id"),"eq."+(target===WA?A:B));
    assert.equal(url.searchParams.get("role"),"eq.OWNER");
    assert.equal(url.searchParams.get("status"),"eq.ACTIVE");
   }
   if(table==="workspace_branches"){
    assert.equal(url.searchParams.get("is_default"),"eq.true");
    assert.equal(url.searchParams.get("active"),"eq.true");
   }
   const exists=target===own ||
    (fault==="foreign-default-visible"&&target===other&&table==="workspace_branches") ||
    (fault==="foreign-membership-visible"&&target===other&&table==="memberships");
   if(!exists)data=[];
   else if(table==="requests"){
    assert.equal(url.searchParams.get("id"),"eq."+(target===WA?RA:RB));
    data=fault==="request-missing"?[]:[{id:target===WA?RA:RB,workspace_id:target}];
   }
   else if(table==="workspaces")
    data=[{id:fault==="foreign-workspace-identity"?other:target}];
   else if(table==="memberships"){
    const row={workspace_id:target,user_id:target===WA?A:B,role:"OWNER",status:"ACTIVE"};
    if(fault==="staff-instead-of-owner")row.role="DISPATCHER";
    if(fault==="revoked-owner")row.status="INACTIVE";
    if(fault==="different-user")row.user_id=me===0?B:A;
    data=fault==="duplicate-owner"?[row,row]:[row];
   }else if(table==="workspace_branches"){
    const row={id:target===WA?BA:BB,workspace_id:target,is_default:true,active:true};
    if(fault==="foreign-branch-identity")row.workspace_id=other;
    if(fault==="inactive-branch")row.active=false;
    data=fault==="duplicate-default"?[row,row]:[row];
   }
  }
  return new Response(JSON.stringify(data),{
   status:200,headers:{"content-type":"application/json"},
  });
 };
 return {fetcher,calls};
}
test("requires two scoped active owners, a saved default branch, and separately equal RPC result",async()=>{
 const h=harness();
 const result=await runTwoOwnerReadOnlyAudit(env,h.fetcher);
 assert.equal(result.result,"PASS");
 assert.equal(result.noWrites,true);
 assert.equal(result.checks.length,2);
 assert.equal(h.calls.length,28);
 assert.equal(h.calls.filter(x=>x.method==="POST").length,4);
 assert.equal(h.calls.filter(x=>x.method==="GET").length,24);
 assert.deepEqual(new Set(h.calls.map(x=>x.method)),new Set(["POST","GET"]));
});
for(const [fault,expected] of [
 ["request-missing","EXPECTED_OWNER_REQUEST_FIXTURE_MISSING"],
 ["staff-instead-of-owner","OWNER_ACTIVE_MEMBERSHIP_UNVERIFIED"],
 ["revoked-owner","OWNER_ACTIVE_MEMBERSHIP_UNVERIFIED"],
 ["different-user","OWNER_ACTIVE_MEMBERSHIP_UNVERIFIED"],
 ["duplicate-owner","EXPECTED_OWNER_ACCESS_MISSING_MEMBERSHIPS"],
 ["foreign-workspace-identity","DATABASE_ROW_SCOPE_UNVERIFIED"],
 ["foreign-branch-identity","DEFAULT_BRANCH_SAVED_SCOPE_UNVERIFIED"],
 ["inactive-branch","DEFAULT_BRANCH_SAVED_SCOPE_UNVERIFIED"],
 ["duplicate-default","DEFAULT_BRANCH_OWN_ROW_NOT_UNAMBIGUOUS"],
 ["foreign-default-visible","FOREIGN_TENANT_DATA_EXPOSED_WORKSPACE_BRANCHES"],
 ["foreign-membership-visible","FOREIGN_TENANT_DATA_EXPOSED_MEMBERSHIPS"],
 ["wrong-rpc","DEFAULT_BRANCH_OWN_RPC_NOT_VERIFIED"],
 ["foreign-rpc-leak","FOREIGN_DEFAULT_BRANCH_DISCLOSURE"],
]){
 test("fails closed rather than reporting two-owner acceptance: "+fault,async()=>{
  const h=harness(fault);
  await assert.rejects(runTwoOwnerReadOnlyAudit(env,h.fetcher),
   new RegExp(expected));
  assert.ok(h.calls.every(x=>["POST","GET"].includes(x.method)));
 });
}
