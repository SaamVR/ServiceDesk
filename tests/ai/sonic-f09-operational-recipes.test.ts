import {describe,expect,it} from "vitest";
import {planSonicF09OperationalRecipe,SONIC_F09_RECIPE_KINDS} from "../../src/server/ai/sonic-f09-operational-recipes";

const past="2026-10-24T08:00:00Z",now="2026-10-26T08:00:00Z";
const base={workspaceId:"tenant_a",branchId:"branch_a",sourceId:"src_001",sourceVersion:2};
const cases=[
 {kind:"DUPLICATE_LEAD_REVIEW",status:"OPEN",matchedLeadId:"src_002",
  matchEvidence:"SAVED_CONTACT_HASH_MATCH"},
 {kind:"LEAD_SLA_ESCALATION",status:"UNANSWERED",receivedAt:past,thresholdMinutes:30},
 {kind:"QUOTE_OPEN_FOLLOW_UP",status:"SENT",openedAt:past,lastReplyAt:null,waitHours:24},
 {kind:"CREW_CHECKIN_OVERDUE",status:"ASSIGNED",scheduledStartAt:past,checkInAt:null,graceMinutes:15},
] as const;
const make=(record:Record<string,unknown>,changes:Record<string,unknown>={})=>({
 actor:{workspaceId:"tenant_a",role:"OWNER"},workspaceId:"tenant_a",
 branchId:"branch_a",asOf:now,expectedVersion:2,
 record:{...base,...record},...changes,
});
describe("SONIC F09 first four business-value task automation plans",()=>{
 it("contains four specific missing roadmap workflows",()=>{
  expect(cases.map(v=>v.kind)).toEqual(SONIC_F09_RECIPE_KINDS);
 });
 it.each(cases)("provides a deterministic human-review candidate for $kind",item=>{
  const r=planSonicF09OperationalRecipe(make(item));
  expect(r.ok).toBe(true);
  if(!r.ok)return;
  expect(r.value).toMatchObject({
   state:"F09_OWNER_INTERNAL_REVIEW_PLAN_UNPERSISTED",kind:item.kind,
   outcome:"REVIEW_SUGGESTED",workspaceId:"tenant_a",branchId:"branch_a",
   sourceId:"src_001",sourceVersion:2,
   sourceReauthenticationRequired:true,ownerApprovalRequired:true,
   saved:false,scheduled:false,executed:false,merged:false,
   customerContacted:false,providerCalled:false,
   crewAssignmentChanged:false,moneyChanged:false,
  });
  expect(r.value.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  expect(planSonicF09OperationalRecipe(make(item))).toEqual(r);
 });
 it("does not generate due-now work when saved time is still in the future",()=>{
  for(const item of cases.slice(1)){
   const field=item.kind==="LEAD_SLA_ESCALATION"?"receivedAt":
     item.kind==="QUOTE_OPEN_FOLLOW_UP"?"openedAt":"scheduledStartAt";
   const r=planSonicF09OperationalRecipe(make({
    ...item,[field]:"2026-10-27T15:00:00Z",
   }));
   expect(r.ok).toBe(true);
   if(r.ok)expect(r.value).toMatchObject({
    outcome:"NOT_DUE",fingerprint:null,proposedInternalTask:null,
    saved:false,scheduled:false,
   });
  }
 });
 it("never merges a lead automatically and requires independent exact-hash evidence",()=>{
  expect(planSonicF09OperationalRecipe(make({
   ...cases[0],matchedLeadId:"src_001",
  }))).toMatchObject({ok:false,code:"F09_RECIPE_EVIDENCE_INVALID"});
  expect(planSonicF09OperationalRecipe(make({
   ...cases[0],matchEvidence:"FUZZY_EMAIL_SIMILARITY",
  }))).toMatchObject({ok:false,code:"F09_RECIPE_EVIDENCE_INVALID"});
 });
 it("refuses unrelated branch, non-owner and stale data",()=>{
  expect(planSonicF09OperationalRecipe(make(cases[0],{
   actor:{workspaceId:"tenant_a",role:"DISPATCHER"},
  }))).toMatchObject({ok:false,code:"F09_RECIPE_OWNER_REQUIRED"});
  expect(planSonicF09OperationalRecipe(make({...cases[0],branchId:"branch_b"})))
   .toMatchObject({ok:false,code:"F09_RECIPE_SCOPE_MISMATCH"});
  expect(planSonicF09OperationalRecipe(make(cases[0],{expectedVersion:5})))
   .toMatchObject({ok:false,code:"F09_RECIPE_VERSION_STALE"});
 });
 it("refuses answered lead, replied quote, checked-in crew and invalid SLA thresholds",()=>{
  for(const bad of [
   {...cases[1],status:"ANSWERED"},
   {...cases[2],lastReplyAt:past},
   {...cases[3],checkInAt:past},
   {...cases[1],thresholdMinutes:999},
   {...cases[3],graceMinutes:0},
  ])expect(planSonicF09OperationalRecipe(make(bad)))
   .toMatchObject({ok:false,code:"F09_RECIPE_EVIDENCE_INVALID"});
 });
 it("rejects injection, auto-send flags, non-plain objects and accessors",()=>{
  expect(planSonicF09OperationalRecipe(make({...cases[0],sendCustomer:true})))
   .toMatchObject({ok:false,code:"F09_RECIPE_INVALID"});
  expect(planSonicF09OperationalRecipe({...make(cases[0]),publish:true}))
   .toMatchObject({ok:false,code:"F09_RECIPE_INVALID"});
  const r=make(cases[1]);
  Object.defineProperty(r,"asOf",{enumerable:true,get(){throw Error("private effect");}});
  expect(planSonicF09OperationalRecipe(r))
   .toMatchObject({ok:false,code:"F09_RECIPE_INVALID"});
 });
 it("leaves external messaging, payment and operations unchanged",()=>{
  for(const item of cases){
   const result=planSonicF09OperationalRecipe(make(item));
   expect(result.ok).toBe(true);
   if(result.ok){
    expect(result.value.customerContacted).toBe(false);
    expect(result.value.crewAssignmentChanged).toBe(false);
    expect(result.value.moneyChanged).toBe(false);
    expect(result.value.executed).toBe(false);
   }
  }
 });
});
