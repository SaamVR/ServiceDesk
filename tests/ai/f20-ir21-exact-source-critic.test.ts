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
const p03CurrencyRaw=read("docs/delivery/sonic-p03-currency-first-run-ux-source-successor-20261107.json");
const workspaceTransportRaw=read("docs/delivery/sonic-p02-workspace-rpc-transport-uncertainty-successor-20261107.json");
const workspaceTransport=JSON.parse(workspaceTransportRaw.toString()) as {
  schema:string;batchId:string;
  predecessor:{path:string;blob:string;unchanged:boolean};
  p03CurrencyPredecessor:{path:string;blob:string;unchanged:boolean};
  changedSource:Array<{path:string;previousBlob:string;currentBlob:string}>;
  acceptance:string;invariants:string[];
};

const p03Currency=JSON.parse(p03CurrencyRaw.toString()) as {
 schema:string;predecessor:{path:string;blob:string;unchanged:boolean};
 changedSource:Array<{path:string;previousBlob:string;currentBlob:string;purpose:string}>;
 safetySourceUnchanged:{path:string;blob:string;guard:string};
 releaseState:string;explicitNonActions:string[];
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
const resetRetryRaw=read("docs/delivery/sonic-p02-reset-retry-form-suppression-20261107.json");

const signInAuditRaw=read("docs/delivery/sonic-p02-signin-verified-session-successor-20261107.json");
const signInAudit=JSON.parse(signInAuditRaw.toString()) as {
 schema:string;batch:string;sourceOnly:boolean;
 predecessor:{path:string;blob:string;unchanged:boolean};
 sourceChange:{path:string;previousBlob:string;currentBlob:string};
 newAdversarialTest:{path:string;blob:string;cases:number};
 focusedWorkflow:{path:string;previousBlob:string;currentBlob:string};
 requiredGuards:string[];
};
const signupConfirmTransportRaw=read("docs/delivery/sonic-p02-signup-confirm-transport-successor-20261107.json");
const signupConfirmTransport=JSON.parse(signupConfirmTransportRaw.toString()) as {
 schema:string;batchId:string;sourceOnly:boolean;parentHead:string;reviewedSourceHead:string;
 predecessor:{path:string;blob:string;unchanged:boolean};
 changedSource:Array<{path:string;previousBlob:string;currentBlob:string}>;
 addedAdversarialTest:{path:string;previousBlob:null;currentBlob:string;cases:number};
 focusedWorkflow:{path:string;previousBlob:string;currentBlob:string};
 requiredGuards:string[];acceptanceState:string;releaseGate:string;
};
const signupUserReceiptRaw=read("docs/delivery/sonic-p02-signup-user-receipt-successor-20261107.json");
const signupUserReceipt=JSON.parse(signupUserReceiptRaw.toString()) as {
  schema:string;batchId:string;sourceOnly:boolean;parentHead:string;
  predecessor:{path:string;blob:string;unchanged:boolean};
  changedSource:Array<{path:string;previousBlob:string;currentBlob:string}>;
  testCases:number;
  unchangedSource:Array<{path:string;blob:string;unchanged:boolean}>;
  requiredGuards:string[];acceptanceState:string;
};
const resetRetry=JSON.parse(resetRetryRaw.toString()) as {
 schema:string;scope:string;
 previousReviewed:{path:string;blob:string;unchanged:boolean};
 reviewedPage:{path:string;oldBlob:string;newBlob:string};
 reviewedTest:{path:string;oldBlob:string;newBlob:string};
 focusedWorkflow:{path:string;oldBlob:string;newBlob:string};
 guards:string[];
};
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
const f23VetoRaw=read("docs/delivery/sonic-f23-sibling-quote-phantom-veto-successor-20261107.json");
const f23Veto=JSON.parse(f23VetoRaw.toString()) as {
 schema:string;classification:string;
 predecessor:{path:string;blob:string;unchanged:boolean};
 workflowSuccessor:{path:string;previousBlob:string;currentBlob:string};
 reviewedCandidate:{path:string;blob:string;installed:boolean;unsafeSiblingPhantom:boolean};
 sources:Array<{path:string;blob:string;type:string;receipt?:string;passedMeansSafe:boolean}>;
 additionalPrototypeReceipts:string[];flagsDefaultOff:string[];unresolved:string[];nonActions:string[];
};
const writerAuditRaw=read("docs/delivery/sonic-f23-quote-writer-compatibility-source-successor-20261107.json");
const writerAudit=JSON.parse(writerAuditRaw.toString()) as {
 schema:string;classification:string;
 priorVerifiedVeto:{path:string;blob:string;unchanged:boolean};
 workflowSuccessor:{path:string;previousBlob:string;currentBlob:string};
 changedSource:Array<{path:string;blob:string;lane:string;isProductionApproved:boolean}>;
 sourcePreimagesUnchanged:Array<{path:string;blob:string}>;
 requiredReadOnlyPreflightFields:string[];releaseVeto:string[];
 activationFlagsDefaultOff:string[];notClaims:string[];
};
const literalCriticRaw=read("docs/delivery/sonic-f23-readonly-literal-critic-successor-20261107.json");
const literalCritic=JSON.parse(literalCriticRaw.toString()) as {
 schema:string;scope:string;
 priorReviewed:{path:string;blob:string;unchanged:boolean};
 reviewedReplacement:{path:string;previousBlob:string;currentBlob:string;intent:string};
 securityPreflight:{path:string;blob:string;unchanged:boolean};
 activationFlagsRemainOff:string[];veto:string[];
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
  expect(hash(p03CurrencyRaw)).toBe("d7648d1fd14e3e58f584cb0f03e5a386e4c3087d");
  expect(p03Currency.schema).toBe("servicedesk.p03.currency-first-run-owner-ux-source-successor.v1");
  expect(p03Currency.predecessor.path).toBe("docs/delivery/sonic-p02-registered-owner-ui-source-successor-20261106.json");
  expect(p03Currency.predecessor.blob).toBe(hash(p02Raw));
  expect(p03Currency.predecessor.unchanged).toBe(true);
  expect(p03Currency.changedSource.map(x=>x.path)).toEqual([
   "src/app/auth/create-workspace/page.tsx",
   "tests/e2e/p02-workspace-error-origin.test.ts",
  ]);
  expect(hash(workspaceTransportRaw)).toBe("2e0c0fd319fce1b72ea679768181af3207dba9b4");
  expect(workspaceTransport.schema).toBe("servicedesk.p02.owner-workspace-transport-uncertainty.v1");
  expect(workspaceTransport.predecessor.path).toBe("docs/delivery/sonic-p02-registered-owner-ui-source-successor-20261106.json");
  expect(workspaceTransport.predecessor.blob).toBe(hash(p02Raw));
  expect(workspaceTransport.predecessor.unchanged).toBe(true);
  expect(workspaceTransport.p03CurrencyPredecessor.blob).toBe(hash(p03CurrencyRaw));
  expect(workspaceTransport.p03CurrencyPredecessor.unchanged).toBe(true);
  expect(workspaceTransport.changedSource.map(x=>x.path)).toEqual([
    "src/app/auth/create-workspace/actions.ts",
    "tests/e2e/p02-registration-denial-action.test.ts",
  ]);
  for(const source of p02.changedSource){
   expect(source.path).not.toContain("..");
   const replacement=p03Currency.changedSource.find(x=>x.path===source.path);
   if(replacement)expect(replacement.previousBlob,source.path).toBe(source.blob);
   const transport=workspaceTransport.changedSource.find(x=>x.path===source.path);
   if(transport)expect(transport.previousBlob,source.path).toBe(replacement?.currentBlob??source.blob);
   expect(hash(read(source.path)),source.path)
     .toBe(transport?.currentBlob??replacement?.currentBlob??source.blob);
  }
  expect(workspaceTransport.invariants).toContain("NO_AUTOMATIC_SECOND_REGISTRATION_ATTEMPT");
  expect(workspaceTransport.invariants).toContain("P02_REMAINS_OPEN");
  const pricingGuard=p03Currency.safetySourceUnchanged;
  expect(hash(read(pricingGuard.path))).toBe(pricingGuard.blob);
  expect(read(pricingGuard.path).toString()).toContain(pricingGuard.guard);
  expect(read("src/app/auth/create-workspace/page.tsx").toString())
   .toContain("First-run cleaning pricing currently supports USD branches only.");
  expect(p03Currency.explicitNonActions).toContain("NO_CONNECTED_DB_WRITE");
  expect(p03Currency.releaseState).toContain("P03_OPEN_0_OF_6");
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
   if(source.path===resetRetry.reviewedPage.path)
     expect(resetRetry.reviewedPage.oldBlob).toBe(successor?.currentBlob);
   expect(hash(read(source.path)),source.path)
     .toBe(source.path===resetRetry.reviewedPage.path
       ?resetRetry.reviewedPage.newBlob:successor?.currentBlob??source.blob);
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
  expect(hash(f23VetoRaw)).toBe("f8f8431210cbcaea474dd729b127629176a9c568");
  expect(hash(writerAuditRaw)).toBe("3844882993a074b6c722e2c2391cc9da1e196c9f");
  expect(writerAudit.schema).toBe("servicedesk.f23.quote-writer-compatibility-and-readonly-dba-preflight.v1");
  expect(writerAudit.classification).toBe("SOURCE_AUDIT_AND_DISPOSABLE_PG17_ONLY_NOT_PRODUCTION_READY");
  expect(writerAudit.priorVerifiedVeto.path).toBe("docs/delivery/sonic-f23-sibling-quote-phantom-veto-successor-20261107.json");
  expect(writerAudit.priorVerifiedVeto.blob).toBe(hash(f23VetoRaw));
  expect(writerAudit.priorVerifiedVeto.unchanged).toBe(true);
  expect(writerAudit.workflowSuccessor.path).toBe(f23Veto.workflowSuccessor.path);
  expect(writerAudit.workflowSuccessor.previousBlob).toBe(f23Veto.workflowSuccessor.currentBlob);
  expect(writerAudit.workflowSuccessor.currentBlob).toBe("634d35b6eb34025df560b78f0dfbe3354988238c");
  expect(hash(literalCriticRaw)).toBe("960f9b9a03f104f7a68f60e316c734d7a128a95e");
  expect(literalCritic.schema).toBe("servicedesk.f23.readonly-sql-literal-critic-successor.v1");
  expect(literalCritic.priorReviewed.path).toBe("docs/delivery/sonic-f23-quote-writer-compatibility-source-successor-20261107.json");
  expect(literalCritic.priorReviewed.unchanged).toBe(true);
  expect(literalCritic.priorReviewed.blob).toBe(hash(writerAuditRaw));
  expect(literalCritic.reviewedReplacement.path).toBe("tests/ai/f23-current-quote-schema-compatibility-veto.test.ts");
  expect(literalCritic.reviewedReplacement.previousBlob).toBe("7b51bef9c828705a75bf8cc0a915a983550b638f");
  expect(literalCritic.reviewedReplacement.currentBlob).toBe("11b477ec83b4fca7038e649c6272089121ebb85d");
  expect(hash(read(literalCritic.reviewedReplacement.path))).toBe(literalCritic.reviewedReplacement.currentBlob);
  expect(literalCritic.securityPreflight.path).toBe(writerAudit.changedSource[0].path);
  expect(literalCritic.securityPreflight.unchanged).toBe(true);
  expect(literalCritic.securityPreflight.blob).toBe(writerAudit.changedSource[0].blob);
  expect(hash(read(literalCritic.securityPreflight.path))).toBe(literalCritic.securityPreflight.blob);
  expect(literalCritic.activationFlagsRemainOff).toEqual(writerAudit.activationFlagsDefaultOff);
  expect(literalCritic.veto).toContain("F23_SIBLING_QUOTE_PHANTOM_UNRESOLVED");
  expect(writerAudit.changedSource).toHaveLength(3);
  expect(new Set(writerAudit.changedSource.map(x=>x.path)).size).toBe(3);
  for(const f of writerAudit.changedSource){
   expect(f.path).not.toContain("..");
   expect(f.isProductionApproved).toBe(false);
   if(f.path===literalCritic.reviewedReplacement.path){
    expect(f.blob).toBe(literalCritic.reviewedReplacement.previousBlob);
   }
   const current=f.path===literalCritic.reviewedReplacement.path
    ?literalCritic.reviewedReplacement.currentBlob:f.blob;
   expect(hash(read(f.path)),f.path).toBe(current);
  }
  expect(writerAudit.sourcePreimagesUnchanged).toHaveLength(4);
  for(const f of writerAudit.sourcePreimagesUnchanged){
   expect(f.path).not.toContain("..");
   expect(hash(read(f.path)),f.path).toBe(f.blob);
  }
  expect(writerAudit.releaseVeto).toContain("LEGACY_TWO_CALL_QUOTE_REVISION_NOT_PROVEN_ATOMIC");
  expect(writerAudit.activationFlagsDefaultOff).toEqual([
   "SERVICEDESK_F23_OWNER_HOLD_RELEASE_ENABLED",
   "SERVICEDESK_F23_ATOMIC_RELEASE_APPROVED",
  ]);
  expect(writerAudit.notClaims).toContain("NO_MIGRATION");
  const preflight=read(writerAudit.changedSource[0].path).toString();
  expect(preflight).toContain("repeatable read read only");
  expect(preflight).toContain("'identifiersReturned',false");
  const workflowNow=read(writerAudit.workflowSuccessor.path).toString();
  expect(workflowNow).toContain("tests/ai/f23-current-quote-schema-compatibility-veto.test.ts");
  expect(workflowNow.split("scripts/release/v4-f23-current-quote-readonly-preflight.sql").length-1).toBe(2);
  expect(f23Veto.schema).toBe("servicedesk.f23.sibling-quote-phantom-veto-and-review-prototype.v1");
  expect(f23Veto.classification).toBe("SECURITY_VETO_CONFIRMED_ON_DISPOSABLE_PG17__NO_PRODUCTION_APPROVAL");
  expect(f23Veto.predecessor.path).toBe("docs/delivery/sonic-p02-foreign-rls-negative-probe-successor-20261107.json");
  expect(f23Veto.predecessor.blob).toBe(hash(negativeRlsRaw));
  expect(f23Veto.predecessor.unchanged).toBe(true);
  expect(f23Veto.workflowSuccessor.path).toBe(negativeRls.workflowSuccessor.path);
  expect(f23Veto.workflowSuccessor.previousBlob).toBe(negativeRls.workflowSuccessor.currentBlob);
  expect(f23Veto.workflowSuccessor.currentBlob).toBe(prototypeBridge.workflowSuccessor.currentBlob);
  expect(f23Veto.reviewedCandidate.installed).toBe(false);
  expect(f23Veto.reviewedCandidate.unsafeSiblingPhantom).toBe(true);
  expect(hash(read(f23Veto.reviewedCandidate.path))).toBe(f23Veto.reviewedCandidate.blob);
  expect(f23Veto.sources).toHaveLength(3);
  expect(new Set(f23Veto.sources.map(f=>f.path)).size).toBe(3);
  const newF23Workflow=read(f23Veto.workflowSuccessor.path).toString();
  for(const source of f23Veto.sources){
   expect(source.path).not.toContain("..");
   expect(hash(read(source.path)),source.path).toBe(source.blob);
   expect(source.passedMeansSafe).toBe(false);
   if(source.path.endsWith(".sh")){
    expect(newF23Workflow).toContain("bash "+source.path);
    expect(read(source.path).toString()).toContain(source.receipt??"");
   }
  }
  expect(f23Veto.sources[0].type).toBe("UNSAFE_GAP_WITNESS");
  expect(f23Veto.sources[0].receipt).toBe("F23_KNOWN_UNSAFE_SIBLING_QUOTE_PHANTOM_REPRODUCED_RELEASE_VETO");
  expect(f23Veto.sources[1].type).toBe("DISPOSABLE_INDEX_PROTOTYPE");
  expect(f23Veto.sources[2].type).toBe("DBA_VETO_AND_REMEDIATION_OPTIONS");
  expect(f23Veto.flagsDefaultOff).toEqual([
   "SERVICEDESK_F23_OWNER_HOLD_RELEASE_ENABLED",
   "SERVICEDESK_F23_ATOMIC_RELEASE_APPROVED",
  ]);
  expect(f23Veto.unresolved).toContain("DUPLICATE_EXISTING_QUOTES_READ_ONLY_PREFLIGHT");
  expect(f23Veto.nonActions).toContain("NO_SUPABASE_MIGRATION");
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

  expect(hash(resetRetryRaw)).toBe("96b3557377f5fc364fee6682045224116f9c2acd");
  expect(resetRetry.schema).toBe("servicedesk.p02.reset-signout-uncertain-form-suppression.v1");
  expect(resetRetry.previousReviewed.path).toBe("docs/delivery/sonic-p02-reset-session-closure-successor-20261107.json");
  expect(resetRetry.previousReviewed.blob).toBe(hash(resetRaw));
  expect(resetRetry.previousReviewed.unchanged).toBe(true);
  expect(resetRetry.reviewedPage.path).toBe("src/app/auth/reset-password/page.tsx");
  expect(resetRetry.reviewedPage.oldBlob).toBe(reset.overrides.find(x=>x.path===resetRetry.reviewedPage.path)?.currentBlob);
  expect(hash(read(resetRetry.reviewedPage.path))).toBe(resetRetry.reviewedPage.newBlob);
  expect(hash(read(resetRetry.reviewedTest.path))).toBe(resetRetry.reviewedTest.newBlob);
  expect(resetRetry.focusedWorkflow.oldBlob).toBe("0e1ba6155a55182e25c3831b2f46093037d71dc3");
  expect(hash(signInAuditRaw)).toBe("355217845c497dd3199ebc0cd3bdac58779ff53f");
  expect(signInAudit.schema).toBe("servicedesk.p02.sign-in-verified-returned-session.v1");
  expect(signInAudit.predecessor.path).toBe("docs/delivery/sonic-p02-reset-retry-form-suppression-20261107.json");
  expect(signInAudit.predecessor.unchanged).toBe(true);
  expect(signInAudit.predecessor.blob).toBe(hash(resetRetryRaw));
  expect(signInAudit.sourceChange.path).toBe("src/app/auth/sign-in/actions.ts");
  expect(signInAudit.sourceChange.previousBlob).toBe("17bccf3e88b0935f5fa184fc7e9ffa2225423498");
  expect(hash(read(signInAudit.sourceChange.path))).toBe(signInAudit.sourceChange.currentBlob);
  expect(signInAudit.newAdversarialTest.cases).toBe(7);
  expect(hash(read(signInAudit.newAdversarialTest.path))).toBe(signInAudit.newAdversarialTest.blob);
  expect(signInAudit.focusedWorkflow.path).toBe(resetRetry.focusedWorkflow.path);
  expect(signInAudit.focusedWorkflow.previousBlob).toBe(resetRetry.focusedWorkflow.newBlob);
  expect(signInAudit.focusedWorkflow.currentBlob).toBe("720495c3087c369249fe19495cb86c2461a0abca");
   // A new reviewed successor extends, rather than rewrites, the immutable sign-in lock.
   expect(signupConfirmTransport.schema).toBe("servicedesk.p02.signup-confirm-transport-error-successor.v1");
   expect(signupConfirmTransport.sourceOnly).toBe(true);
   expect(signupConfirmTransport.parentHead).toBe("3c23c5d1188030e3ff595e16144420ba97c1c998");
   expect(signupConfirmTransport.reviewedSourceHead).toBe("0603cc22a9b9268ee5f185c31517c56904a6395a");
   expect(signupConfirmTransport.predecessor).toEqual({
     path:"docs/delivery/sonic-p02-signin-verified-session-successor-20261107.json",
     blob:"355217845c497dd3199ebc0cd3bdac58779ff53f",unchanged:true,
   });
   expect(signupConfirmTransport.predecessor.blob).toBe(hash(signInAuditRaw));
   expect(signupConfirmTransport.changedSource).toEqual([
     {path:"src/app/auth/sign-up/actions.ts",previousBlob:"87e77031039506fd4ee7c5d9c8f2387b9821e821",currentBlob:"3e925d4ec220f7264e5c6407c42e2670be5cebef"},
     {path:"src/app/auth/confirm/route.ts",previousBlob:"6b9abb0efb56d597ee258d87faae93693b89d100",currentBlob:"4ab0f387ded6284c9af9b403c178e5869dbe8a33"},
   ]);
   for(const source of signupConfirmTransport.changedSource){
     expect(source.path).not.toContain("..");
     const successor=signupUserReceipt.changedSource.find(entry=>entry.path===source.path);
      expect(hash(read(source.path)),source.path).toBe(successor?.currentBlob??source.currentBlob);
   }
   expect(signupConfirmTransport.addedAdversarialTest).toEqual({
     path:"tests/e2e/p02-signup-confirm-transport-outcome.test.ts",previousBlob:null,
     currentBlob:"f6659f118c343173b12767c102afc312053a32ff",cases:11,
   });
   expect(hash(read(signupConfirmTransport.addedAdversarialTest.path)))
     .toBe(signupUserReceipt.changedSource.find(entry=>entry.path===signupConfirmTransport.addedAdversarialTest.path)?.currentBlob);
   expect(signupConfirmTransport.focusedWorkflow).toEqual({
     path:signInAudit.focusedWorkflow.path,
     previousBlob:"720495c3087c369249fe19495cb86c2461a0abca",
     currentBlob:"42e200cdfe166ebb0e2f5eb187b182ab81c24490",
   });
   expect(signupConfirmTransport.focusedWorkflow.previousBlob)
     .toBe(signInAudit.focusedWorkflow.currentBlob);
   expect(hash(read(signupConfirmTransport.focusedWorkflow.path)))
     .toBe(signupConfirmTransport.focusedWorkflow.currentBlob);
   expect(read(signupConfirmTransport.focusedWorkflow.path).toString())
     .toContain("tests/e2e/p02-signup-confirm-transport-outcome.test.ts");
   expect(signupConfirmTransport.requiredGuards).toContain("NO_CHECK_EMAIL_ON_THROWN_SIGNUP");
   expect(signupConfirmTransport.requiredGuards).toContain("NO_SUCCESSFUL_CONFIRM_WITHOUT_VERIFIED_USER_SESSION");
   expect(signupConfirmTransport.requiredGuards).toContain("NO_VERCEL_DEPLOY");
   expect(signupConfirmTransport.acceptanceState).toBe("SOURCE_ONLY_NOT_AUTHENTICATED_TWO_OWNER_ACCEPTANCE");
    // Follow-on source lock: neither original historical blob nor its manifest is altered.
    expect(hash(signupConfirmTransportRaw)).toBe("a25c45beaee878113757e59310ba480fc9e81c59");
    expect(signupUserReceipt.schema).toBe("servicedesk.p02.signup-provider-user-receipt-successor.v1");
    expect(signupUserReceipt.batchId).toBe("P02-SIGNUP-PARTIAL-PROVIDER-RECEIPT-DENIAL-20261107");
    expect(signupUserReceipt.sourceOnly).toBe(true);
    expect(signupUserReceipt.parentHead).toBe("13f72c92b19e524d06f1fa97563386d5ebc64cd6");
    expect(signupUserReceipt.predecessor).toEqual({
      path:"docs/delivery/sonic-p02-signup-confirm-transport-successor-20261107.json",
      blob:"a25c45beaee878113757e59310ba480fc9e81c59",unchanged:true,
    });
    expect(signupUserReceipt.predecessor.blob).toBe(hash(signupConfirmTransportRaw));
    expect(signupUserReceipt.changedSource).toEqual([
      {path:"src/app/auth/sign-up/actions.ts",previousBlob:"3e925d4ec220f7264e5c6407c42e2670be5cebef",currentBlob:"e08615dda66c6b7068c92ac56fe60364e6188ec4"},
      {path:"tests/e2e/p02-signup-confirm-transport-outcome.test.ts",previousBlob:"f6659f118c343173b12767c102afc312053a32ff",currentBlob:"6d5d988a535039b03df8fcf7082caeea8f3f3b42"},
    ]);
    expect(signupUserReceipt.testCases).toBe(12);
    for(const changed of signupUserReceipt.changedSource){
      expect(changed.path).not.toContain("..");
      expect(hash(read(changed.path)),changed.path).toBe(changed.currentBlob);
    }
    expect(signupUserReceipt.unchangedSource).toEqual([
      {path:"src/app/auth/confirm/route.ts",blob:"4ab0f387ded6284c9af9b403c178e5869dbe8a33",unchanged:true},
      {path:".github/workflows/sonic-p02-auth-origin-focused.yml",blob:"42e200cdfe166ebb0e2f5eb187b182ab81c24490",unchanged:true},
    ]);
    for(const unchanged of signupUserReceipt.unchangedSource){
      expect(hash(read(unchanged.path)),unchanged.path).toBe(unchanged.blob);
    }
    expect(signupUserReceipt.requiredGuards).toContain("NO_CHECK_EMAIL_WITHOUT_RETURNED_SIGNUP_USER_ID");
    expect(signupUserReceipt.requiredGuards).toContain("NO_CONNECTED_AUTH_WRITE");
    expect(signupUserReceipt.requiredGuards).toContain("NO_DEPLOY");
    expect(signupUserReceipt.acceptanceState).toBe("SOURCE_ONLY_NOT_AUTHENTICATED_TWO_OWNER_ACCEPTANCE");

  
  expect(read(signInAudit.focusedWorkflow.path).toString())
    .toContain("tests/e2e/p02-signin-session-outcome.test.ts");
  expect(signInAudit.requiredGuards).toContain("NO_SUCCESSFUL_AUTH_REDIRECT_WITHOUT_USER_AND_SESSION");
  expect(signInAudit.requiredGuards).toContain("NO_CONNECTED_SUPABASE_AUTH_WRITE");
  expect(read(resetRetry.focusedWorkflow.path).toString()).toContain("src/app/auth/reset-password/page.tsx");
  expect(resetRetry.guards).toContain("HIDE_REPEAT_PASSWORD_UPDATE_FORM_AFTER_SIGNOUT_FAILURE");
  expect(resetRetry.guards).toContain("NO_DEPLOY");
  expect(reset.overrides).toHaveLength(2);
  expect(reset.overrides.map(x=>x.path).sort()).toEqual([
   "src/app/auth/reset-password/page.tsx",
   "src/features/auth/verified-auth-feedback.ts",
  ]);
  for(const change of reset.overrides){
   const before=authFeedback.changedSource.find(x=>x.path===change.path);
   expect(change.previousBlob,change.path).toBe(before?.blob);
   expect(hash(read(change.path)),change.path)
     .toBe(change.path===resetRetry.reviewedPage.path
       ?resetRetry.reviewedPage.newBlob:change.currentBlob);
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
   const reviewed=f.path===race.workflow.path?writerAudit.workflowSuccessor.currentBlob:f.blob;
   expect(hash(read(f.path)),f.path).toBe(reviewed);
  }
  const priorWorkflow=overlay.changedFiles.find(x=>x.path===p02.workflowSuccessor.path);
  expect(priorWorkflow?.blob).toBe(p02.workflowSuccessor.previousBlob);
  for(const file of overlay.changedFiles){
   const reviewedSha=file.path===p02.workflowSuccessor.path
    ? writerAudit.workflowSuccessor.currentBlob : file.blob;
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
