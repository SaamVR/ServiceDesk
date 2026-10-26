import {describe,expect,it} from "vitest";
import {planSonicF11Quality} from "../../src/server/ai/sonic-f11-quality";

const first={kind:"CHECKLIST_GAP_REVIEW",status:"IN_PROGRESS",requiredCount:10,completedCount:7,scheduledEndAt:"2026-10-25T12:00:00Z"};
const second={kind:"INCIDENT_ESCALATION_REVIEW",status:"OPEN",severity:"HIGH",observedAt:"2026-10-25T12:00:00Z",mitigatedAt:null};
const make=(record:Record<string,unknown>,extra:Record<string,unknown>={})=>({
 actor:{workspaceId:"tenant_a",role:"OWNER"},workspaceId:"tenant_a",branchId:"branch_a",
 asOf:"2026-10-26T12:00:00Z",expectedVersion:3,
 record:{workspaceId:"tenant_a",branchId:"branch_a",sourceId:"source_01",sourceVersion:3,...record},
 ...extra,
});
describe("SONIC F11 Quality saved-projection owner review (source only)",()=>{
 it("proposes the first overdue internal human review without committing effects",()=>{
  const r=planSonicF11Quality(make(first));
  expect(r.ok).toBe(true);
  if(!r.ok)return;
  expect(r.value).toMatchObject({
   decision:"REVIEW_RECOMMENDED",humanApprovalRequired:true,sourceAuthenticationRequired:true,
   saved:false,scheduled:false,executed:false,providerCalled:false,
   customerMessageSent:false,financialMutation:false,bookingChanged:false,recordChanged:false,
  });
  expect(r.value.fingerprint).toMatch(/^[a-f0-9]{64}$/);
 });
 it("proposes the second overdue policy independently, with no business mutation",()=>{
  const r=planSonicF11Quality(make(second));
  expect(r.ok).toBe(true);
  if(r.ok)expect(r.value).toMatchObject({decision:"REVIEW_RECOMMENDED",saved:false,executed:false});
 });
 it("returns NOT_DUE without a fingerprint or job when threshold has not passed",()=>{
  const r=planSonicF11Quality(make({...first,...{scheduledEndAt:"2026-10-27T12:00:00Z"}}));
  expect(r.ok).toBe(true);
  if(r.ok)expect(r.value).toMatchObject({
   decision:"NOT_DUE",proposedTask:null,fingerprint:null,scheduled:false,
  });
 });
 it("rejects staff, cross-workspace, cross-branch and stale-record assertions",()=>{
  expect(planSonicF11Quality(make(first,{actor:{workspaceId:"tenant_a",role:"STAFF"}})))
   .toMatchObject({ok:false,code:"F11_Quality_OWNER_REQUIRED"});
  expect(planSonicF11Quality(make({...first,workspaceId:"tenant_b"})))
   .toMatchObject({ok:false,code:"F11_Quality_SCOPE_MISMATCH"});
  expect(planSonicF11Quality(make({...first,branchId:"branch_b"})))
   .toMatchObject({ok:false,code:"F11_Quality_SCOPE_MISMATCH"});
  expect(planSonicF11Quality(make(first,{expectedVersion:4})))
   .toMatchObject({ok:false,code:"F11_Quality_STALE"});
 });
 it("rejects implausible or unauthorized saved state evidence",()=>{
  for(const altered of [{completedCount:10},{requiredCount:0}]){
   expect(planSonicF11Quality(make({...first,...altered})))
    .toMatchObject({ok:false,code:"F11_Quality_EVIDENCE_INVALID"});
  }
 });
 it("rejects send/payment bypass flags, poisoned prototypes and getter-backed type",()=>{
  expect(planSonicF11Quality(make({...first,customerMessageSent:true})))
   .toMatchObject({ok:false,code:"F11_Quality_INPUT_INVALID"});
  const x=make(first);
  Object.defineProperty(x.record,"kind",{enumerable:true,get(){throw Error("getter");}});
  expect(planSonicF11Quality(x)).toMatchObject({ok:false,code:"F11_Quality_INPUT_INVALID"});
  const poisoned=make(first);
  Object.setPrototypeOf(poisoned.record,null);
  expect(planSonicF11Quality(poisoned))
   .toMatchObject({ok:false,code:"F11_Quality_INPUT_INVALID"});
 });
 it("rejects object-valued severity without invoking attacker toString",()=>{
  let coerced=false;
  const poison={toString(){coerced=true;throw Error("UNTRUSTED_COERCION");}};
  const result=planSonicF11Quality(make({...second,severity:poison}));
  expect(result).toMatchObject({ok:false,code:"F11_Quality_EVIDENCE_INVALID"});
  expect(coerced).toBe(false);
 });
 it("binds changing approved saved evidence and source version into the candidate fingerprint",()=>{
  const a=planSonicF11Quality(make(first)),b=planSonicF11Quality(make(first,{
   expectedVersion:4,
   record:{workspaceId:"tenant_a",branchId:"branch_a",sourceId:"source_01",sourceVersion:4,...first},
  }));
  expect(a.ok&&b.ok).toBe(true);
  if(a.ok&&b.ok)expect(a.value.fingerprint).not.toBe(b.value.fingerprint);
 });
});
