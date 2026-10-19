import {describe,expect,it} from "vitest";
import {buildAiActionAuditRecord} from "../../src/server/ai/action-audit";
const fixture={
 workspaceId:"workspace-1",conversationId:"conversation-1",messageId:"message-1",
 model:"synthetic-model",promptVersion:"r44-source-only",capturedAt:"2026-10-19T14:00:00.000Z",
 toolResults:[],blockedActions:[],
};
describe("R44 source-truth AI tool audit",()=>{
 it("never elevates a model COMPLETED claim to a real workflow execution",()=>{
   const audit=buildAiActionAuditRecord({
     ...fixture,toolResults:[
       {toolName:"sendProviderMessage",outcome:"COMPLETED" as const,
         evidenceRef:"payment:unverified-100",
         summary:"The merchant has been charged and provider received everything"},
       {toolName:"calculateQuote",outcome:"PROPOSED" as const,
         evidenceRef:"quote-draft:quote-1",summary:"Ready for owner quote review"},
     ]
   });
   expect(audit).toMatchObject({
     unverifiedCompletionClaims:1,completionEvidenceVerified:false,
     toolResults:[
       {toolName:"sendProviderMessage",outcome:"PROPOSED",
         summary:"Unverified completion claim. Inspect saved execution evidence."},
       {toolName:"calculateQuote",outcome:"PROPOSED",evidenceRef:"quote-draft:quote-1"}
     ],
   });
   expect(audit.toolResults[0].evidenceRef).toBeUndefined();
   expect(JSON.stringify(audit)).not.toContain("merchant has been charged");
 });
 it("preserves blocked and failed outcome evidence without inventing an action",()=>{
   const audit=buildAiActionAuditRecord({...fixture,toolResults:[
     {toolName:"unknown",outcome:"FAILED" as const,summary:"No operation succeeded"},
     {toolName:"markPaid",outcome:"BLOCKED" as const,summary:"Forbidden"},
   ]});
   expect(audit).toMatchObject({unverifiedCompletionClaims:0,completionEvidenceVerified:false,
     toolResults:[{outcome:"FAILED"},{outcome:"BLOCKED"}]});
 });
 it("caps forged completion fanout, keeps customer data and private reasoning out",()=>{
   const audit=buildAiActionAuditRecord({...fixture,privateReasoning:"untrusted internal thoughts",
     toolResults:Array(100).fill({toolName:"markPaymentPaid",outcome:"COMPLETED",
       summary:"private@example.test received money"})});
   expect(audit.toolResults).toHaveLength(64);
   expect(audit.unverifiedCompletionClaims).toBe(64);
   expect(JSON.stringify(audit)).not.toContain("private@example.test");
   expect(JSON.stringify(audit)).not.toContain("untrusted internal thoughts");
 });
});
