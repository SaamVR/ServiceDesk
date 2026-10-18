import { describe, expect, it } from "vitest";
import { buildOwnerAssistantContext } from "../../src/server/ai/owner-context";

const actor={workspaceId:"workspace-a",userId:"owner-a",role:"OWNER" as const};
const metrics={
  workspaceId:"workspace-a",source:"CORE_METRICS" as const,
  from:"2026-10-01T00:00:00.000Z",to:"2026-10-18T00:00:00.000Z",
  metrics:{OPEN_REQUESTS:5},
};
const basic={actor,metrics,now:"2026-10-18T00:01:00.000Z"};
describe("SONIC R35 owner AI trusted context and no freeform provider PII",()=>{
  it("keeps exact verified business count, timestamps and safe provider status",()=>{
    const result=buildOwnerAssistantContext({...basic,providerSummaries:[
      {provider:"AI",evidenceVerification:"CONTRACT_TESTED",
       summary:"Bearer private-key email personal@example.com"},
    ]});
    expect(result).toMatchObject({ok:true,value:{
      readOnly:true,canMutateBusinessTruth:false,aiAuthoritative:false,
      metrics:{OPEN_REQUESTS:5},sources:["CORE_METRICS","PROVIDER_SUMMARY"],
      providerSummaries:[{provider:"AI",evidenceVerification:"CONTRACT_TESTED",
        summary:"Provider contract tested only; no live delivery is confirmed."}],
    }});
    expect(JSON.stringify(result)).not.toContain("personal@example.com");
    expect(JSON.stringify(result)).not.toContain("private-key");
  });
  it("rejects unauthorized owner/tenant before building context",()=>{
    expect(buildOwnerAssistantContext({...basic,actor:{...actor,role:"DISPATCHER"}}))
      .toMatchObject({ok:false,code:"OWNER_ROLE_REQUIRED"});
    expect(buildOwnerAssistantContext({...basic,actor:{...actor,workspaceId:"other"}}))
      .toMatchObject({ok:false,code:"WORKSPACE_MISMATCH"});
  });
  it("rejects poisoned count and unsupported business metrics",()=>{
    for(const value of [-1,Infinity,NaN,2.5,"5",null]) {
      const r=buildOwnerAssistantContext({...basic,metrics:{...metrics,metrics:{
        OPEN_REQUESTS:value,
      }} as typeof metrics});
      expect(r).toMatchObject({ok:false,code:"OWNER_CONTEXT_METRICS_UNVERIFIED"});
    }
    expect(buildOwnerAssistantContext({...basic,metrics:{...metrics,
      metrics:{FORECASTED_REVENUE:5000} as unknown as typeof metrics.metrics}}))
      .toMatchObject({ok:false,code:"OWNER_CONTEXT_METRICS_UNVERIFIED"});
  });
  it("refuses invalid source windows, stale shape and forged provider verification",()=>{
    for(const m of [
      {...metrics,from:"2026-02-30T00:00:00.000Z"},
      {...metrics,from:"2026-10-19T00:00:00.000Z"},
      {...metrics,metrics:{}},
    ])expect(buildOwnerAssistantContext({...basic,metrics:m as typeof metrics}))
      .toMatchObject({ok:false,code:"OWNER_CONTEXT_METRICS_UNVERIFIED"});
    for(const p of [
      [{provider:"AI",evidenceVerification:"DELIVERED",summary:"passed"}],
      [{provider:"UNTRUSTED",evidenceVerification:"PROVIDER_VERIFIED",summary:"okay"}],
      [{provider:"AI",evidenceVerification:"PROVIDER_VERIFIED",summary:"x".repeat(3001)}],
    ])expect(buildOwnerAssistantContext({...basic,providerSummaries:p as NonNullable<Parameters<typeof buildOwnerAssistantContext>[0]["providerSummaries"]>}))
      .toMatchObject({ok:false,code:"OWNER_CONTEXT_PROVIDER_UNVERIFIED"});
  });
});
