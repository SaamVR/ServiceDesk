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
const p02Raw=read("docs/delivery/sonic-p02-registered-owner-ui-source-successor-20261106.json");
const p02=JSON.parse(p02Raw.toString()) as {
 schema:string; originalF15F20Overlay:{path:string;blob:string;unchanged:boolean};
 workflowSuccessor:{path:string;previousBlob:string;currentBlob:string};
 changedSource:Array<{path:string;blob:string;intent:string}>;
};
const f23=JSON.parse(read("docs/delivery/sonic-f23-atomic-release-transactional-source-lock-20261107.json").toString()) as {
 schema:string;historicP02ManifestBlob:string;
 workflowSuccessor:{path:string;previousBlob:string;currentBlob:string};
 changedSource:Array<{path:string;blob:string}>;
};
const race=JSON.parse(read("docs/delivery/sonic-f23-owner-revocation-race-successor-20261107.json").toString()) as {
 schema:string;
 historicalLock:{path:string;sha:string;unchanged:boolean};
 workflow:{path:string;oldSha:string;newSha:string};
 testScript:string;testScriptSha:string;requiredReceipts:string[];
};
const authFeedbackRaw=read("docs/delivery/sonic-p02-auth-feedback-surface-successor-20261107.json");
const authFeedback=JSON.parse(authFeedbackRaw.toString()) as {
 schema:string;precursor:{path:string;blob:string;unchanged:boolean};
 workflowSuccessor:{path:string;previousBlob:string;currentBlob:string};
 changedSource:Array<{path:string;blob:string}>;
};
const qaProofRaw=read("docs/delivery/sonic-p02-qa-seed-saved-proof-successor-20261107.json");
const qaProof=JSON.parse(qaProofRaw.toString()) as {
 schema:string;previousAcceptedSource:{path:string;blob:string;unchanged:boolean};
 workflowSuccessor:{path:string;previousBlob:string;currentBlob:string};
 changedSource:Array<{path:string;blob:string;lane:string}>;
};

const m=JSON.parse(read("docs/delivery/sonic-f15-ir21-reviewed-owner-inbox-source-lock-20261030.json").toString()) as {
 schema:string;state:string;parentIR21:string;importedHead:string;
 importedExactBlobs:Array<{path:string;blob:string}>;
 newIntegratedBlobs:Array<{path:string;blob:string}>;
 priorInboxBlob:string;sourceRequirements:string[];forbidden:string[];
};
describe("F15 independent critic: no new composite, exact source and default-denied owner escalation",()=>{
 it("proves unchanged reviewed atomic source from #884 and only pinned added UI files",()=>{
  expect(m.schema).toBe("servicedesk.f15.ir21.reviewed-atomic-owner-manual-source.v1");
  expect(m.parentIR21).toBe("aa7484fee74025b7e0db4fd67fcff234b2edcdec");
  expect(m.importedHead).toBe("8a46e5f3d74f2cc4c7e5676993f90e2b58c627c7");
  expect(m.state).toBe("SOURCE_IMPLEMENTED_NOT_INSTALLED");
  expect(m.importedExactBlobs).toHaveLength(15);
  expect(m.newIntegratedBlobs).toHaveLength(18);
  expect(overlay.schema).toBe("servicedesk.f15-f20.post-lock-ui-guard.v1");
  expect(overlay.baseHead).toBe("6e3d27e64517255a582ddceed5df9321542c504b");
  expect(overlay.originalLocks).toContainEqual({
   path:"docs/delivery/sonic-f15-ir21-reviewed-owner-inbox-source-lock-20261030.json",
   blob:"c11e87a63e0a13b8c873548675b8c3cc79e08315"});
  expect(overlay.replacements).toHaveLength(6);
  expect(overlay.changedFiles).toHaveLength(8);
  expect(new Set(overlay.changedFiles.map(x=>x.path)).size).toBe(8);
  expect(gitHash(p02Raw)).toBe("daedeb155f8d11dfb245b3cca709b20205e400d3");
  expect(p02.schema).toBe("servicedesk.p02.registered-owner-ui-source-successor.v1");
  expect(p02.originalF15F20Overlay.blob).toBe(gitHash(read(p02.originalF15F20Overlay.path)));
  expect(p02.originalF15F20Overlay.unchanged).toBe(true);
  expect(p02.changedSource).toHaveLength(5);
  for(const source of p02.changedSource){
   expect(source.path).not.toContain("..");
   expect(gitHash(read(source.path)),source.path).toBe(source.blob);
  }
  expect(f23.schema).toBe("servicedesk.f23.atomic-hold-release.transactional-source.v1");
  expect(f23.historicP02ManifestBlob).toBe(gitHash(p02Raw));
  expect(f23.workflowSuccessor.previousBlob).toBe(p02.workflowSuccessor.currentBlob);
  expect(f23.workflowSuccessor.path).toBe(p02.workflowSuccessor.path);
  expect(f23.changedSource).toHaveLength(9);
  expect(race.schema).toBe("servicedesk.f23.owner-revocation-race-successor.v1");
  expect(race.historicalLock.path).toBe("docs/delivery/sonic-f23-atomic-release-transactional-source-lock-20261107.json");
  expect(race.historicalLock.sha).toBe("15e909b7abcd4e7ee571646d0b8314dfed1c0a60");
  expect(race.historicalLock.unchanged).toBe(true);
  expect(gitHash(read(race.historicalLock.path))).toBe(race.historicalLock.sha);
  expect(race.workflow.path).toBe(f23.workflowSuccessor.path);
  expect(race.workflow.oldSha).toBe(f23.workflowSuccessor.currentBlob);
  expect(race.workflow.newSha).toBe("85f48bcb08d99531e889ad0936db8268e2e4aedc");
  expect(gitHash(authFeedbackRaw)).toBe("cc0c2d4e18777def4db57e8e15c0d73119cb64f3");
  expect(authFeedback.schema).toBe("servicedesk.p02.auth-feedback-url-surface-successor.v1");
  expect(authFeedback.precursor.path).toBe("docs/delivery/sonic-f23-owner-revocation-race-successor-20261107.json");
  expect(authFeedback.precursor.unchanged).toBe(true);
  expect(authFeedback.precursor.blob).toBe(gitHash(read(authFeedback.precursor.path)));
  expect(authFeedback.workflowSuccessor.previousBlob).toBe(race.workflow.newSha);
  expect(authFeedback.workflowSuccessor.path).toBe(race.workflow.path);
  expect(authFeedback.changedSource).toHaveLength(6);
  for(const source of authFeedback.changedSource){
   expect(source.path).not.toContain("..");
   expect(gitHash(read(source.path)),source.path).toBe(source.blob);
  }
  expect(gitHash(qaProofRaw)).toBe("963c2e44e8e5a28fcc326460840657fcbe3401af");
  expect(qaProof.schema).toBe("servicedesk.p02.qa-seed-saved-proof-successor.v1");
  expect(qaProof.previousAcceptedSource.path)
    .toBe("docs/delivery/sonic-p02-auth-feedback-surface-successor-20261107.json");
  expect(qaProof.previousAcceptedSource.unchanged).toBe(true);
  expect(qaProof.previousAcceptedSource.blob).toBe(gitHash(authFeedbackRaw));
  expect(qaProof.workflowSuccessor.path).toBe(authFeedback.workflowSuccessor.path);
  expect(qaProof.workflowSuccessor.previousBlob).toBe(authFeedback.workflowSuccessor.currentBlob);
  expect(qaProof.changedSource).toHaveLength(3);
  for(const source of qaProof.changedSource){
   expect(source.path).not.toContain("..");
   expect(gitHash(read(source.path)),source.path).toBe(source.blob);
  }
  expect(race.testScript).toBe("scripts/release/v4-f23-pg17-owner-revocation-race.sh");
  expect(race.testScriptSha).toBe("16de03429be8f4474a1f582e78eb749143723f33");
  expect(gitHash(read(race.testScript))).toBe(race.testScriptSha);
  expect(race.requiredReceipts).toEqual([
   "PG17_F23_OWNER_REVOKE_FIRST_FOR_SHARE_DENIED_NO_WRITE_PASS",
   "PG17_F23_OWNER_RELEASE_FIRST_LOCK_ROLLBACK_AND_POSITIVE_PASS",
  ]);
  const raceScript=read(race.testScript).toString();
  for(const receipt of race.requiredReceipts)expect(raceScript).toContain(receipt);
  const wf=read(race.workflow.path).toString();
  expect(wf).toContain("bash "+race.testScript);
  for(const f of f23.changedSource){
   expect(f.path).not.toContain("..");
   const reviewed=f.path===race.workflow.path?qaProof.workflowSuccessor.currentBlob:f.blob;
   expect(gitHash(read(f.path)),f.path).toBe(reviewed);
  }
  const priorWorkflow=overlay.changedFiles.find(x=>x.path===p02.workflowSuccessor.path);
  expect(priorWorkflow?.blob).toBe(p02.workflowSuccessor.previousBlob);
  for(const f of overlay.changedFiles){
   const expected=f.path===p02.workflowSuccessor.path
    ? qaProof.workflowSuccessor.currentBlob : f.blob;
   expect(gitHash(read(f.path)),f.path).toBe(expected);
  }
  for(const x of [...m.importedExactBlobs,...m.newIntegratedBlobs]){
   expect(x.path).not.toContain("..");
   // Preserve the ORIGINAL F15 lock's route SHA; IR21+ adds one explicit
   // owner request-rule panel, independently pinned to a new route blob.
   if(x.path==="src/app/app/[workspace]/inbox/page.tsx"){
    expect(x.blob).toBe("56516b7aa63750d5a46446e160e507d7481ac1ba");
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
