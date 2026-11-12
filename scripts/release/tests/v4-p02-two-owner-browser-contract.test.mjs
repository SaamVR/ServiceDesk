import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  PROJECT_ORIGIN, LOCAL_ORIGIN, VERIFIED_STATUS, DENIED_STATUS,
  assertBrowserReadback, hasForeignReadyDisclosure,
  validateTwoOwnerBrowserConfig
} from "../v4-p02-two-owner-browser-contract.mjs";

const SHA="a".repeat(40);
const base={
  SD_P02_BROWSER_APPROVAL:"TWO_OWNER_READ_ONLY",
  SD_P02_BROWSER_APPROVED_SHA:SHA,GITHUB_SHA:SHA,
  NEXT_PUBLIC_SUPABASE_URL:PROJECT_ORIGIN,
  V4_AUTH_TEST_ORIGIN:LOCAL_ORIGIN,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_synthetic_offline_fixture",
  V4_P02_BROWSER_CHROME:"/fictional/chrome",
  V4_P02_BROWSER_OUTPUT:"/tmp/private-synthetic",
  V4_P02_OWNER_A_EMAIL:"fictional-a@example.invalid",
  V4_P02_OWNER_A_PASSWORD:"local-synthetic-a",
  V4_P02_OWNER_A_WORKSPACE:"fictional-a",
  V4_P02_OWNER_B_EMAIL:"fictional-b@example.invalid",
  V4_P02_OWNER_B_PASSWORD:"local-synthetic-b",
  V4_P02_OWNER_B_WORKSPACE:"fictional-b",
};
function config(change){return {...base,...change};}
function own(slug){
  return {path:"/onboarding/verified",queryWorkspace:slug,
    heading:"Your business workspace is ready.",
    readyStatus:VERIFIED_STATUS,savedWorkspaceSlug:slug,
    verifiedDetails:true,denialAlert:"",signInEntry:false,
    qaMutationControl:false,nextErrorOverlay:false};
}
function foreign(slug){
  return {path:"/onboarding/verified",queryWorkspace:slug,
    heading:"We could not verify this workspace",
    denialAlert:DENIED_STATUS,readyStatus:"",savedWorkspaceSlug:"",
    verifiedDetails:false,signInEntry:false,
    qaMutationControl:false,nextErrorOverlay:false};
}
test("requires distinct privately configured fictional owners, exact approved SHA and pinned project",()=>{
 const got=validateTwoOwnerBrowserConfig(config());
 assert.deepEqual(got.map(x=>x.tag),["A","B"]);
 assert.deepEqual(got.map(x=>x.slug),["fictional-a","fictional-b"]);
});
for(const [label,delta,reason] of [
 ["missing approval",{SD_P02_BROWSER_APPROVAL:""},/NO_EXPLICIT/],
 ["wrong SHA",{SD_P02_BROWSER_APPROVED_SHA:"b".repeat(40)},/EXACT_SHA/],
 ["missing SHA",{GITHUB_SHA:""},/EXACT_SHA/],
 ["different project",{NEXT_PUBLIC_SUPABASE_URL:"https://other.supabase.co"},/TARGET_SCOPE/],
 ["remote origin",{V4_AUTH_TEST_ORIGIN:"https://preview.example.com"},/TARGET_SCOPE/],
 ["invalid key",{NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"service_role"},/NONPRIVILEGED/],
 ["privileged role",{SUPABASE_SERVICE_ROLE_KEY:"synthetic-forbidden"},/NONPRIVILEGED/],
 ["missing Chrome",{V4_P02_BROWSER_CHROME:""},/PRIVATE_BROWSER/],
 ["same email",{V4_P02_OWNER_B_EMAIL:base.V4_P02_OWNER_A_EMAIL.toUpperCase()},/MUST_DIFFER/],
 ["same workspace",{V4_P02_OWNER_B_WORKSPACE:"fictional-a"},/MUST_DIFFER/],
 ["wrong slug",{V4_P02_OWNER_A_WORKSPACE:"../foreign"},/OWNER_A_CONFIG/],
 ["empty password",{V4_P02_OWNER_A_PASSWORD:""},/OWNER_A_CONFIG/],
 ["newline password",{V4_P02_OWNER_A_PASSWORD:"password\nleak"},/OWNER_A_CONFIG/],
 ["invalid email",{V4_P02_OWNER_B_EMAIL:"bad"},/OWNER_B_CONFIG/],
]) test("fails closed on "+label,()=>assert.throws(
 ()=>validateTwoOwnerBrowserConfig(config(delta)),reason));
test("accepts both independently positive saved branch readbacks",()=>{
 assert.equal(assertBrowserReadback(own("fictional-a"),"fictional-a","fictional-a","OWN"),true);
 assert.equal(assertBrowserReadback(own("fictional-b"),"fictional-b","fictional-b","OWN"),true);
});
test("accepts both foreign tenant browser denials",()=>{
 assert.equal(assertBrowserReadback(foreign("fictional-b"),"fictional-a","fictional-b","FOREIGN_DENIED"),true);
 assert.equal(assertBrowserReadback(foreign("fictional-a"),"fictional-b","fictional-a","FOREIGN_DENIED"),true);
});
for(const [label,mutation,phase,expected,request] of [
 ["own heading forged",{heading:"Welcome"},"OWN","fictional-a","fictional-a"],
 ["own branch status absent",{readyStatus:""},"OWN","fictional-a","fictional-a"],
 ["own wrong saved slug",{savedWorkspaceSlug:"fictional-b"},"OWN","fictional-a","fictional-a"],
 ["own no DB detail",{verifiedDetails:false},"OWN","fictional-a","fictional-a"],
 ["own QA mutator visible",{qaMutationControl:true},"OWN","fictional-a","fictional-a"],
 ["wrong route",{path:"/auth/sign-in"},"OWN","fictional-a","fictional-a"],
 ["foreign falsely ready",{heading:"Your business workspace is ready.",denialAlert:""},"FOREIGN_DENIED","fictional-a","fictional-b"],
 ["foreign leaked details",{verifiedDetails:true},"FOREIGN_DENIED","fictional-a","fictional-b"],
 ["foreign leaked saved slug",{savedWorkspaceSlug:"fictional-b"},"FOREIGN_DENIED","fictional-a","fictional-b"],
 ["foreign QA write visible",{qaMutationControl:true},"FOREIGN_DENIED","fictional-a","fictional-b"],
 ["foreign wrong origin label",{queryWorkspace:"fictional-a"},"FOREIGN_DENIED","fictional-a","fictional-b"],
 ["foreign sign in visible",{signInEntry:true},"FOREIGN_DENIED","fictional-a","fictional-b"],
 ["foreign next overlay",{nextErrorOverlay:true},"FOREIGN_DENIED","fictional-a","fictional-b"],
])test("rejects "+label,()=>{
 const input={...(phase==="OWN"?own(request):foreign(request)),...mutation};
 assert.throws(()=>assertBrowserReadback(input,expected,request,phase),/P02_BROWSER_BLOCKED_/);
});
test("unsupported phase and missing browser state fail closed",()=>{
 assert.throws(()=>assertBrowserReadback(own("fictional-a"),"fictional-a","fictional-a","SKIP"),/UNKNOWN_PHASE/);
 assert.throws(()=>assertBrowserReadback(null,"fictional-a","fictional-a","OWN"),/UNVERIFIED_BROWSER_ROUTE/);
});

test("fully rendered foreign owner-readiness disclosure is terminal for either owner",()=>{
 assert.equal(hasForeignReadyDisclosure(
   own("fictional-b"),"fictional-a","fictional-b"),true);
 assert.equal(hasForeignReadyDisclosure(
   own("fictional-a"),"fictional-b","fictional-a"),true);
});
for(const [name,view,owner,foreign] of [
 ["valid foreign denial",foreign("fictional-b"),"fictional-a","fictional-b"],
 ["stale own DOM while foreign route loads",{
   ...own("fictional-a"),queryWorkspace:"fictional-b"
 },"fictional-a","fictional-b"],
 ["incomplete foreign branch data",{
   ...own("fictional-b"),savedWorkspaceSlug:""
 },"fictional-a","fictional-b"],
 ["missing foreign readiness proof",{
   ...own("fictional-b"),readyStatus:""
 },"fictional-a","fictional-b"],
 ["missing foreign saved detail",{
   ...own("fictional-b"),verifiedDetails:false
 },"fictional-a","fictional-b"],
 ["exact owner same as requested",own("fictional-a"),"fictional-a","fictional-a"],
]) test("fast-fail critic waits rather than declaring false disclosure for "+name,()=>{
 assert.equal(hasForeignReadyDisclosure(view,owner,foreign),false);
});
test("runner invokes fast-fail outside its transient readback retry catch",()=>{
 const code=readFileSync("scripts/release/v4-p02-two-owner-browser-journey.mjs","utf8");
 const hard=code.indexOf("hasForeignReadyDisclosure(snapshot,ownSlug,requested)");
 const soft=code.indexOf("try{assertBrowserReadback(snapshot,ownSlug,requested,phase)");
 assert.ok(hard>0 && soft>hard);
 assert.match(code,/P02_BROWSER_FOREIGN_READINESS_EXPOSED/);
});

test("manual workflow cannot run credential-bearing browser job from a branch push",()=>{
 const yaml=readFileSync(".github/workflows/sonic-p02-two-owner-browser-acceptance.yml","utf8");
 const protectedPart=yaml.split("  two-owner-authenticated-browser:")[1];
 assert.ok(protectedPart);
 assert.match(protectedPart,/github\.event_name == 'workflow_dispatch'/);
 assert.match(protectedPart,/vars\.SERVICEDESK_P02_TWO_OWNER_BROWSER_APPROVED == 'true'/);
 assert.match(protectedPart,/vars\.SERVICEDESK_P02_TWO_OWNER_BROWSER_SHA == github\.sha/);
 assert.match(protectedPart,/test "\$\(git rev-parse HEAD\)" = "\$APPROVED_SHA"/);
 assert.ok(protectedPart.indexOf('APPROVED_SHA:')<
   protectedPart.indexOf('SERVICEDESK_QA_OWNER_A_PASSWORD:'));
 assert.ok(!/vercel deploy|supabase db push|supabase auth admin/i.test(yaml));
 assert.ok(!/github\.event_name == 'push'/.test(protectedPart));
 assert.match(protectedPart,/node scripts\/release\/v4-private-rls-proof\.mjs/);
 assert.match(protectedPart,/node scripts\/release\/v4-p02-two-owner-browser-journey\.mjs/);
 const pushPart=yaml.split("  browser-source-contract:")[1]?.split("  two-owner-authenticated-browser:")[0];
 assert.ok(pushPart&&!/secrets\./.test(pushPart));
});
