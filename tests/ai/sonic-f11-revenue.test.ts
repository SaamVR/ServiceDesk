import {describe,expect,it} from "vitest";
import {planSonicF11Revenue} from "../../src/server/ai/sonic-f11-revenue";

const first={kind:"QUOTE_EXPIRY_REVIEW",status:"SENT",expiresAt:"2026-10-25T12:00:00Z",acceptedAt:null};
const second={kind:"INVOICE_OVERDUE_REVIEW",status:"ISSUED",dueAt:"2026-10-25T12:00:00Z",outstandingMinorUnits:12000,currency:"BDT",paidAt:null};
const make=(record:Record<string,unknown>,extra:Record<string,unknown>={})=>({
 actor:{workspaceId:"tenant_a",role:"OWNER"},workspaceId:"tenant_a",branchId:"branch_a",
 asOf:"2026-10-26T12:00:00Z",expectedVersion:3,
 record:{workspaceId:"tenant_a",branchId:"branch_a",sourceId:"source_01",sourceVersion:3,...record},
 ...extra,
});
describe("SONIC F11 Revenue saved-projection owner review (source only)",()=>{
 it("proposes the first overdue internal human review without committing effects",()=>{
  const r=planSonicF11Revenue(make(first));
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
  const r=planSonicF11Revenue(make(second));
  expect(r.ok).toBe(true);
  if(r.ok)expect(r.value).toMatchObject({decision:"REVIEW_RECOMMENDED",saved:false,executed:false});
 });
 it("returns NOT_DUE without a fingerprint or job when threshold has not passed",()=>{
  const r=planSonicF11Revenue(make({...first,...{expiresAt:"2026-10-27T12:00:00Z"}}));
  expect(r.ok).toBe(true);
  if(r.ok)expect(r.value).toMatchObject({
   decision:"NOT_DUE",proposedTask:null,fingerprint:null,scheduled:false,
  });
 });
 it("rejects staff, cross-workspace, cross-branch and stale-record assertions",()=>{
  expect(planSonicF11Revenue(make(first,{actor:{workspaceId:"tenant_a",role:"STAFF"}})))
   .toMatchObject({ok:false,code:"F11_REVENUE_OWNER_REQUIRED"});
  expect(planSonicF11Revenue(make({...first,workspaceId:"tenant_b"})))
   .toMatchObject({ok:false,code:"F11_REVENUE_SCOPE_MISMATCH"});
  expect(planSonicF11Revenue(make({...first,branchId:"branch_b"})))
   .toMatchObject({ok:false,code:"F11_REVENUE_SCOPE_MISMATCH"});
  expect(planSonicF11Revenue(make(first,{expectedVersion:4})))
   .toMatchObject({ok:false,code:"F11_REVENUE_STALE"});
 });
 it("rejects implausible or unauthorized saved state evidence",()=>{
  for(const altered of [{status:"ACCEPTED"},{acceptedAt:"2026-10-24T12:00:00Z"}]){
   expect(planSonicF11Revenue(make({...first,...altered})))
    .toMatchObject({ok:false,code:"F11_REVENUE_EVIDENCE_INVALID"});
  }
 });
 it("rejects send/payment bypass flags, poisoned prototypes and getter-backed type",()=>{
  expect(planSonicF11Revenue(make({...first,customerMessageSent:true})))
   .toMatchObject({ok:false,code:"F11_REVENUE_INPUT_INVALID"});
  const x=make(first);
  Object.defineProperty(x.record,"kind",{enumerable:true,get(){throw Error("getter");}});
  expect(planSonicF11Revenue(x)).toMatchObject({ok:false,code:"F11_REVENUE_INPUT_INVALID"});
  const poisoned=make(first);
  Object.setPrototypeOf(poisoned.record,null);
  expect(planSonicF11Revenue(poisoned))
   .toMatchObject({ok:false,code:"F11_REVENUE_INPUT_INVALID"});
 });
 it("rejects object-valued currency without invoking attacker toString",()=>{
  let coerced=false;
  const poison={toString(){coerced=true;throw Error("UNTRUSTED_COERCION");}};
  const result=planSonicF11Revenue(make({...second,currency:poison}));
  expect(result).toMatchObject({ok:false,code:"F11_REVENUE_EVIDENCE_INVALID"});
  expect(coerced).toBe(false);
 });
 it("binds changing approved saved evidence and source version into the candidate fingerprint",()=>{
  const a=planSonicF11Revenue(make(first)),b=planSonicF11Revenue(make(first,{
   expectedVersion:4,
   record:{workspaceId:"tenant_a",branchId:"branch_a",sourceId:"source_01",sourceVersion:4,...first},
  }));
  expect(a.ok&&b.ok).toBe(true);
  if(a.ok&&b.ok)expect(a.value.fingerprint).not.toBe(b.value.fingerprint);
 });
});
