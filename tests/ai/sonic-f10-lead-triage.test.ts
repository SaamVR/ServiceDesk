import {describe,expect,it} from "vitest";
import {reviewSonicF10LeadPolicy} from "../../src/server/ai/sonic-f10-lead-triage";
const base={workspaceId:"tenant_a",branchId:"branch_a",sourceId:"lead_01",sourceVersion:2};
const spam={kind:"SPAM_LEAD_REVIEW",status:"OPEN",riskScore:88,
 signal:"PERSISTED_ABUSE_RULE_SIGNAL",signalAt:"2026-10-25T10:00:00Z"};
const route={kind:"PROPERTY_BRANCH_ROUTING",status:"PENDING_ROUTE",
 propertyZoneCode:"zone_01",candidateBranchId:"branch_b",
 savedMappedBranchId:"branch_b",coverage:true};
const make=(record:Record<string,unknown>,extra:Record<string,unknown>={})=>({
 actor:{workspaceId:"tenant_a",role:"OWNER"},workspaceId:"tenant_a",
 branchId:"branch_a",asOf:"2026-10-26T10:00:00Z",expectedVersion:2,
 record:{...base,...record},...extra,
});
describe("SONIC F10 anti-abuse and property routing reviews",()=>{
 it("flags a source-grounded high-risk signal without suppressing a lead",()=>{
  const x=reviewSonicF10LeadPolicy(make(spam));
  expect(x.ok).toBe(true);
  if(!x.ok)return;
  expect(x.value).toMatchObject({
   state:"F10_UNPERSISTED_INTERNAL_LEAD_REVIEW",kind:"SPAM_LEAD_REVIEW",
   review:"REVIEW_RECOMMENDED",proposedCode:"REVIEW_SUSPECTED_SPAM",
   leadBlocked:false,leadMerged:false,customerContacted:false,
   created:false,executed:false,sourceAuthenticationRequired:true,
  });
  expect(x.value.fingerprint).toMatch(/^[a-f0-9]{64}$/);
 });
 it("does not turn a weak spam score into enforcement",()=>{
  const x=reviewSonicF10LeadPolicy(make({...spam,riskScore:20}));
  expect(x.ok).toBe(true);
  if(x.ok)expect(x.value).toMatchObject({
   review:"NO_REVIEW_SIGNAL",fingerprint:null,leadBlocked:false,
  });
 });
 it("suggests only a branch matching the supplied saved coverage map",()=>{
  const x=reviewSonicF10LeadPolicy(make(route));
  expect(x.ok).toBe(true);
  if(x.ok)expect(x.value).toMatchObject({
   review:"REVIEW_RECOMMENDED",suggestedBranchId:"branch_b",
   branchReassigned:false,ownerApprovalRequired:true,
  });
  const bad=reviewSonicF10LeadPolicy(make({...route,savedMappedBranchId:"branch_c"}));
  expect(bad.ok).toBe(true);
  if(bad.ok)expect(bad.value).toMatchObject({
   review:"NO_REVIEW_SIGNAL",suggestedBranchId:null,
  });
 });
 it("denies stale data, cross-tenant rows and staff actor",()=>{
  expect(reviewSonicF10LeadPolicy(make(spam,{expectedVersion:4})))
   .toMatchObject({ok:false,code:"F10_LEAD_SOURCE_STALE"});
  expect(reviewSonicF10LeadPolicy(make({...route,workspaceId:"tenant_b"})))
   .toMatchObject({ok:false,code:"F10_LEAD_TENANT_MISMATCH"});
  expect(reviewSonicF10LeadPolicy(make(spam,{actor:{workspaceId:"tenant_a",role:"CREW"}})))
   .toMatchObject({ok:false,code:"F10_LEAD_OWNER_REQUIRED"});
 });
 it("rejects unverified abuse classification and non-real risk numbers",()=>{
  for(const bad of [
   {...spam,signal:"UNTRUSTED_AI_OUTPUT"}, {...spam,riskScore:"88"},
   {...spam,riskScore:101},{...spam,riskScore:-10},
   {...spam,signalAt:"2026-02-30T10:00:00Z"},
  ])expect(reviewSonicF10LeadPolicy(make(bad)))
   .toMatchObject({ok:false,code:"F10_LEAD_EVIDENCE_INVALID"});
 });
 it("rejects untrusted property mappings and arbitrary execution flags",()=>{
  for(const bad of [
   {...route,coverage:"true"}, {...route,propertyZoneCode:""},
   {...route,branchReassigned:true},
  ]){
   const x=reviewSonicF10LeadPolicy(make(bad));
   expect(x.ok).toBe(false);
  }
  expect(reviewSonicF10LeadPolicy({...make(spam),send:true}))
   .toMatchObject({ok:false,code:"F10_LEAD_INPUT_INVALID"});
 });
 it("refuses getters and malformed payload without invoking unsafe accessors",()=>{
  const input=make(route);
  Object.defineProperty(input.record,"kind",{
   enumerable:true,get(){throw Error("getter injection");},
  });
  expect(reviewSonicF10LeadPolicy(input))
   .toMatchObject({ok:false,code:"F10_LEAD_INPUT_INVALID"});
 });
});
