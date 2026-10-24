import {describe,expect,it} from "vitest";
import {buildAiActionAuditRecord} from "../../src/server/ai/action-audit";
const base={
 workspaceId:"workspace-1",conversationId:"conversation-1",
 messageId:"message-1",model:"synthetic",promptVersion:"r44",
 capturedAt:"2026-10-19T14:00:00.000Z",blockedActions:[],
};
describe("R44 independent critic — tool-audit untrusted row integrity",()=>{
 it("rejects a model tool outcome getter before accessing private data",()=>{
   const poisoned=Object.defineProperty({toolName:"markPaymentPaid",
     summary:"Unverified claim"},"outcome",{
       enumerable:true,get(){throw new Error("private model callback executed");},
     });
   const audit=buildAiActionAuditRecord({
     ...base,toolResults:[poisoned],
   } as Parameters<typeof buildAiActionAuditRecord>[0]);
   expect(audit.toolResults).toMatchObject([{
     toolName:"unknown",outcome:"BLOCKED",summary:"Unverified tool evidence",
   }]);
   expect(JSON.stringify(audit)).not.toContain("private model callback");
 });
 it("does not treat hidden provider permission fields as audited source",()=>{
   const hidden=Object.defineProperty({
     toolName:"calculateQuote",outcome:"COMPLETED",summary:"unverified completion",
   },"providerSecret",{value:"Bearer private-credential",enumerable:false});
   const audit=buildAiActionAuditRecord({
     ...base,toolResults:[hidden],
   });
   expect(audit.toolResults).toMatchObject([{
     toolName:"unknown",outcome:"BLOCKED",
   }]);
   expect(audit.unverifiedCompletionClaims).toBe(0);
   expect(JSON.stringify(audit)).not.toContain("private-credential");
 });
});
