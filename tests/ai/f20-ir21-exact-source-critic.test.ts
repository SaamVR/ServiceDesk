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
const postConfirmNavigationRaw=read("docs/delivery/sonic-p02-post-confirm-navigation-transport-successor-20261107.json");
const postConfirmNavigation=JSON.parse(postConfirmNavigationRaw.toString()) as {
 schema:string;batchId:string;chat:string;sourceOnly:boolean;reviewedParentHead:string;
 predecessor:{path:string;blob:string;unchanged:boolean};
 historicCurrencyUx:{path:string;blob:string;unchanged:boolean};
 changedSource:Array<{path:string;previousBlob:string;currentBlob:string;lane:string}>;
 tests:{path:string;newCases:number;totalCases:number;scope:string};
 unchangedAuthorizationHelper:{path:string;blob:string;unchanged:boolean};
 unchangedIntegratedWorkflow:{path:string;blob:string;unchanged:boolean};
 requiredGuards:string[];acceptanceState:string;nextBatch:string;
};
const uncertainRegistrationRaw=read("docs/delivery/sonic-p02-uncertain-registration-recovery-successor-20261108.json");
const uncertainRegistration=JSON.parse(uncertainRegistrationRaw.toString()) as {
 schema:string;batchId:string;chat:string;sourceOnly:boolean;reviewedParentHead:string;
 predecessor:{path:string;blob:string;unchanged:boolean};
 changedSource:Array<{path:string;previousBlob:string;currentBlob:string}>;
 testCases:{path:string;prior:number;current:number;newCases:number;scope:string};
 actionUnchanged:{path:string;blob:string;unchanged:boolean;mayHaveCommittedMessages:string[]};
 workflowUnchanged:{path:string;blob:string;unchanged:boolean};
 requiredGuards:string[];acceptanceState:string;
};
const recoveryJsxRaw=read("docs/delivery/sonic-p02-uncertain-registration-jsx-correction-20261108.json");
const recoveryJsx=JSON.parse(recoveryJsxRaw.toString()) as {
 schema:string;batchId:string;sourceOnly:boolean;parentHead:string;
 predecessor:{path:string;blob:string;unchanged:boolean};
 changedSource:Array<{path:string;previousBlob:string;currentBlob:string;fix:string}>;
 qaSourceUnchanged:{path:string;blob:string;unchanged:boolean};
 guardSourceUnchanged:{path:string;blob:string;unchanged:boolean};
 workflowUnchanged:{path:string;blob:string;unchanged:boolean};
 mustRetain:string[];acceptance:string;
};
const activeOwnerRlsRaw=read("docs/delivery/sonic-p02-active-owner-hidden-workspace-veto-20261108.json");
const activeOwnerRls=JSON.parse(activeOwnerRlsRaw.toString()) as {
 schema:string;batchId:string;sourceOnly:boolean;parentHead:string;
 predecessor:{path:string;blob:string;unchanged:boolean};
 changedSource:Array<{path:string;previousBlob:string;currentBlob:string}>;
 tests:{route:{path:string;previousCases:number;currentCases:number;added:number};
 unit:{path:string;previousCases:number;currentCases:number;changedExpectation:string}};
 unchangedAuthRoute:{path:string;blob:string;unchanged:boolean};
 unchangedWorkflow:{path:string;blob:string;unchanged:boolean};
 requiredGuards:string[];acceptance:string;
};
const ownerNavigationGuardRaw=read("docs/delivery/sonic-p02-owner-navigation-transient-denial-successor-20261108.json");
const ownerNavigationGuard=JSON.parse(ownerNavigationGuardRaw.toString()) as {
 schema:string;batchId:string;sourceOnly:boolean;chat:string;reviewedParentHead:string;
 predecessor:{path:string;blob:string;unchanged:boolean};
 changedSource:Array<{path:string;previousBlob:string;currentBlob:string;lane:string}>;
 regressionTests:{path:string;previous:number;current:number;added:number;scope:string};
 unchangedServerAction:{path:string;blob:string;unchanged:boolean};
 unchangedAuthorizer:{path:string;blob:string;unchanged:boolean};
 unchangedWorkflow:{path:string;blob:string;unchanged:boolean};
 requiredGuards:string[];acceptance:string;
};
const ownerQaWitnessRaw=read("docs/delivery/sonic-p02-owner-navigation-qa-witness-correction-20261108.json");
const ownerQaWitness=JSON.parse(ownerQaWitnessRaw.toString()) as {
 schema:string;batchId:string;sourceOnly:boolean;parentHead:string;
 predecessor:{path:string;blob:string;unchanged:boolean};
 changedSource:Array<{path:string;previousBlob:string;currentBlob:string;reason:string}>;
 testCount:number;productionSourceUnchanged:Array<{path:string;blob:string;unchanged:boolean}>;
 guard:string[];state:string;
};
const qaFixtureScopeRaw=read("docs/delivery/sonic-p02-owner-navigation-fixture-scope-correction-20261108.json");
const qaFixtureScope=JSON.parse(qaFixtureScopeRaw.toString()) as {
 schema:string;batchId:string;sourceOnly:boolean;parentHead:string;
 predecessor:{path:string;blob:string;unchanged:boolean};
 changedSource:Array<{path:string;previousBlob:string;currentBlob:string;reason:string}>;
 testCount:number;productionSourceUnchanged:Array<{path:string;blob:string;unchanged:boolean}>;
 guards:string[];acceptance:string;
};
const malformedOwnerSlugRaw=read("docs/delivery/sonic-p02-active-owner-malformed-slug-veto-20261108.json");
const malformedOwnerSlug=JSON.parse(malformedOwnerSlugRaw.toString()) as {
 schema:string;batchId:string;sourceOnly:boolean;chat:string;parentHead:string;
 predecessor:{path:string;blob:string;unchanged:boolean};
 changedSource:Array<{path:string;previousBlob:string;currentBlob:string;lane:string}>;
 tests:{path:string;previous:number;current:number;added:number;scope:string};
 unchangedWorkflow:{path:string;blob:string;unchanged:boolean};
 invariants:string[];acceptance:string;
};
// Historical source bytes remain compared against their exact reviewed blob.
// Only the two named current paths can advance by this reviewed successor.
const expectedCurrentOwnerSlugBlob=(path:string,previous:string):string=>{
 const successor=malformedOwnerSlug.changedSource.find(item=>item.path===path);
 if (!successor) return previous;
 expect(successor.previousBlob,path).toBe(previous);
 return successor.currentBlob;
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
   // The historical P02/P03 pins remain true; only this additive successor can supersede.
   const navSuccessor=postConfirmNavigation.changedSource.find(x=>x.path===source.path);
   const recoverySuccessor=uncertainRegistration.changedSource.find(x=>x.path===source.path);
   const pageCorrection=recoveryJsx.changedSource.find(x=>x.path===source.path);
   const ownerRlsVeto=activeOwnerRls.changedSource.find(x=>x.path===source.path);
   const ownerNavigation=ownerNavigationGuard.changedSource.find(x=>x.path===source.path);
   const qaWitness=ownerQaWitness.changedSource.find(x=>x.path===source.path);
   const fixtureFix=qaFixtureScope.changedSource.find(x=>x.path===source.path);
   if(navSuccessor)expect(navSuccessor.previousBlob,source.path)
     .toBe(transport?.currentBlob??replacement?.currentBlob??source.blob);
   if(recoverySuccessor)expect(recoverySuccessor.previousBlob,source.path)
     .toBe(navSuccessor?.currentBlob??transport?.currentBlob??replacement?.currentBlob??source.blob);
   if(pageCorrection)expect(pageCorrection.previousBlob,source.path).toBe(recoverySuccessor?.currentBlob);
   if(ownerRlsVeto)expect(ownerRlsVeto.previousBlob,source.path)
     .toBe(pageCorrection?.currentBlob??recoverySuccessor?.currentBlob??navSuccessor?.currentBlob??transport?.currentBlob??replacement?.currentBlob??source.blob);
   if(ownerNavigation)expect(ownerNavigation.previousBlob,source.path)
     .toBe(ownerRlsVeto?.currentBlob??pageCorrection?.currentBlob??recoverySuccessor?.currentBlob??navSuccessor?.currentBlob??transport?.currentBlob??replacement?.currentBlob??source.blob);
   if(qaWitness)expect(qaWitness.previousBlob,source.path).toBe(ownerNavigation?.currentBlob);
   if(fixtureFix)expect(fixtureFix.previousBlob,source.path).toBe(qaWitness?.currentBlob);
   expect(hash(read(source.path)),source.path)
     .toBe(expectedCurrentOwnerSlugBlob(source.path,fixtureFix?.currentBlob??qaWitness?.currentBlob??ownerNavigation?.currentBlob??ownerRlsVeto?.currentBlob??pageCorrection?.currentBlob??recoverySuccessor?.currentBlob??navSuccessor?.currentBlob??transport?.currentBlob??replacement?.currentBlob??source.blob));
  }
  // Separate independent source successor for actual post-confirm owner routing.
   expect(postConfirmNavigation.schema).toBe("servicedesk.p02.post-confirm-owner-navigation-transport-successor.v1");
   expect(postConfirmNavigation.batchId).toBe("P02-AUTH-CONTINUE-OWNER-SETUP-NETWORK-FAIL-CLOSED-20261107");
   expect(postConfirmNavigation.sourceOnly).toBe(true);
   expect(postConfirmNavigation.chat).toBe("PRODUCTION");
   expect(postConfirmNavigation.reviewedParentHead).toBe("e28e069879f463f91757ebb83b632dfc13f48ff0");
   expect(postConfirmNavigation.predecessor).toEqual({"path":"docs/delivery/sonic-p02-signup-user-receipt-successor-20261107.json","blob":"96a70397dbbf60f8ab3f8a6ab5617e754b2d0b83","unchanged":true});
   expect(postConfirmNavigation.predecessor.blob).toBe(hash(signupUserReceiptRaw));
   expect(postConfirmNavigation.historicCurrencyUx).toEqual({"path":"docs/delivery/sonic-p03-currency-first-run-ux-source-successor-20261107.json","blob":"d7648d1fd14e3e58f584cb0f03e5a386e4c3087d","unchanged":true});
   expect(postConfirmNavigation.historicCurrencyUx.blob).toBe(hash(p03CurrencyRaw));
   expect(postConfirmNavigation.changedSource).toEqual([
  {
    "path": "src/app/auth/continue/route.ts",
    "previousBlob": "1c015d329feb08f2c260b40715b8b3a5bb154cca",
    "currentBlob": "4bb3d1fa077393ff67fe759a24fd651aeb563ab1",
    "lane": "AUTH_ENGINEERING"
  },
  {
    "path": "src/app/auth/create-workspace/page.tsx",
    "previousBlob": "9c02eee0f20cc9711b37176d95eef7caf6c285c0",
    "currentBlob": "18219d81539c44883e7ea856cf12dbafc8a97c70",
    "lane": "ONBOARDING_UI"
  },
  {
    "path": "tests/e2e/p02-workspace-error-origin.test.ts",
    "previousBlob": "7a429027bb8f9d854727de567115be9b8fa6c820",
    "currentBlob": "d27a237c19ad5029816d2c0d4b23888026f3b1e6",
    "lane": "QA_INDEPENDENT_NEGATIVES"
  }
]);
   expect(new Set(postConfirmNavigation.changedSource.map(x=>x.path)).size).toBe(3);
   for(const change of postConfirmNavigation.changedSource){
     expect(change.path).not.toContain("..");
     const recovery=uncertainRegistration.changedSource.find(item=>item.path===change.path);
     const corrected=recoveryJsx.changedSource.find(item=>item.path===change.path);
     const ownerVeto=activeOwnerRls.changedSource.find(item=>item.path===change.path);
     const latestNav=ownerNavigationGuard.changedSource.find(item=>item.path===change.path);
     const qaWitness=ownerQaWitness.changedSource.find(item=>item.path===change.path);
     const fixtureFix=qaFixtureScope.changedSource.find(item=>item.path===change.path);
     if(recovery)expect(recovery.previousBlob,change.path).toBe(change.currentBlob);
     if(corrected)expect(corrected.previousBlob,change.path).toBe(recovery?.currentBlob);
     if(ownerVeto)expect(ownerVeto.previousBlob,change.path).toBe(corrected?.currentBlob??recovery?.currentBlob??change.currentBlob);
     if(latestNav)expect(latestNav.previousBlob,change.path)
       .toBe(ownerVeto?.currentBlob??corrected?.currentBlob??recovery?.currentBlob??change.currentBlob);
     if(qaWitness)expect(qaWitness.previousBlob,change.path).toBe(latestNav?.currentBlob);
     if(fixtureFix)expect(fixtureFix.previousBlob,change.path).toBe(qaWitness?.currentBlob);
     expect(hash(read(change.path)),change.path)
       .toBe(expectedCurrentOwnerSlugBlob(change.path,fixtureFix?.currentBlob??qaWitness?.currentBlob??latestNav?.currentBlob??ownerVeto?.currentBlob??corrected?.currentBlob??recovery?.currentBlob??change.currentBlob));
   }
   expect(postConfirmNavigation.tests).toEqual({"path":"tests/e2e/p02-workspace-error-origin.test.ts","newCases":13,"totalCases":19,"scope":"SYNTHETIC_POST_CONFIRMATION_ENTRYPOINT_NO_LIVE_JWT"});
   expect(postConfirmNavigation.unchangedAuthorizationHelper).toEqual({"path":"src/features/auth/authorized-workspace-access.ts","blob":"9fb078e8be2d75491d2ff630e99857cdec391ee2","unchanged":true});
   const correctedAuthorizer=activeOwnerRls.changedSource.find(item=>item.path===postConfirmNavigation.unchangedAuthorizationHelper.path);
   expect(correctedAuthorizer?.previousBlob).toBe(postConfirmNavigation.unchangedAuthorizationHelper.blob);
   expect(hash(read(postConfirmNavigation.unchangedAuthorizationHelper.path)))
     .toBe(expectedCurrentOwnerSlugBlob(postConfirmNavigation.unchangedAuthorizationHelper.path,correctedAuthorizer?.currentBlob));
   expect(postConfirmNavigation.unchangedIntegratedWorkflow).toEqual({"path":".github/workflows/v4-sonic-ir21-f20-owner-finance-retention-ci.yml","blob":"634d35b6eb34025df560b78f0dfbe3354988238c","unchanged":true});
   expect(hash(read(postConfirmNavigation.unchangedIntegratedWorkflow.path)))
     .toBe(postConfirmNavigation.unchangedIntegratedWorkflow.blob);
   for(const guard of ["NO_SERVER_500_ON_THROWN_AUTH_GETUSER",
     "NO_WORKSPACE_ROUTE_AFTER_MEMBERSHIP_TRANSPORT_ERROR",
     "NO_OWNER_REGISTRATION_AFTER_CUSTOMER_LOOKUP_TRANSPORT_ERROR",
     "NO_WORKSPACE_FORM_WITHOUT_VERIFIED_USER",
     "NO_CONNECTED_AUTH_OR_DB_WRITE","NO_VERCEL_DEPLOY_OR_CANONICAL_MERGE"])
     expect(postConfirmNavigation.requiredGuards).toContain(guard);
   expect(postConfirmNavigation.acceptanceState)
     .toBe("INTEGRATION_SOURCE_ONLY_NOT_AUTHENTICATED_TWO_OWNER_JWT_RLS_ACCEPTANCE");
   expect(postConfirmNavigation.nextBatch).toBe("P02_818_TWO_OWNER_SIGNED_IN_ACCEPTANCE_PERMISSION_BLOCKED");
   expect(workspaceTransport.invariants).toContain("NO_AUTOMATIC_SECOND_REGISTRATION_ATTEMPT");
  expect(workspaceTransport.invariants).toContain("P02_REMAINS_OPEN");
   // Previous locks are immutable; only this additive reviewed successor
   // pins the current bounded recovery UI and adversarial negative coverage.
   expect(hash(postConfirmNavigationRaw)).toBe("08a3748c1cbefd7c3f82b013d28e9646154edfee");
   expect(uncertainRegistration.schema).toBe("servicedesk.p02.uncertain-registration-saved-readback-ui-successor.v1");
   expect(uncertainRegistration.batchId).toBe("P02-UNKNOWN-RPC-COMMIT-OWNER-VISIBLE-READBACK-20261108");
   expect(uncertainRegistration.sourceOnly).toBe(true);
   expect(uncertainRegistration.reviewedParentHead).toBe("baf7742b6e89348cbf2f2d11e6f886a079222fd5");
   expect(uncertainRegistration.predecessor).toEqual({path:"docs/delivery/sonic-p02-post-confirm-navigation-transport-successor-20261107.json",blob:"08a3748c1cbefd7c3f82b013d28e9646154edfee",unchanged:true});
   expect(uncertainRegistration.predecessor.blob).toBe(hash(postConfirmNavigationRaw));
   expect(uncertainRegistration.changedSource).toEqual([
    {path:"src/features/auth/workspace-registration-error.ts",previousBlob:"77c1c0f5c2abf940edb6517e34e721ebd250e684",currentBlob:"73e200d522da5bf4dabe0275f97860379f53637f"},
    {path:"src/app/auth/create-workspace/page.tsx",previousBlob:"18219d81539c44883e7ea856cf12dbafc8a97c70",currentBlob:"49499b2cbb7e230765b7097f1f67b5f12578156e"},
    {path:"tests/e2e/p02-workspace-error-origin.test.ts",previousBlob:"d27a237c19ad5029816d2c0d4b23888026f3b1e6",currentBlob:"826f1e67c2570b0fcc6c8298558b1b663b254d2d"}
   ]);
   for(const source of uncertainRegistration.changedSource) {
     expect(source.path).not.toContain("..");
     const corrected=recoveryJsx.changedSource.find(item=>item.path===source.path);
     const ownerVeto=activeOwnerRls.changedSource.find(item=>item.path===source.path);
     const latestNav=ownerNavigationGuard.changedSource.find(item=>item.path===source.path);
     const qaWitness=ownerQaWitness.changedSource.find(item=>item.path===source.path);
     const fixtureFix=qaFixtureScope.changedSource.find(item=>item.path===source.path);
     if(corrected)expect(corrected.previousBlob,source.path).toBe(source.currentBlob);
     if(ownerVeto)expect(ownerVeto.previousBlob,source.path).toBe(corrected?.currentBlob??source.currentBlob);
     if(latestNav)expect(latestNav.previousBlob,source.path).toBe(ownerVeto?.currentBlob??corrected?.currentBlob??source.currentBlob);
     if(qaWitness)expect(qaWitness.previousBlob,source.path).toBe(latestNav?.currentBlob);
     if(fixtureFix)expect(fixtureFix.previousBlob,source.path).toBe(qaWitness?.currentBlob);
     expect(hash(read(source.path)),source.path)
       .toBe(expectedCurrentOwnerSlugBlob(source.path,fixtureFix?.currentBlob??qaWitness?.currentBlob??latestNav?.currentBlob??ownerVeto?.currentBlob??corrected?.currentBlob??source.currentBlob));
   }
   expect(uncertainRegistration.testCases).toEqual({path:"tests/e2e/p02-workspace-error-origin.test.ts",prior:19,current:21,newCases:2,scope:"SYNTHETIC_UI_RECOVERY_NO_CONNECTED_DB"});
   expect(uncertainRegistration.actionUnchanged.path).toBe("src/app/auth/create-workspace/actions.ts");
   expect(uncertainRegistration.actionUnchanged.blob).toBe("8e3a6e0572c38680141ce86b5d7f5f84cf5d6dfd");
   expect(hash(read(uncertainRegistration.actionUnchanged.path))).toBe(uncertainRegistration.actionUnchanged.blob);
   expect(uncertainRegistration.actionUnchanged.mayHaveCommittedMessages).toEqual(["Workspace registration may have committed, but its result could not be confirmed. Check your authorized workspaces before trying again.","Workspace registration may have committed, but saved owner access could not be verified. Use your authorized workspaces to check before trying again."]);
   expect(uncertainRegistration.workflowUnchanged.blob).toBe("634d35b6eb34025df560b78f0dfbe3354988238c");
   expect(hash(read(uncertainRegistration.workflowUnchanged.path))).toBe(uncertainRegistration.workflowUnchanged.blob);
   for(const guard of ["NO_SECOND_REGISTRATION_RPC","NO_CONNECTED_AUTH_OR_DB_WRITE","NO_DEPLOY","P02_REMAINS_2_OF_7"])
      expect(uncertainRegistration.requiredGuards).toContain(guard);
   expect(uncertainRegistration.acceptanceState).toBe("INTEGRATED_SOURCE_ONLY_NOT_REAL_TWO_OWNER_AUTHENTICATED_ACCEPTANCE");
   // Failed build's source is retained exactly; corrected page has a new
   // reviewed successor rather than a rewritten predecessor or weaker critic.
   expect(hash(uncertainRegistrationRaw)).toBe("f7ecb97302c8b0bba90ed9c0bf5350ad744077f5");
   expect(recoveryJsx.schema).toBe("servicedesk.p02.uncertain-registration-jsx-verified-successor.v1");
   expect(recoveryJsx.batchId).toBe("P02-UNKNOWN-RPC-RECOVERY-JSX-SYNTAX-CORRECTION-20261108");
   expect(recoveryJsx.sourceOnly).toBe(true);
   expect(recoveryJsx.parentHead).toBe("8ec0894a7b643f1da10a02b6a0cab6f4c67f9023");
   expect(recoveryJsx.predecessor).toEqual({path:"docs/delivery/sonic-p02-uncertain-registration-recovery-successor-20261108.json",blob:"f7ecb97302c8b0bba90ed9c0bf5350ad744077f5",unchanged:true});
   expect(recoveryJsx.predecessor.blob).toBe(hash(uncertainRegistrationRaw));
   expect(recoveryJsx.changedSource).toEqual([{
     path:"src/app/auth/create-workspace/page.tsx",previousBlob:"49499b2cbb7e230765b7097f1f67b5f12578156e",currentBlob:"6d424726cd36e6c6bef7b36e174019235a72004c",
     fix:"CLOSE_JSX_CONDITIONAL_WITHOUT_CHANGING_OWNER_RECOVERY_COPY"
   }]);
   for(const check of [recoveryJsx.qaSourceUnchanged,recoveryJsx.guardSourceUnchanged,recoveryJsx.workflowUnchanged]){
     const ownerVeto=activeOwnerRls.changedSource.find(item=>item.path===check.path);
     const latestNav=ownerNavigationGuard.changedSource.find(item=>item.path===check.path);
     const qaWitness=ownerQaWitness.changedSource.find(item=>item.path===check.path);
     const fixtureFix=qaFixtureScope.changedSource.find(item=>item.path===check.path);
     if(ownerVeto)expect(ownerVeto.previousBlob,check.path).toBe(check.blob);
     if(latestNav)expect(latestNav.previousBlob,check.path).toBe(ownerVeto?.currentBlob??check.blob);
     if(qaWitness)expect(qaWitness.previousBlob,check.path).toBe(latestNav?.currentBlob);
     if(fixtureFix)expect(fixtureFix.previousBlob,check.path).toBe(qaWitness?.currentBlob);
     expect(hash(read(check.path)),check.path).toBe(expectedCurrentOwnerSlugBlob(check.path,fixtureFix?.currentBlob??qaWitness?.currentBlob??latestNav?.currentBlob??ownerVeto?.currentBlob??check.blob));
   }
   expect(recoveryJsx.mustRetain).toContain("P02_OPEN_2_OF_7");
   expect(recoveryJsx.mustRetain).toContain("NO_CONNECTED_DB_WRITE");
   expect(recoveryJsx.mustRetain).toContain("NO_DEPLOY");
   expect(recoveryJsx.acceptance).toBe("PENDING_EXACT_HEAD_CI_SOURCE_ONLY");
   // Existing trusted page, test and authorization-handoff provenance stays pinned.
   // The new reviewed successor only closes incomplete RLS staff visibility.
   expect(hash(recoveryJsxRaw)).toBe("c86c71df734e38a8e894bf590e4386001c3ef832");
   expect(activeOwnerRls.schema).toBe("servicedesk.p02.active-owner-missing-workspace-rls-veto-successor.v1");
   expect(activeOwnerRls.batchId).toBe("P02-ACTIVE_OWNER_RLS_HIDDEN_WORKSPACE_MUST_NOT_REGISTER-20261108");
   expect(activeOwnerRls.sourceOnly).toBe(true);
   expect(activeOwnerRls.parentHead).toBe("ab7da89207fa9ae8c07b775a07a3b4bba018c18e");
   expect(activeOwnerRls.predecessor).toEqual({path:"docs/delivery/sonic-p02-uncertain-registration-jsx-correction-20261108.json",blob:"c86c71df734e38a8e894bf590e4386001c3ef832",unchanged:true});
   expect(activeOwnerRls.predecessor.blob).toBe(hash(recoveryJsxRaw));
   expect(activeOwnerRls.changedSource).toEqual([
     {path:"src/features/auth/authorized-workspace-access.ts",previousBlob:"9fb078e8be2d75491d2ff630e99857cdec391ee2",currentBlob:"432490ce986695d418b7f2cf0f7bcdac27806102"},
     {path:"tests/e2e/v3-authorized-workspace-access.test.ts",previousBlob:"50d42e6543e5b4241f43f5683b3ee99b53f91772",currentBlob:"cb795a6dfa929e6019f0d9d190e6d90d0897aa6c"},
     {path:"tests/e2e/p02-workspace-error-origin.test.ts",previousBlob:"826f1e67c2570b0fcc6c8298558b1b663b254d2d",currentBlob:"8c3e470ba2f74441b4441c448928573f7a163007"}
   ]);
   for(const changed of activeOwnerRls.changedSource){
     expect(changed.path).not.toContain("..");
     const latestNav=ownerNavigationGuard.changedSource.find(item=>item.path===changed.path);
     if(latestNav)expect(latestNav.previousBlob,changed.path).toBe(changed.currentBlob);
     const qaWitness=ownerQaWitness.changedSource.find(item=>item.path===changed.path);
     if(qaWitness)expect(qaWitness.previousBlob,changed.path).toBe(latestNav?.currentBlob);
     const fixtureFix=qaFixtureScope.changedSource.find(item=>item.path===changed.path);
     if(fixtureFix)expect(fixtureFix.previousBlob,changed.path).toBe(qaWitness?.currentBlob);
     expect(hash(read(changed.path)),changed.path).toBe(expectedCurrentOwnerSlugBlob(changed.path,fixtureFix?.currentBlob??qaWitness?.currentBlob??latestNav?.currentBlob??changed.currentBlob));
   }
   expect(activeOwnerRls.tests.route).toEqual({path:"tests/e2e/p02-workspace-error-origin.test.ts",previousCases:21,currentCases:23,added:2});
   expect(activeOwnerRls.tests.unit).toEqual({path:"tests/e2e/v3-authorized-workspace-access.test.ts",previousCases:8,currentCases:9,changedExpectation:"ACTIVE_HIDDEN_OWNER_DENIED"});
   for(const oldSource of [activeOwnerRls.unchangedAuthRoute,activeOwnerRls.unchangedWorkflow])
     expect(hash(read(oldSource.path)),oldSource.path).toBe(oldSource.blob);
   for(const guard of ["ACTIVE_OWNER_MISSING_WORKSPACE_DENY_NOT_NEW_OWNER","PARTIAL_STAFF_RLS_READBACK_DENY","NO_CONNECTED_JWT_OR_DB_OPERATION","NO_DEPLOY","P02_OPEN_2_OF_7"])
     expect(activeOwnerRls.requiredGuards).toContain(guard);
   expect(activeOwnerRls.acceptance).toBe("SOURCE_ONLY_PENDING_TWO_REAL_OWNER_JWT_RLS");
   // Separate independent successor: prior manifest byte-identical.
   expect(hash(activeOwnerRlsRaw)).toBe("aa420877a08eb9a31cc47a28ba940d31d0868f92");
   expect(ownerNavigationGuard.schema).toBe("servicedesk.p02.owner-auth-navigation-transient-and-no-resubmit.v1");
   expect(ownerNavigationGuard.batchId).toBe("P02-OWNER_NAVIGATION_FAIL_CLOSED_AND_NO_DUPLICATE_REGISTRATION-20261108");
   expect(ownerNavigationGuard.sourceOnly).toBe(true);
   expect(ownerNavigationGuard.chat).toBe("PRODUCTION_SOURCE");
   expect(ownerNavigationGuard.reviewedParentHead).toBe("235c38ba022d83dfb99e96e3f5325517cf0a4e10");
   expect(ownerNavigationGuard.predecessor).toEqual({path:"docs/delivery/sonic-p02-active-owner-hidden-workspace-veto-20261108.json",blob:"aa420877a08eb9a31cc47a28ba940d31d0868f92",unchanged:true});
   expect(ownerNavigationGuard.predecessor.blob).toBe(hash(activeOwnerRlsRaw));
   expect(ownerNavigationGuard.changedSource).toEqual([
     {path:"src/app/auth/create-workspace/page.tsx",previousBlob:"6d424726cd36e6c6bef7b36e174019235a72004c",currentBlob:"2ed68d7a1ae4449e43dfb852fd8e210640664e56",lane:"ONBOARDING_UI"},
     {path:"src/app/auth/select-workspace/page.tsx",previousBlob:"dc9c9688392a87fe465e31dfbf06b7307f1ce5db",currentBlob:"d49858992d78fcb0a84bbd84d24bb1ebf681896e",lane:"STAFF_WORKSPACE_CHOOSER"},
     {path:"src/app/onboarding/verified/page.tsx",previousBlob:"71ac07fde991b7b9e59779f483bb4c3c35195844",currentBlob:"12eafdfa355d0c2fe59c3fa72a6533993627f60c",lane:"VERIFIED_OWNER_LANDING"},
     {path:"tests/e2e/p02-workspace-error-origin.test.ts",previousBlob:"8c3e470ba2f74441b4441c448928573f7a163007",currentBlob:"f1686a3511072e56147b4dc42ee820bab88ffc00",lane:"ADVERSARIAL_QA"}
   ]);
   for(const changed of ownerNavigationGuard.changedSource) {
     expect(changed.path).not.toContain("..");
     const qaWitness=ownerQaWitness.changedSource.find(item=>item.path===changed.path);
     if(qaWitness)expect(qaWitness.previousBlob,changed.path).toBe(changed.currentBlob);
     const fixtureFix=qaFixtureScope.changedSource.find(item=>item.path===changed.path);
     if(fixtureFix)expect(fixtureFix.previousBlob,changed.path).toBe(qaWitness?.currentBlob);
     expect(hash(read(changed.path)),changed.path).toBe(expectedCurrentOwnerSlugBlob(changed.path,fixtureFix?.currentBlob??qaWitness?.currentBlob??changed.currentBlob));
   }
   expect(ownerNavigationGuard.regressionTests).toEqual({
     path:"tests/e2e/p02-workspace-error-origin.test.ts",previous:23,current:29,added:6,
     scope:"SYNTHETIC_SERVER_COMPONENTS_NO_SIGNED_IN_JWT"
   });
   for(const unchanged of [ownerNavigationGuard.unchangedServerAction,ownerNavigationGuard.unchangedAuthorizer,ownerNavigationGuard.unchangedWorkflow]) {
     expect(hash(read(unchanged.path)),unchanged.path).toBe(expectedCurrentOwnerSlugBlob(unchanged.path,unchanged.blob));
   }
   for(const guard of ["NO_DUPLICATE_REGISTRATION_FORM_ON_AMBIGUOUS_RPC","NO_RAW_AUTH_PROVIDER_500_IN_CHOOSER","NO_RAW_AUTH_PROVIDER_500_ON_VERIFIED_OWNER","NO_CONNECTED_AUTH_DB_WRITE","NO_DEPLOY","P02_REMAINS_2_OF_7"])expect(ownerNavigationGuard.requiredGuards).toContain(guard);
   expect(ownerNavigationGuard.acceptance).toBe("INTEGRATED_SOURCE_ONLY_NOT_AUTHENTICATED_TWO_OWNER_JWT_RLS_ACCEPTANCE");
   // QA repair is a separate source successor; old exact SHA remains pinned.
   expect(hash(ownerNavigationGuardRaw)).toBe("1e6b75052dfd1b5803ceb22da610df6d62a160ea");
   expect(ownerQaWitness.schema).toBe("servicedesk.p02.owner-navigation-qa-witness-correction.v1");
   expect(ownerQaWitness.batchId).toBe("P02-EXACT_JSX_TREE_REGISTRATION_DENIAL_WITNESS_20261108");
   expect(ownerQaWitness.sourceOnly).toBe(true);
   expect(ownerQaWitness.parentHead).toBe("c6433a0e78b83d81413e53e450e27b554563413b");
   expect(ownerQaWitness.predecessor).toEqual({path:"docs/delivery/sonic-p02-owner-navigation-transient-denial-successor-20261108.json",blob:"1e6b75052dfd1b5803ceb22da610df6d62a160ea",unchanged:true});
   expect(ownerQaWitness.predecessor.blob).toBe(hash(ownerNavigationGuardRaw));
   expect(ownerQaWitness.changedSource).toEqual([
     {path:"tests/e2e/p02-workspace-error-origin.test.ts",previousBlob:"f1686a3511072e56147b4dc42ee820bab88ffc00",currentBlob:"2469e781c54f285d94b63d22ddd4471da0b4e974",
       reason:"RECURSIVE_JXS_TREE_TRAVERSAL_CORRECTS_SHALLOW_TEST_FALSE_FAILURE"}
   ]);
   expect(ownerQaWitness.testCount).toBe(29);
   for(const source of ownerQaWitness.changedSource){
     const fixtureFix=qaFixtureScope.changedSource.find(item=>item.path===source.path);
     if(fixtureFix)expect(fixtureFix.previousBlob,source.path).toBe(source.currentBlob);
     expect(hash(read(source.path)),source.path).toBe(expectedCurrentOwnerSlugBlob(source.path,fixtureFix?.currentBlob??source.currentBlob));
   }
   expect(ownerQaWitness.productionSourceUnchanged).toEqual([
     {path:"src/app/auth/create-workspace/page.tsx",blob:"2ed68d7a1ae4449e43dfb852fd8e210640664e56",unchanged:true},
     {path:"src/app/auth/select-workspace/page.tsx",blob:"d49858992d78fcb0a84bbd84d24bb1ebf681896e",unchanged:true},
     {path:"src/app/onboarding/verified/page.tsx",blob:"12eafdfa355d0c2fe59c3fa72a6533993627f60c",unchanged:true}
   ]);
   for(const source of ownerQaWitness.productionSourceUnchanged)
     expect(hash(read(source.path)),source.path).toBe(source.blob);
   expect(ownerQaWitness.guard).toContain("NO_AUTH_OR_DB_WRITE");
   expect(ownerQaWitness.guard).toContain("NO_DEPLOY");
   expect(ownerQaWitness.state).toBe("PENDING_EXACT_HEAD_SOURCE_CI");
   // Separate source successor only corrects test fixture scope; production source is identical.
   expect(hash(ownerQaWitnessRaw)).toBe("1d26bb853f703f62b456cd9fca506e2aca58ea51");
   expect(qaFixtureScope.schema).toBe("servicedesk.p02.owner-navigation-preview-fixture-scope-successor.v1");
   expect(qaFixtureScope.batchId).toBe("P02-OWNER_PREVIEW_FIXTURE_SCOPE_OF_FORM_RENDER_20261108");
   expect(qaFixtureScope.sourceOnly).toBe(true);
   expect(qaFixtureScope.parentHead).toBe("bada02c370cf2c2879515f2072342d38be4f29fb");
   expect(qaFixtureScope.predecessor).toEqual({path:"docs/delivery/sonic-p02-owner-navigation-qa-witness-correction-20261108.json",blob:"1d26bb853f703f62b456cd9fca506e2aca58ea51",unchanged:true});
   expect(qaFixtureScope.predecessor.blob).toBe(hash(ownerQaWitnessRaw));
   expect(qaFixtureScope.changedSource).toEqual([
     {path:"tests/e2e/p02-workspace-error-origin.test.ts",previousBlob:"2469e781c54f285d94b63d22ddd4471da0b4e974",currentBlob:"6aaad27365257fed0fa33d2b6c1a008f87ed3542",
      reason:"MOVE_RENDER_TEST_UNDER_VERIFIED_OWNER_QA_ENV_FIXTURE"}
   ]);
   expect(qaFixtureScope.testCount).toBe(29);
   for(const source of qaFixtureScope.changedSource)
     expect(hash(read(source.path)),source.path).toBe(expectedCurrentOwnerSlugBlob(source.path,source.currentBlob));
   expect(qaFixtureScope.productionSourceUnchanged).toEqual([
     {path:"src/app/auth/create-workspace/page.tsx",blob:"2ed68d7a1ae4449e43dfb852fd8e210640664e56",unchanged:true},
     {path:"src/app/auth/select-workspace/page.tsx",blob:"d49858992d78fcb0a84bbd84d24bb1ebf681896e",unchanged:true},
     {path:"src/app/onboarding/verified/page.tsx",blob:"12eafdfa355d0c2fe59c3fa72a6533993627f60c",unchanged:true}
   ]);
   for(const source of qaFixtureScope.productionSourceUnchanged)
     expect(hash(read(source.path)),source.path).toBe(source.blob);
   for(const guard of ["P02_OPEN_2_OF_7","NO_CONNECTED_AUTH_OR_DB_WRITE","NO_DEPLOY","PRESERVE_ALL_SOURCE_LOCKS"])
     expect(qaFixtureScope.guards).toContain(guard);
   expect(qaFixtureScope.acceptance).toBe("SOURCE_ONLY_UNTIL_AUTHENTICATED_OWNER_A_B_RLS");
   // New adverse owner-navigation correction: no historical manifests rewritten.
   expect(hash(qaFixtureScopeRaw)).toBe("8e9662c5d2594eadee84b0eec79140133c0c3d5e");
   expect(malformedOwnerSlug.schema).toBe("servicedesk.p02.active-owner-malformed-address-deny-successor.v1");
   expect(malformedOwnerSlug.batchId).toBe("P02-ACTIVE_OWNER_INVALID_SLUG_MUST_NOT_RESTART_ONBOARDING-20261108");
   expect(malformedOwnerSlug.sourceOnly).toBe(true);
   expect(malformedOwnerSlug.chat).toBe("PRODUCTION_SOURCE");
   expect(malformedOwnerSlug.parentHead).toBe("4e2d7278f1d8c3ee16205d272d664286f2f0b75f");
   expect(malformedOwnerSlug.predecessor).toEqual({path:"docs/delivery/sonic-p02-owner-navigation-fixture-scope-correction-20261108.json",blob:"8e9662c5d2594eadee84b0eec79140133c0c3d5e",unchanged:true});
   expect(malformedOwnerSlug.predecessor.blob).toBe(hash(qaFixtureScopeRaw));
   expect(malformedOwnerSlug.changedSource).toEqual([
     {path:"src/features/auth/authorized-workspace-access.ts",previousBlob:"432490ce986695d418b7f2cf0f7bcdac27806102",currentBlob:"408f7cc2bfc5c6c94565ec4f0658840bc1a2f008",lane:"RLS_NAVIGATION_AUTHORIZATION"},
     {path:"tests/e2e/p02-workspace-error-origin.test.ts",previousBlob:"6aaad27365257fed0fa33d2b6c1a008f87ed3542",currentBlob:"abd144788272813d937fb2d0082b6d559b6a3dd1",lane:"OWNER_ROUTE_ADVERSARIAL_QA"}
   ]);
   for(const source of malformedOwnerSlug.changedSource){
     expect(source.path).not.toContain("..");
     expect(hash(read(source.path)),source.path).toBe(source.currentBlob);
   }
   expect(malformedOwnerSlug.tests).toEqual({path:"tests/e2e/p02-workspace-error-origin.test.ts",previous:29,current:31,added:2,scope:"MOCKED_RLS_CONTINUATION_NO_LIVE_JWT"});
   expect(malformedOwnerSlug.unchangedWorkflow.blob).toBe("634d35b6eb34025df560b78f0dfbe3354988238c");
   expect(hash(read(malformedOwnerSlug.unchangedWorkflow.path))).toBe(malformedOwnerSlug.unchangedWorkflow.blob);
   for(const guard of ["MALFORMED_ACTIVE_OWNER_SLUG_RETURNS_WORKSPACE_LOOKUP","OWNER_WITH_CREW_DROPS_NO_MEMBERSHIP","NO_PROD_SQL_OR_AUTH_JWT","NO_VERCEL_DEPLOY","P02_REMAINS_2_OF_7"])
     expect(malformedOwnerSlug.invariants).toContain(guard);
   expect(malformedOwnerSlug.acceptance).toBe("SOURCE_TESTED_NOT_TWO_REAL_OWNER_AUTHENTICATED_ACCEPTANCE");







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
   const later=ownerNavigationGuard.changedSource.find(item=>item.path===source.path);
   if(later)expect(later.previousBlob,source.path).toBe(source.blob);
   const qaWitness=ownerQaWitness.changedSource.find(item=>item.path===source.path);
   if(qaWitness)expect(qaWitness.previousBlob,source.path).toBe(later?.currentBlob??source.blob);
   const fixtureFix=qaFixtureScope.changedSource.find(item=>item.path===source.path);
   if(fixtureFix)expect(fixtureFix.previousBlob,source.path).toBe(qaWitness?.currentBlob);
   expect(hash(read(source.path)),source.path)
     .toBe(expectedCurrentOwnerSlugBlob(source.path,fixtureFix?.currentBlob??qaWitness?.currentBlob??later?.currentBlob??source.blob));
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
