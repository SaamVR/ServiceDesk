import {describe,expect,it} from "vitest";
import {classifyAiModelFailureForRecovery} from "../../src/server/ai/model-recovery";
const fixture={code:"AI_MODEL_TIMEOUT",workspaceId:"workspace-qa",
 conversationId:"conversation-qa",attempts:1,maxAttempts:4,
 occurredAt:"2026-10-18T00:00:00.000Z"};
describe("SONIC R33 L01 redacted durable AI failure recovery",()=>{
 it("still retries real transient provider failures with stable redacted identities",()=>{
   const a=classifyAiModelFailureForRecovery(fixture);
   const b=classifyAiModelFailureForRecovery({...fixture});
   expect(a).toMatchObject({provider:"AI",action:"RETRY",retryable:true,
     terminal:false,preservesIdempotency:true,mutatesBusinessTruth:false});
   expect(a.notes).toEqual(b.notes);
   const leaked=JSON.stringify(a);
   expect(leaked).not.toContain("workspace-qa");
   expect(leaked).not.toContain("conversation-qa");
 });
 it("preserves nonretryable invalid response and configuration decisions without raw contact exposure",()=>{
   const r=classifyAiModelFailureForRecovery({...fixture,code:"AI_MODEL_INVALID_RESPONSE"});
   expect(r).toMatchObject({action:"OPERATOR_REVIEW",retryable:false});
   expect(JSON.stringify(r)).not.toContain("conversation-qa");
   const c=classifyAiModelFailureForRecovery({...fixture,code:"AI_MODEL_CONFIGURATION_BLOCKED"});
   expect(c).toMatchObject({action:"BLOCKED_CONFIGURATION",retryable:false});
 });
 it("fails closed instead of throwing for poisoned clocks, IDs and budgets",()=>{
   for(const patch of [
     {occurredAt:"yesterday"}, {occurredAt:""},
     {workspaceId:"owner@private.test"},{conversationId:"Bearer secret"},
     {conversationId:"<private>"},{attempts:-1},{attempts:Infinity},
     {maxAttempts:0},{maxAttempts:100},{attempts:4,maxAttempts:4},
   ]){
     expect(()=>classifyAiModelFailureForRecovery({...fixture,...patch})).not.toThrow();
     const r=classifyAiModelFailureForRecovery({...fixture,...patch});
     expect(r).toMatchObject({action:"OPERATOR_REVIEW",terminal:true,
       retryable:false,mutatesBusinessTruth:false,preservesIdempotency:false});
     expect(JSON.stringify(r)).not.toMatch(/secret|owner@|private/i);
   }
 });
 it("deduplicates opaque recovery identity across retries without echoing the saved conversation ID",()=>{
   const r=classifyAiModelFailureForRecovery({...fixture,attempts:2});
   const a=classifyAiModelFailureForRecovery(fixture);
   const fingerprint=(d:typeof r)=>JSON.stringify(d.notes).match(/ai:[0-9a-f]{24}/)?.[0];
   expect(fingerprint(r)).toEqual(fingerprint(a));
   expect(fingerprint(r)).toBeDefined();
 });
});
