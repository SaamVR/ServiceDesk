import {describe,expect,it} from "vitest";
import {buildOwnerAssistantContext} from "../../src/server/ai/owner-context";
const actor={workspaceId:"workspace-a",userId:"owner-a",role:"OWNER" as const};
const metrics={workspaceId:"workspace-a",source:"CORE_METRICS" as const,
 from:"2026-10-01T00:00:00.000Z",to:"2026-10-18T00:00:00.000Z",
 metrics:{OPEN_REQUESTS:2}};
const input={actor,metrics,now:"2026-10-18T00:00:01.000Z"};
describe("Independent L14 critic — untrusted hidden owner model evidence",()=>{
 it("rejects a hidden customer contact sneaking into model metrics",()=>{
  const raw=Object.defineProperty({OPEN_REQUESTS:2},"customerEmail",{
    value:"private@customer.test",enumerable:false,
  });
  const r=buildOwnerAssistantContext({...input,metrics:{...metrics,metrics:raw}});
  expect(r).toMatchObject({ok:false,code:"OWNER_CONTEXT_METRICS_UNVERIFIED"});
  expect(JSON.stringify(r)).not.toContain("private@customer.test");
 });
 it("does not execute a poisoned provider summary getter while assembling a model context",()=>{
  const provider=Object.defineProperty({provider:"AI",evidenceVerification:"CONTRACT_TESTED"},
    "summary",{enumerable:true,get(){throw Error("RAW_PRIVATE_PROVIDER_SECRET");}});
  expect(()=>buildOwnerAssistantContext({...input,
    providerSummaries:[provider] as never})).not.toThrow();
  expect(buildOwnerAssistantContext({...input,providerSummaries:[provider] as never}))
    .toMatchObject({ok:false,code:"OWNER_CONTEXT_PROVIDER_UNVERIFIED"});
 });
 it("rejects a hidden bearer field within an otherwise harmless provider summary",()=>{
  const provider=Object.defineProperty({provider:"AI",
    evidenceVerification:"CONTRACT_TESTED",summary:"Contract tested"},
    "bearerToken",{value:"secret",enumerable:false});
  expect(buildOwnerAssistantContext({...input,providerSummaries:[provider] as never}))
    .toMatchObject({ok:false,code:"OWNER_CONTEXT_PROVIDER_UNVERIFIED"});
 });
});
