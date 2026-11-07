import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const read=(p:string)=>readFileSync(p);
const hash=(x:Buffer)=>createHash("sha1").update("blob "+x.length+"\0").update(x).digest("hex");
const lock=JSON.parse(read("docs/delivery/sonic-ir21-f20-finance-retention-source-lock-20261030.json").toString()) as {
 schema:string;parentIR20:string;state:string;source:Array<{path:string;sha:string;lane:string}>;
 integration:Array<{path:string;before:string|null;after:string}>;
 forbidden:string[];releaseGate:string;
};
const overlayRaw=read("docs/delivery/sonic-f15-f20-post-lock-ui-guard-20261106.json");
const overlay=JSON.parse(overlayRaw.toString()) as {
 schema:string;baseHead:string;
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

const quoteCrewRaw=read("docs/delivery/sonic-f23-quote-crew-lock-races-successor-20261107.json");
const quoteCrew=JSON.parse(quoteCrewRaw.toString()) as {
 schema:string;
 priorVerifiedSource:{path:string;blob:string;unchanged:boolean};
 workflowSuccessor:{path:string;previousBlob:string;currentBlob:string};
 newRaces:Array<{path:string;blob:string;expectedReceipts:string[];scope:string}>;
 flagsDefaultOff:string[];releaseVeto:string[];
};
const resetRaw=read("docs/delivery/sonic-p02-reset-session-closure-successor-20261107.json");
const reset=JSON.parse(resetRaw.toString()) as {
 schema:string;
 priorVerifiedSource:{path:string;blob:string;unchanged:boolean};
 historicAuthFeedback:{path:string;blob:string;unchanged:boolean};
 workflowSuccessor:{path:string;previousBlob:string;currentBlob:string};
 overrides:Array<{path:string;previousBlob:string;currentBlob:string}>;
 addedSource:Array<{path:string;blob:string}>;
};
const negativeRlsRaw=read("docs/delivery/sonic-p02-foreign-rls-negative-probe-successor-20261107.json");
const negativeRls=JSON.parse(negativeRlsRaw.toString()) as {
 schema:string;
 priorReviewed:{path:string;blob:string;unchanged:boolean};
 workflowSuccessor:{path:string;previousReviewedBlob:string;f23WitnessInterimBlob:string;currentBlob:string};
 changedSource:Array<{path:string;previousBlob:string|null;currentBlob:string;purpose:string}>;
 simultaneousF23Veto:{path:string;blob:string;testScope:string;witnessMarker:string;isAcceptance:boolean;releasePermission:boolean};
 guards:string[];
};
const prototypeBridgeRaw=read("docs/delivery/sonic-p02-f23-prototype-integration-bridge-20261107.json");
const prototypeBridge=JSON.parse(prototypeBridgeRaw.toString()) as {
 schema:string;
 predecessor:{path:string;blob:string;unchanged:boolean};
 workflowSuccessor:{path:string;previousBlob:string;currentBlob:string};
 externalF23ReviewOnly:{path:string;blob:string;disposablePg17Only:boolean;productionInstallApproved:boolean};
 existingF23VetoUnchanged:{path:string;blob:string;marker:string};
 integrationRules:string[];
};



function expectedReviewedBlob(path:string,historicSha:string):string {
 const entry=overlay.replacements.find(item=>item.path===path);
 if(!entry)return historicSha;
 expect(entry.priorBlob,path+" must preserve original source provenance").toBe(historicSha);
 return entry.newBlob;
}
describe("IR21 exact owner finance + retention source integration",()=>{
 it("pins seven independent finance, retention and critic Git objects",()=>{
  expect(lock.schema).toBe("servicedesk.ir21.f20.owner-verified-finance-retention.v1");
  expect(lock.parentIR20).toBe("4fbc62a16feeb1c08a8dfe7ac0a493ad9b722dfe");
  expect(lock.state).toBe("SOURCE_ONLY_DRAFT_UNMERGED");
  expect(lock.source).toHaveLength(7);
  expect(new Set(lock.source.map(x=>x.path)).size).toBe(7);
  expect(new Set(lock.source.map(x=>x.lane)).size).toBe(3);
  expect(hash(overlayRaw)).toBe("73f0dad66c31dc676b83b58ae17cd2f9f611f688");
  expect(overlay.schema).toBe("servicedesk.f15-f20.post-lock-ui-guard.v1");
  expect(overlay.originalLocks).toContainEqual({
   path:"docs/delivery/sonic-ir21-f20-finance-retention-source-lock-20261030.json",
   blob:"0f1a19568e70fd0209a353876f74d79ad4db0952",
  });
  expect(overlay.replacements).toHaveLength(6);
  expect(overlay.changedFiles).toHaveLength(8);
  expect(hash(p02Raw)).toBe("daedeb155f8d11dfb245b3cca709b20205e400d3");
  expect(p02.schema).toBe("servicedesk.p02.registered-owner-ui-source-successor.v1");
  expect(p02.originalF15F20Overlay.blob).toBe(hash(overlayRaw));
  expect(p02.originalF15F20Overlay.unchanged).toBe(true);
  expect(p02.changedSource).toHaveLength(5);
  for(const source of p02.changedSource){
   expect(source.path).not.toContain("..");
   expect(hash(read(source.path)),source.path).toBe(source.blob);
  }
  expect(f23.schema).toBe("servicedesk.f23.atomic-hold-release.transactional-source.v1");
  expect(f23.historicP02ManifestBlob).toBe(hash(p02Raw));
  expect(f23.workflowSuccessor.previousBlob).toBe(p02.workflowSuccessor.currentBlob);
  expect(f23.workflowSuccessor.path).toBe(p02.workflowSuccessor.path);
  expect(f23.changedSource).toHaveLength(9);
  expect(race.schema).toBe("servicedesk.f23.owner-revocation-race-successor.v1");
  expect(race.historicalLock.path).toBe("docs/delivery/sonic-f23-atomic-release-transactional-source-lock-20261107.json");
  expect(race.historicalLock.sha).toBe("15e909b7abcd4e7ee571646d0b8314dfed1c0a60");
  expect(race.historicalLock.unchanged).toBe(true);
  expect(hash(read(race.historicalLock.path))).toBe(race.historicalLock.sha);
  expect(race.workflow.path).toBe(f23.workflowSuccessor.path);
  expect(race.workflow.oldSha).toBe(f23.workflowSuccessor.currentBlob);
  expect(race.workflow.newSha).toBe("85f48bcb08d99531e889ad0936db8268e2e4aedc");
  expect(hash(authFeedbackRaw)).toBe("cc0c2d4e18777def4db57e8e15c0d73119cb64f3");
  expect(authFeedback.schema).toBe("servicedesk.p02.auth-feedback-url-surface-successor.v1");
  expect(authFeedback.precursor.path).toBe("docs/delivery/sonic-f23-owner-revocation-race-successor-20261107.json");
  expect(authFeedback.precursor.unchanged).toBe(true);
  expect(authFeedback.precursor.blob).toBe(hash(read(authFeedback.precursor.path)));
  expect(authFeedback.workflowSuccessor.previousBlob).toBe(race.workflow.newSha);
  expect(authFeedback.workflowSuccessor.path).toBe(race.workflow.path);
  expect(authFeedback.changedSource).toHaveLength(6);
  for(const source of authFeedback.changedSource){
   expect(source.path).not.toContain("..");
   const successor=reset.overrides.find(x=>x.path===source.path);
   if(successor)expect(successor.previousBlob,source.path).toBe(source.blob);
   expect(hash(read(source.path)),source.path)
     .toBe(successor?.currentBlob??source.blob);
  }
  expect(hash(qaProofRaw)).toBe("963c2e44e8e5a28fcc326460840657fcbe3401af");
  expect(qaProof.schema).toBe("servicedesk.p02.qa-seed-saved-proof-successor.v1");
  expect(qaProof.previousAcceptedSource.path)
    .toBe("docs/delivery/sonic-p02-auth-feedback-surface-successor-20261107.json");
  expect(qaProof.previousAcceptedSource.unchanged).toBe(true);
  expect(qaProof.previousAcceptedSource.blob).toBe(hash(authFeedbackRaw));
  expect(qaProof.workflowSuccessor.path).toBe(authFeedback.workflowSuccessor.path);
  expect(qaProof.workflowSuccessor.previousBlob).toBe(authFeedback.workflowSuccessor.currentBlob);
  expect(qaProof.changedSource).toHaveLength(3);
  expect(hash(quoteCrewRaw)).toBe("e77c6661c19eca10e7e5e57f34b28c2c2362ed91");
  expect(quoteCrew.schema).toBe("servicedesk.f23.quote-crew-lock-races-successor.v1");
  expect(quoteCrew.priorVerifiedSource.path).toBe("docs/delivery/sonic-p02-qa-seed-saved-proof-successor-20261107.json");
  expect(quoteCrew.priorVerifiedSource.blob).toBe(hash(qaProofRaw));
  expect(quoteCrew.priorVerifiedSource.unchanged).toBe(true);
  expect(quoteCrew.workflowSuccessor.path).toBe(qaProof.workflowSuccessor.path);
  expect(quoteCrew.workflowSuccessor.previousBlob).toBe(qaProof.workflowSuccessor.currentBlob);
  expect(quoteCrew.workflowSuccessor.currentBlob).toBe("8c2cab1749d363309d5c89cce9a6980084019202");
  expect(hash(resetRaw)).toBe("a50e9f4b61f0b0481aae9bf7e377faa839b7b944");
  expect(reset.schema).toBe("servicedesk.p02.password-reset-session-closure-successor.v1");
  expect(reset.priorVerifiedSource.path).toBe("docs/delivery/sonic-f23-quote-crew-lock-races-successor-20261107.json");
  expect(reset.priorVerifiedSource.unchanged).toBe(true);
  expect(reset.priorVerifiedSource.blob).toBe(hash(quoteCrewRaw));
  expect(reset.historicAuthFeedback.blob).toBe(hash(authFeedbackRaw));
  expect(reset.historicAuthFeedback.unchanged).toBe(true);
  expect(reset.workflowSuccessor.path).toBe(quoteCrew.workflowSuccessor.path);
  expect(reset.workflowSuccessor.previousBlob).toBe(quoteCrew.workflowSuccessor.currentBlob);
  expect(hash(negativeRlsRaw)).toBe("efdebce4aab449dbf804805ea202653f19279dd7");
  expect(negativeRls.schema).toBe("servicedesk.p02.foreign-rls-negative-probe-and-f23-veto.v1");
  expect(negativeRls.priorReviewed.path).toBe("docs/delivery/sonic-p02-reset-session-closure-successor-20261107.json");
  expect(negativeRls.priorReviewed.unchanged).toBe(true);
  expect(negativeRls.priorReviewed.blob).toBe(hash(resetRaw));
  expect(negativeRls.workflowSuccessor.path).toBe(reset.workflowSuccessor.path);
  expect(negativeRls.workflowSuccessor.previousReviewedBlob).toBe(reset.workflowSuccessor.currentBlob);
  expect(negativeRls.workflowSuccessor.f23WitnessInterimBlob).toBe("122a1afcc1f05624e62408551b5054944967e6eb");
  expect(negativeRls.changedSource).toHaveLength(2);
  for(const source of negativeRls.changedSource){
   expect(source.path).not.toContain("..");
   expect(hash(read(source.path)),source.path).toBe(source.currentBlob);
  }
  expect(negativeRls.changedSource[0].previousBlob).toBe("e5998a74c176172653fa9782ace23eaadfcbc7a8");
  expect(negativeRls.changedSource[1].previousBlob).toBeNull();
  const negativeScript=read(negativeRls.changedSource[0].path).toString();
  expect(negativeScript).toContain("table === \"memberships\" && ownScope");
  expect(negativeScript).toContain("table === \"workspace_branches\" && ownScope");
  expect(negativeRls.guards).toContain("FOREIGN_ANY_ROW_IS_RLS_VETO");
  expect(hash(prototypeBridgeRaw)).toBe("47b9619a854b29f9f3d3bf560d11d734b7effb8c");
  expect(prototypeBridge.schema).toBe("servicedesk.p02-f23.review-only-prototype-source-bridge.v1");
  expect(prototypeBridge.predecessor.path).toBe("docs/delivery/sonic-p02-foreign-rls-negative-probe-successor-20261107.json");
  expect(prototypeBridge.predecessor.unchanged).toBe(true);
  expect(prototypeBridge.predecessor.blob).toBe(hash(negativeRlsRaw));
  expect(prototypeBridge.workflowSuccessor.previousBlob).toBe(negativeRls.workflowSuccessor.currentBlob);
  expect(prototypeBridge.workflowSuccessor.path).toBe(negativeRls.workflowSuccessor.path);
  expect(prototypeBridge.externalF23ReviewOnly.disposablePg17Only).toBe(true);
  expect(prototypeBridge.externalF23ReviewOnly.productionInstallApproved).toBe(false);
  expect(prototypeBridge.integrationRules).toContain("F23_KNOWN_UNSAFE_SIBLING_QUOTE_VETO_RETAINED");
  expect(hash(read(prototypeBridge.externalF23ReviewOnly.path)))
    .toBe(prototypeBridge.externalF23ReviewOnly.blob);
  expect(prototypeBridge.existingF23VetoUnchanged.path).toBe(negativeRls.simultaneousF23Veto.path);
  expect(prototypeBridge.existingF23VetoUnchanged.blob).toBe(negativeRls.simultaneousF23Veto.blob);
  expect(hash(read(prototypeBridge.existingF23VetoUnchanged.path)))
    .toBe(prototypeBridge.existingF23VetoUnchanged.blob);
  expect(prototypeBridge.existingF23VetoUnchanged.marker)
    .toBe(negativeRls.simultaneousF23Veto.witnessMarker);
  expect(read(prototypeBridge.workflowSuccessor.path).toString())
    .toContain("bash "+prototypeBridge.externalF23ReviewOnly.path);

  expect(negativeRls.simultaneousF23Veto.testScope).toBe("PG17_DISPOSABLE_ONLY");
  expect(negativeRls.simultaneousF23Veto.isAcceptance).toBe(false);
  expect(negativeRls.simultaneousF23Veto.releasePermission).toBe(false);
  expect(hash(read(negativeRls.simultaneousF23Veto.path)))
    .toBe(negativeRls.simultaneousF23Veto.blob);
  const witnessText=read(negativeRls.simultaneousF23Veto.path).toString();
  expect(witnessText).toContain(negativeRls.simultaneousF23Veto.witnessMarker);
  const combinedWorkflow=read(negativeRls.workflowSuccessor.path).toString();
  expect(combinedWorkflow).toContain("node --test scripts/release/v4-p02-two-owner-readonly-acceptance.test.mjs");
  expect(combinedWorkflow).toContain("bash "+negativeRls.simultaneousF23Veto.path);

  expect(reset.overrides).toHaveLength(2);
  expect(reset.overrides.map(x=>x.path).sort()).toEqual([
   "src/app/auth/reset-password/page.tsx",
   "src/features/auth/verified-auth-feedback.ts",
  ]);
  for(const change of reset.overrides){
   const before=authFeedback.changedSource.find(x=>x.path===change.path);
   expect(change.previousBlob,change.path).toBe(before?.blob);
   expect(hash(read(change.path)),change.path).toBe(change.currentBlob);
  }
  expect(reset.addedSource).toHaveLength(2);
  for(const source of reset.addedSource){
   expect(source.path).not.toContain("..");
   expect(hash(read(source.path)),source.path).toBe(source.blob);
  }
  expect(quoteCrew.newRaces).toHaveLength(2);
  expect(new Set(quoteCrew.newRaces.map(r=>r.path)).size).toBe(2);
  expect(quoteCrew.flagsDefaultOff).toEqual([
   "SERVICEDESK_F23_OWNER_HOLD_RELEASE_ENABLED",
   "SERVICEDESK_F23_ATOMIC_RELEASE_APPROVED",
  ]);
  expect(quoteCrew.releaseVeto).toContain("QUOTE_PHANTOM_WHOLE_REQUEST_UNPROVEN");
  const workflowText=read(quoteCrew.workflowSuccessor.path).toString();
  for(const lane of quoteCrew.newRaces){
   expect(lane.path).not.toContain("..");
   expect(hash(read(lane.path)),lane.path).toBe(lane.blob);
   expect(lane.expectedReceipts).toHaveLength(2);
   expect(workflowText).toContain("bash "+lane.path);
   const script=read(lane.path).toString();
   for(const receipt of lane.expectedReceipts)expect(script).toContain(receipt);
  }

  for(const source of qaProof.changedSource){
   expect(source.path).not.toContain("..");
   expect(hash(read(source.path)),source.path).toBe(source.blob);
  }
  expect(race.testScript).toBe("scripts/release/v4-f23-pg17-owner-revocation-race.sh");
  expect(race.testScriptSha).toBe("16de03429be8f4474a1f582e78eb749143723f33");
  expect(hash(read(race.testScript))).toBe(race.testScriptSha);
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
   const reviewed=f.path===race.workflow.path?prototypeBridge.workflowSuccessor.currentBlob:f.blob;
   expect(hash(read(f.path)),f.path).toBe(reviewed);
  }
  const priorWorkflow=overlay.changedFiles.find(x=>x.path===p02.workflowSuccessor.path);
  expect(priorWorkflow?.blob).toBe(p02.workflowSuccessor.previousBlob);
  for(const file of overlay.changedFiles){
   const reviewedSha=file.path===p02.workflowSuccessor.path
    ? prototypeBridge.workflowSuccessor.currentBlob : file.blob;
   expect(hash(read(file.path)),file.path).toBe(reviewedSha);
  }
  for(const f of lock.source){
   expect(f.path).not.toContain("..");
   expect(hash(read(f.path)),f.path).toBe(expectedReviewedBlob(f.path,f.sha));
  }
  for(const path of ["src/features/operations/OwnerLedgerExceptionReview.tsx",
    "src/features/operations/OwnerConsentedRetentionReview.tsx"]){
   const entry=overlay.replacements.find(item=>item.path===path);
   expect(entry).toBeDefined();
   expect(entry?.priorBlob).toMatch(/^[a-f0-9]{40}$/);
   const source=read(path).toString();
   expect(source).toContain("pending.current");
   expect(source).toContain("useCallback");
   expect(source).not.toContain("sendEmail(");
   expect(source).not.toContain("chargeCard(");
  }
 });
 it("confines new on-screen review buttons to signed-in authorized ALL-branch owner",()=>{
  expect(lock.integration).toHaveLength(3);
  for(const f of lock.integration)expect(hash(read(f.path)),f.path).toBe(f.after);
  const gate=read("src/features/operations/F20OwnerSourceReviewGate.tsx").toString();
  expect(gate).toContain('s.value.actor.role!=="OWNER"');
  expect(gate).toContain('s.value.branchScope?.mode!=="ALL"');
  expect(gate).toContain("loadOperationalStaffSnapshot(workspaceSlug)");
  const invoices=read("src/app/app/[workspace]/invoices/page.tsx").toString();
  const customers=read("src/app/app/[workspace]/customers/page.tsx").toString();
  expect(invoices).toContain('surface="invoices"');
  expect(customers).toContain('surface="customers"');
  expect(invoices).toContain('module="invoices"');
  expect(customers).toContain('module="customers"');
 });
 it("retains the no-external-action launch boundary",()=>{
  expect(lock.forbidden).toContain("CANONICAL_MERGE");
  expect(lock.forbidden).toContain("AUTO_OUTREACH");
  expect(lock.forbidden).toContain("PAYMENT_SETTLEMENT");
  expect(lock.forbidden).toContain("PROVIDER_SEND");
  expect(lock.releaseGate).toBe("P02_818_OPEN_AND_P03_819_QUEUED");
 });
});
