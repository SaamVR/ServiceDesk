import {test} from "node:test";
import assert from "node:assert/strict";
import {
 validateV4StagingConfig,checkBuildIdentity,checkSignin,
 checkAnonymous,checkWorkerGet,runV4StagingReadonlyPreflight,
} from "./v4-staging-readonly-preflight.mjs";

const sha="a".repeat(40);
const options={
 permission:"APPROVED_STAGING_ONLY",origin:"https://v4-qa.example.test/",
 allowedHost:"v4-qa.example.test",expectedSha:sha,
 ownerA:"fictional-owner-a",ownerB:"fictional-owner-b",
};
const verified={
 status:200,json:{ok:true,service:"servicedesk",status:"live",
  sourceSha:sha,sourceProvider:"render"},
};
const login={status:200,body:
 '<form><input name="email" type="email"><input name="password" type="password"></form>'};
const goodGet=async url=>{
 const parsed=new URL(url);
 if(parsed.pathname==="/health")return verified;
 if(parsed.pathname==="/auth/sign-in")return login;
 if(parsed.pathname==="/api/internal/inbox/delivery")return {status:401};
 if(parsed.pathname==="/api/internal/workflows/quote-source")return {status:405};
 throw Error("unexpected endpoint");
};

test("requires explicit operator permission, exact SHA, two DIFFERENT approved QA workspaces and HTTPS host",()=>{
 const c=validateV4StagingConfig(options);
 assert.deepEqual(c,{origin:"https://v4-qa.example.test",sha,
  ownerA:"fictional-owner-a",ownerB:"fictional-owner-b"});
 assert.equal(Object.isFrozen(c),true);
 for(const change of [
  {permission:""}, {permission:"1"},
  {origin:"http://v4-qa.example.test/"},
  {origin:"https://user:pass@v4-qa.example.test/"},
  {origin:"https://v4-qa.example.test/private"},
  {origin:"https://v4-qa.example.test/?token=private"},
  {origin:"https://v4-qa.example.test/#secret"},
  {origin:"https://production.example.test/"},
  {origin:"https://127.0.0.1/",allowedHost:"127.0.0.1"},
  {origin:"https://server.local/",allowedHost:"server.local"},
  {origin:"https://localhost/",allowedHost:"localhost"},
  {ownerA:"../../other"}, {ownerB:"fictional-owner-a"},
  {ownerB:"x".repeat(41)}, {expectedSha:"bad"},
 ]){
  assert.equal(validateV4StagingConfig({...options,...change}),null,
   JSON.stringify(change));
 }
});

test("untrusted host-report claims and anonymous 200/redirects never prove readiness",()=>{
 assert.equal(checkBuildIdentity(verified,sha,"host").state,"HOST_REPORTED_COMMIT_MATCH");
 assert.equal(checkBuildIdentity({...verified,json:{...verified.json,sourceSha:"b".repeat(40)}},sha,"host").state,"HOST_COMMIT_MISMATCH");
 assert.equal(checkBuildIdentity({...verified,json:{...verified.json,sourceSha:undefined}},sha,"host").state,"UNVERIFIED_HOST_IDENTITY");
 assert.equal(checkBuildIdentity({...verified,status:503},sha,"host").state,"HTTP_FAILURE");
 assert.equal(checkSignin(login).state,"PUBLIC_CONTROLS_PRESENT");
 assert.equal(checkSignin({status:200,body:"Sign in"}).state,"FAIL");
 for(const state of [200,302,403,404,405,500,503]){
  assert.equal(checkAnonymous({status:state},"tenant-a").state,"FAIL");
  assert.equal(checkWorkerGet({status:state}).state,state===405?"GET_METHOD_DENIED":"FAIL");
 }
 assert.equal(checkAnonymous({status:401},"tenant-a").state,"ANONYMOUS_DENIED");
});

test("six exact anonymous GET probes with no workspace/host/body in output",async()=>{
 const config=validateV4StagingConfig(options),visited=[];
 const result=await runV4StagingReadonlyPreflight(config,async(url,options)=>{
  visited.push({url,options});return goodGet(url);
 });
 assert.equal(result.state,"READONLY_ANONYMOUS_PREFLIGHT_PASS");
 assert.deepEqual(result.checks.map(x=>x.state),[
  "HOST_REPORTED_COMMIT_MATCH","PUBLIC_CONTROLS_PRESENT","ANONYMOUS_DENIED",
  "ANONYMOUS_DENIED","GET_METHOD_DENIED","HOST_REPORTED_COMMIT_MATCH",
 ]);
 assert.deepEqual(visited.map(v=>new URL(v.url).pathname),[
  "/health","/auth/sign-in",
  "/api/internal/inbox/delivery","/api/internal/inbox/delivery",
  "/api/internal/workflows/quote-source","/health",
 ]);
 assert.deepEqual(visited.slice(2,4).map(v=>new URL(v.url).searchParams.get("workspaceSlug")),
  ["fictional-owner-a","fictional-owner-b"]);
 for(const item of visited)assert.equal("method" in item.options,false);
 for(const key of [
  "independentlyVerifiedDeployment","authenticatedOwnerUat","twoOwnerCrossTenantUat",
  "quoteToInvoiceUat","databaseMigrationsApplied","paidProviderVerified",
  "customerMessageSent","sourceWorkerExecuted",
 ])assert.equal(result[key],false);
 for(const privateText of [config.origin,config.ownerA,config.ownerB,"customer@example.test"]){
   assert.equal(JSON.stringify(result).includes(privateText),false);
 }
});

test("a late deployment SHA change vetoes the entire report even if earlier gates pass",async()=>{
 const config=validateV4StagingConfig(options);
 let count=0;
 const report=await runV4StagingReadonlyPreflight(config,async url=>{
  if(url.endsWith("/health") && ++count===2)
   return {...verified,json:{...verified.json,sourceSha:"b".repeat(40)}};
  return goodGet(url);
 });
 assert.equal(report.state,"READONLY_PREFLIGHT_BLOCKED");
 assert.equal(report.checks[5].state,"HOST_COMMIT_MISMATCH");
});

test("failure, redirect and network exception never promote anonymous or worker access",async()=>{
 const config=validateV4StagingConfig(options);
 const unauthorized=await runV4StagingReadonlyPreflight(config,async url=>{
  if(url.includes("/api/internal/inbox/delivery"))return {status:200,body:"sensitive"};
  if(url.includes("/api/internal/workflows/quote-source"))return {status:404};
  return goodGet(url);
 });
 assert.equal(unauthorized.state,"READONLY_PREFLIGHT_BLOCKED");
 assert.deepEqual(unauthorized.checks.slice(2,5).map(x=>x.state),["FAIL","FAIL","FAIL"]);
 const outage=await runV4StagingReadonlyPreflight(config,async()=>{throw Error("URL and private token");});
 assert.equal(outage.state,"READONLY_PREFLIGHT_BLOCKED");
 assert.equal(outage.checks.length,6);
 assert.ok(outage.checks.every(x=>x.state==="NETWORK_OR_UNTRUSTED_RESPONSE"));
 assert.equal(JSON.stringify(outage).includes("private token"),false);
});
