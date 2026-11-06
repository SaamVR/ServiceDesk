import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
const read=(p:string)=>readFileSync(p);
const gitHash=(b:Buffer)=>createHash("sha1").update("blob "+b.length+"\0").update(b).digest("hex");
const overlay=JSON.parse(read("docs/delivery/sonic-f15-f20-post-lock-ui-guard-20261106.json").toString()) as {
 schema:string; baseHead:string;
 originalLocks:Array<{path:string;blob:string}>;
 replacements:Array<{path:string;priorBlob:string;newBlob:string}>;
 changedFiles:Array<{path:string;blob:string}>;
};
const m=JSON.parse(read("docs/delivery/sonic-f15-ir21-reviewed-owner-inbox-source-lock-20261030.json").toString()) as {
 schema:string;state:string;parentIR21:string;importedHead:string;
 importedExactBlobs:Array<{path:string;blob:string}>;
 newIntegratedBlobs:Array<{path:string;blob:string}>;
 priorInboxBlob:string;sourceRequirements:string[];forbidden:string[];
};
const uiSuccessorRaw=read("docs/delivery/sonic-ir21-f15-f20-ui-lifecycle-successor-lock-20261106.json");
const uiSuccessor=JSON.parse(uiSuccessorRaw.toString()) as {
 schema:string;historicManifestsUnchanged:string[];
 overrides:Array<{path:string;historicSha:string;currentSha:string;gate:string}>;
};
describe("F15 independent critic: no new composite, exact source and default-denied owner escalation",()=>{
 it("proves unchanged reviewed atomic source from #884 and only pinned added UI files",()=>{
  expect(m.schema).toBe("servicedesk.f15.ir21.reviewed-atomic-owner-manual-source.v1");
  expect(m.parentIR21).toBe("aa7484fee74025b7e0db4fd67fcff234b2edcdec");
  expect(m.importedHead).toBe("8a46e5f3d74f2cc4c7e5676993f90e2b58c627c7");
  expect(m.state).toBe("SOURCE_IMPLEMENTED_NOT_INSTALLED");
  expect(m.importedExactBlobs).toHaveLength(15);
  expect(m.newIntegratedBlobs).toHaveLength(18);
  expect(gitHash(uiSuccessorRaw)).toBe("89f1f701fa901988322eb2d250c49d89cea0b2e6");
  expect(uiSuccessor.schema).toBe("servicedesk.sonic.ir21.f15-f20.ui-lifecycle-successor.v1");
  expect(uiSuccessor.historicManifestsUnchanged).toContain(
    "docs/delivery/sonic-f15-ir21-reviewed-owner-inbox-source-lock-20261030.json");
  expect(uiSuccessor.overrides).toHaveLength(3);
  const attention=uiSuccessor.overrides.find(x=>
    x.path==="src/features/operations/OwnerLinkedAttentionReview.tsx");
  expect(attention?.historicSha).toBe("80927abfee80a1d6c1f928811ff36d35426bfd78");
  expect(attention?.gate).toBe("F15_PERSISTED_ACK_READBACK_NO_PROVIDER");
  expect(overlay.schema).toBe("servicedesk.f15-f20.post-lock-ui-guard.v1");
  expect(overlay.baseHead).toBe("6e3d27e64517255a582ddceed5df9321542c504b");
  expect(overlay.originalLocks).toContainEqual({
   path:"docs/delivery/sonic-f15-ir21-reviewed-owner-inbox-source-lock-20261030.json",
   blob:"c11e87a63e0a13b8c873548675b8c3cc79e08315"});
  expect(overlay.replacements).toHaveLength(6);
  expect(overlay.changedFiles).toHaveLength(8);
  expect(new Set(overlay.changedFiles.map(x=>x.path)).size).toBe(8);
  for(const f of overlay.changedFiles)
   expect(gitHash(read(f.path)),f.path).toBe(f.blob);
  for(const x of [...m.importedExactBlobs,...m.newIntegratedBlobs]){
   expect(x.path).not.toContain("..");
   // Preserve the ORIGINAL F15 lock's route SHA; IR21+ adds one explicit
   // owner request-rule panel, independently pinned to a new route blob.
   if(x.path==="src/app/app/[workspace]/inbox/page.tsx"){
    expect(x.blob).toBe("56516b7aa63750d5a46446e160e507d7481ac1ba");
    continue;
   }
   if(x.path===attention?.path){
    expect(attention.historicSha).toBe(x.blob);
    expect(gitHash(read(x.path)),x.path).toBe(attention.currentSha);
    continue;
   }
   const next=overlay.replacements.find(y=>y.path===x.path);
   if(next){
    expect(next.priorBlob,x.path).toBe(x.blob);
    expect(gitHash(read(x.path)),x.path).toBe(next.newBlob);
   }else expect(gitHash(read(x.path)),x.path).toBe(x.blob);
  }
  const currentRoute=read("src/app/app/[workspace]/inbox/page.tsx");
  expect(gitHash(currentRoute)).toBe("b68b99b3680b6f5ff4aa192a7cbda360715b1ef2");
  expect(currentRoute.toString()).toContain("<InboxProtectedLeadReviewPanel workspaceSlug={workspace} selectedConversationId={query.conversation}/>");
  expect(currentRoute.toString()).toContain("<InboxRequestRulesPanel workspaceSlug={workspace} selectedConversationId={query.conversation}/>");

  expect(m.priorInboxBlob).toBe("1dbdc5fede5b5b21d7a488934c5f0151e0e5a672");
 });
 it("client cannot activate event or claim workflow/provider success by itself",()=>{
  const a=read("src/server/workflows/sonic-f15-owner-manual-escalation.ts").toString();
  const u=read("src/features/operations/OwnerUnansweredLeadReview.tsx").toString();
  expect(a).toContain('process.env.SERVICEDESK_F15_OWNER_MANUAL_ESCALATION_ENABLED==="true"');
  expect(a).toContain('actor.role!=="OWNER"');
  expect(a).toContain('branchScope.mode!=="ALL"');
  expect(a).toContain("readF15CompleteSavedLeadFacts");
  expect(a).toContain("PostgresF15AtomicIngressPort");
  expect(a).toContain("workflowExecuted:false");
  expect(u).toContain("This cannot send messages or run rules.");
  expect(u).toContain("Read saved owner-review journal");
  const ui=read("src/features/operations/OwnerLinkedAttentionReview.tsx").toString();
  expect(ui).toContain("useCallback");
  expect(ui).toContain("pending.current");
  expect(ui).toContain("isF15AcknowledgementProgressVerified");
  expect(ui).not.toContain("sendEmail(");
  expect(ui).not.toContain("chargeCard(");
  const linked=read("src/server/workflows/sonic-f15-owner-linked-attention.ts").toString();
  expect(linked).toContain('row.resource_type!=="f15_unanswered_lead_review"');
  expect(linked).toContain("humanReviewRequired:true");
  expect(a).toContain("readF15CompleteSavedLeadFacts");
  expect(u).toContain("seq.current");
  for(const forbidden of ["sendEmail(","sendWhatsApp(","chargeCard(","publishWorkflow("])
   expect(a+u).not.toContain(forbidden);
  expect(m.forbidden).toContain("CANONICAL_MERGE");
  expect(m.forbidden).toContain("UNAPPROVED_DB_MIGRATION");
  expect(m.sourceRequirements).toContain("F15_ATOMIC_SQL_OWNER_DBA_APPROVED_AND_APPLIED");
 });
});
