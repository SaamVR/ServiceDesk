#!/usr/bin/env node
/**
 * V4 release guardian: explicit-permission, anonymous, read-only staging probe.
 *
 * This is NOT a merchant UAT, authenticated owner proof, trusted Render deployment
 * receipt, provider response or permission to activate feature flags/migrations.
 *
 * The operator must independently authorize and supply each of:
 *   V4_STAGING_READONLY_PERMISSION=APPROVED_STAGING_ONLY
 *   V4_STAGING_ORIGIN=https://dedicated-qa.example.test
 *   V4_STAGING_ALLOWED_HOST=dedicated-qa.example.test
 *   V4_STAGING_EXPECTED_SHA=<exact 40 hex integrated deployment sha>
 *   V4_STAGING_OWNER_A_SLUG=<nonproduction authorized workspace slug>
 *   V4_STAGING_OWNER_B_SLUG=<different nonproduction workspace slug>
 *
 * Run: node scripts/release/v4-staging-readonly-preflight.mjs
 * No credentials, cookies, POST, SQL, provider calls, body echoes or redirects.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const shaPattern=/^[a-f0-9]{40}$/i;
const slugPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const hostPattern=/^[a-z0-9](?:[a-z0-9.-]{1,251}[a-z0-9])$/;
const blockedSuffixes=[".local",".localhost",".internal",".home",".lan",".test.local"];
const probeNames=[
 "first-deployment-identity","sign-in-controls","owner-a-anonymous-boundary",
 "owner-b-anonymous-boundary","source-worker-get-disabled",
 "final-deployment-identity",
];

export function validateV4StagingConfig(raw){
 if(!raw || raw.permission!=="APPROVED_STAGING_ONLY" ||
    typeof raw.expectedSha!=="string" || !shaPattern.test(raw.expectedSha) ||
    typeof raw.allowedHost!=="string" || !hostPattern.test(raw.allowedHost) ||
    !raw.allowedHost.includes(".") ||
    blockedSuffixes.some(s=>raw.allowedHost.endsWith(s)) ||
    raw.allowedHost==="localhost" || raw.allowedHost.endsWith(".localhost") ||
    /^(?:\d{1,3}\.){3}\d{1,3}$/.test(raw.allowedHost) ||
    typeof raw.ownerA!=="string" || typeof raw.ownerB!=="string" ||
    !slugPattern.test(raw.ownerA) || !slugPattern.test(raw.ownerB) ||
    raw.ownerA.length>40 || raw.ownerB.length>40 ||
    raw.ownerA===raw.ownerB) return null;
 try{
  const url=new URL(raw.origin);
  if(url.protocol!=="https:" || url.hostname!==raw.allowedHost ||
     url.username || url.password || url.port ||
     url.pathname!=="/" || url.search || url.hash ||
     url.origin!==`https://${raw.allowedHost}`) return null;
  return Object.freeze({
   origin:url.origin,sha:raw.expectedSha.toLowerCase(),
   ownerA:raw.ownerA,ownerB:raw.ownerB,
  });
 }catch{return null;}
}

const check=(name,state,status)=>({name,state,httpStatus:status});

export function checkBuildIdentity(response,expectedSha,name){
 const obj=response?.json;
 if(response?.status!==200) return check(name,"HTTP_FAILURE",response?.status??null);
 if(!obj || typeof obj!=="object" || Array.isArray(obj) ||
    obj.ok!==true || obj.service!=="servicedesk" || obj.status!=="live" ||
    !shaPattern.test(obj.sourceSha??"") ||
    !["render","vercel","both"].includes(obj.sourceProvider))
  return check(name,"UNVERIFIED_HOST_IDENTITY",200);
 return check(name,
    obj.sourceSha.toLowerCase()===expectedSha
      ? "HOST_REPORTED_COMMIT_MATCH" : "HOST_COMMIT_MISMATCH",200);
}
export function checkSignin(response){
 // This is a public form rendering check only; no password submitted.
 const body=response?.body??"";
 return check("sign-in-controls",
  response?.status===200 &&
    /name=["']email["']/i.test(body) &&
    /name=["']password["']/i.test(body)
    ? "PUBLIC_CONTROLS_PRESENT" : "FAIL",response?.status??null);
}
export function checkAnonymous(response,name){
 // Never count 403, 404, 302, 200, 503 as successful auth enforcement.
 return check(name,response?.status===401 ? "ANONYMOUS_DENIED" : "FAIL",
  response?.status??null);
}
export function checkWorkerGet(response){
 // GET cannot claim/process a source event. Unlike a 404, explicit 405
 // establishes that the POST-only worker route is mounted.
 return check("source-worker-get-disabled",
  response?.status===405 ? "GET_METHOD_DENIED" : "FAIL",
  response?.status??null);
}

async function guardedGet(url,{accept}){
 const response=await fetch(url,{
  method:"GET",redirect:"manual",credentials:"omit",referrerPolicy:"no-referrer",
  headers:{Accept:accept,"Cache-Control":"no-store"},
  signal:AbortSignal.timeout(10_000),
 });
 const sizeHeader=Number(response.headers.get("content-length"));
 if(Number.isFinite(sizeHeader)&&sizeHeader>32768)
  throw new Error("oversize response");
 const body=await response.text();
 if(body.length>32768)throw new Error("oversize response");
 const type=response.headers.get("content-type")??"";
 let json;
 if(type.includes("application/json")){
  try{json=JSON.parse(body);}catch{json=null;}
 }
 return {status:response.status,body,json};
}
export async function runV4StagingReadonlyPreflight(config,get=guardedGet){
 const checks=[];
 const targets=[
  ["/health","application/json"],
  ["/auth/sign-in","text/html"],
  ["/api/internal/inbox/delivery?workspaceSlug="+encodeURIComponent(config.ownerA),"application/json"],
  ["/api/internal/inbox/delivery?workspaceSlug="+encodeURIComponent(config.ownerB),"application/json"],
  ["/api/internal/workflows/quote-source","application/json"],
  ["/health","application/json"],
 ];
 for(let i=0;i<targets.length;i++){
  const [path,accept]=targets[i];
  try{
   const response=await get(config.origin+path,{accept});
   const outcome=i===0 || i===5
     ?checkBuildIdentity(response,config.sha,probeNames[i])
     :i===1?checkSignin(response)
     :i===4?checkWorkerGet(response)
     :checkAnonymous(response,probeNames[i]);
   checks.push(outcome);
  }catch{
   checks.push(check(probeNames[i],"NETWORK_OR_UNTRUSTED_RESPONSE",null));
  }
 }
 const expected=[
  "HOST_REPORTED_COMMIT_MATCH","PUBLIC_CONTROLS_PRESENT","ANONYMOUS_DENIED",
  "ANONYMOUS_DENIED","GET_METHOD_DENIED","HOST_REPORTED_COMMIT_MATCH",
 ];
 return {
  state:checks.every((v,i)=>v.state===expected[i])
   ? "READONLY_ANONYMOUS_PREFLIGHT_PASS" : "READONLY_PREFLIGHT_BLOCKED",
  checks,
  independentlyVerifiedDeployment:false,
  authenticatedOwnerUat:false,
  twoOwnerCrossTenantUat:false,
  quoteToInvoiceUat:false,
  databaseMigrationsApplied:false,
  paidProviderVerified:false,
  customerMessageSent:false,
  sourceWorkerExecuted:false,
 };
}
async function main(){
 const config=validateV4StagingConfig({
  permission:process.env.V4_STAGING_READONLY_PERMISSION,
  origin:process.env.V4_STAGING_ORIGIN,
  allowedHost:process.env.V4_STAGING_ALLOWED_HOST,
  expectedSha:process.env.V4_STAGING_EXPECTED_SHA,
  ownerA:process.env.V4_STAGING_OWNER_A_SLUG,
  ownerB:process.env.V4_STAGING_OWNER_B_SLUG,
 });
 if(!config){
  process.stderr.write(JSON.stringify({
   state:"READONLY_PREFLIGHT_BLOCKED",
   reason:"Explicit approved nonproduction HTTPS host, exact SHA and two distinct QA workspace slugs required",
  })+"\n");
  process.exitCode=2;return;
 }
 const result=await runV4StagingReadonlyPreflight(config);
 // Never print hostnames, workspace slugs, response bodies, user data or secrets.
 process.stdout.write(JSON.stringify(result,null,2)+"\n");
 if(result.state!=="READONLY_ANONYMOUS_PREFLIGHT_PASS")process.exitCode=1;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 await main();
}
