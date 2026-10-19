import {describe,expect,it} from "vitest";
import {evaluateAiProviderReadiness} from "../../src/server/ai/provider-gate";
const fixture={
 workspaceId:"workspace-test-1",modelApiKeyConfigured:true,
 approvedKnowledgeIndexConfigured:true,toolAllowlistConfigured:true,
 controlledExtractionObserved:true,controlledKnowledgeCitationObserved:true,
 handoverRoutingObserved:true,now:"2026-10-19T14:00:00.000Z",
};
describe("R44 independent provider proof critic",()=>{
 it("must not echo a forged bearer or invalid clock in the owner provider receipt",()=>{
   for(const now of ["Bearer very-secret", "2026-02-30T12:00:00.000Z",
     "2026-10-19T14:00:00", "<script>private</script>"]){
     const ready=evaluateAiProviderReadiness({...fixture,now});
     expect(ready.status).not.toBe("PROVIDER_VERIFIED");
     expect(ready.evidence.capturedAt).toBe("unverified-time");
     expect(JSON.stringify(ready)).not.toContain(now);
   }
 });
 it("rejects private unscoped workspace text rather than reflecting it into redacted evidence",()=>{
   const workspaceId="Bearer private-security-token";
   const ready=evaluateAiProviderReadiness({...fixture,workspaceId});
   expect(ready.status).toBe("CONFIGURATION_BLOCKED");
   expect(ready.workspaceId).toBe("unverified-workspace");
   expect(JSON.stringify(ready)).not.toContain(workspaceId);
 });
});
