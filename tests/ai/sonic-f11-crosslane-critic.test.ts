import {describe,expect,it} from "vitest";
import {planSonicF11Revenue} from "../../src/server/ai/sonic-f11-revenue";
import {planSonicF11Quality} from "../../src/server/ai/sonic-f11-quality";
import {planSonicF11Resilience} from "../../src/server/ai/sonic-f11-resilience";

const core={workspaceId:"tenant_01",branchId:"branch_01",sourceId:"source_01",sourceVersion:3};
const base=(record:Record<string,unknown>,mods:Record<string,unknown>={})=>({
 actor:{workspaceId:"tenant_01",role:"OWNER"},workspaceId:"tenant_01",
 branchId:"branch_01",expectedVersion:3,asOf:"2026-10-26T12:00:00Z",
 record:{...core,...record},...mods,
});
const cases=[
 {run:planSonicF11Revenue,record:{kind:"QUOTE_EXPIRY_REVIEW",status:"SENT",expiresAt:"2026-10-25T12:00:00Z",acceptedAt:null}},
 {run:planSonicF11Quality,record:{kind:"INCIDENT_ESCALATION_REVIEW",status:"OPEN",severity:"CRITICAL",observedAt:"2026-10-25T12:00:00Z",mitigatedAt:null}},
 {run:planSonicF11Resilience,record:{kind:"OUTBOX_DEAD_LETTER_REVIEW",status:"DEAD_LETTER",deliveryState:"UNDELIVERED",retryCount:4,deadLetterAt:"2026-10-25T12:00:00Z"}},
] as const;
describe("F11 cross-lane independent source-proposal critic",()=>{
 it("proves scope denial across each module, no foreign tenant claims",()=>{
  for(const c of cases) {
   expect(c.run(base(c.record,{actor:{workspaceId:"tenant_02",role:"OWNER"}})).ok).toBe(false);
   expect(c.run(base({...c.record,workspaceId:"tenant_02"})).ok).toBe(false);
  }
 });
 it("rejects getter-backdoor action booleans and unknown transaction flags",()=>{
  for(const c of cases) {
   expect(c.run(base({...c.record,refundIssued:true})).ok).toBe(false);
   const x=base(c.record);
   Object.defineProperty(x.record,"sourceVersion",{get(){return 3;}});
   expect(c.run(x).ok).toBe(false);
  }
 });
 it("never returns executed, delivered, charged, or scheduled receipts",()=>{
  for(const c of cases){
   const result=c.run(base(c.record));
   expect(result.ok).toBe(true);
   if(!result.ok)continue;
   expect(result.value).toMatchObject({
    state:"F11_UNPERSISTED_OWNER_REVIEW",decision:"REVIEW_RECOMMENDED",
    saved:false,scheduled:false,executed:false,providerCalled:false,
    customerMessageSent:false,financialMutation:false,bookingChanged:false,recordChanged:false,
    sourceAuthenticationRequired:true,humanApprovalRequired:true,
   });
  }
 });
 it("does not create source-generated fingerprints for not-yet-due recommendations",()=>{
  const x=base({kind:"QUOTE_EXPIRY_REVIEW",status:"SENT",
   expiresAt:"2026-10-27T12:00:00Z",acceptedAt:null});
  const result=planSonicF11Revenue(x);
  expect(result.ok).toBe(true);
  if(result.ok)expect(result.value).toMatchObject({
   decision:"NOT_DUE",proposedTask:null,fingerprint:null,executed:false,
  });
 });
});