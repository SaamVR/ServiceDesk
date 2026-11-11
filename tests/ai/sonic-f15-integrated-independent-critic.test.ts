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
const expectedCurrentOwnerSlugBlob=(path:string,previous:string|undefined):string=>{
 // Optional historical expression must resolve to a reviewed SHA; fail closed
 // instead of treating an absent pin as an acceptable successor.
 if (typeof previous !== "string" || !/^[a-f0-9]{40}$/.test(previous))
   throw new Error("Missing reviewed P02 source SHA: " + path);
 const successor=malformedOwnerSlug.changedSource.find(item=>item.path===path);
 if (!successor) return currentLandingBlob(path,previous);
 expect(successor.previousBlob,path).toBe(previous);
 return currentLandingBlob(path,successor.currentBlob);
};
const ownerMainBranchRaw=read("docs/delivery/sonic-p02-owner-main-branch-saved-readback-successor-20261108.json");
const ownerMainBranch=JSON.parse(ownerMainBranchRaw.toString()) as {
 schema:string;batchId:string;ownerChat:string;sourceOnly:boolean;parentHead:string;
 predecessor:{path:string;blob:string;unchanged:boolean};
 changedSource:Array<{path:string;previousBlob:string;currentBlob:string;lane:string}>;
 dbSourceUnchanged:Array<{path:string;blob:string;unchanged:boolean}>;
 workflowUnchanged:{path:string;blob:string;unchanged:boolean};
 expectedNewCases:{readbackSuite:{previous:number;current:number};serverActionSuite:{previous:number;current:number}};
 checkedNewBranchFields:string[];checkedOwnerBranchMembershipFields:string[];
 invariants:string[];acceptance:string;nextBatch:string;
};
const recoveryQaTransportRaw=read("docs/delivery/sonic-p02-recovery-qa-transport-uncertain-successor-20261108.json");
const recoveryQaTransport=JSON.parse(recoveryQaTransportRaw.toString()) as {
 schema:string;batchId:string;chat:string;sourceOnly:boolean;parentHead:string;
 predecessor:{path:string;blob:string;unchanged:boolean};
 changedSource:Array<{path:string;previousBlob:string;currentBlob:string;lane:string}>;
 regressionTests:Array<{path:string;previous:number;current:number;added:number}>;
 unchangedIntegrationWorkflow:{path:string;blob:string;unchanged:boolean};
 guards:string[];acceptance:string;
};
const currentRecoveryQaSource=(path:string,previous:string|undefined):string=>{
 if(typeof previous!=="string" || !/^[a-f0-9]{40}$/.test(previous))
   throw new Error("Missing reviewed recovery/QA source SHA: "+path);
 const successor=recoveryQaTransport.changedSource.find(item=>item.path===path);
 if(!successor)return currentQaDefaultBlob(path,previous);
 expect(successor.previousBlob,path).toBe(previous);
 return currentQaDefaultBlob(path,successor.currentBlob);
};
const landingBranchRaw=read("docs/delivery/sonic-p02-verified-landing-saved-branch-successor-20261108.json");
const landingBranch=JSON.parse(landingBranchRaw.toString()) as {
 schema:string;batchId:string;ownerChat:string;sourceOnly:boolean;reviewedParentHead:string;
 predecessor:{path:string;blob:string;unchanged:boolean};
 priorOwnerBranchReadback:{path:string;blob:string;unchanged:boolean};
 changedSource:Array<{path:string;previousBlob:string;currentBlob:string;lane:string}>;
 testCases:{ownerReadback:{old:number;new:number};actualOwnerNavigation:{old:number;new:number}};
 unchangedWorkflow:{path:string;blob:string;unchanged:boolean};
 securityInvariants:string[];acceptance:string;nextBatch:string;
};
/** Chain only exact SHA successors; a missing or mismatched prior is a veto. */
const currentLandingBlob=(path:string,prior:string|undefined):string=>{
 if(typeof prior!=="string"||!/^[a-f0-9]{40}$/.test(prior))
   throw Error("Missing reviewed owner-landing SHA: "+path);
 const successor=landingBranch.changedSource.find(x=>x.path===path);
 // Do not apply the landing predecessor after a reviewed later complete
 // source successor was already checked by another historical reader.
 if(ownerLandingRls.changedSource.some(item=>item.path===path && item.currentBlob===prior))
   return prior;
 // A QA test may have an earlier recovery successor not yet traversed.
 // Resolve the new default-branch correction here only for the owner landing;
 // the later recovery reader applies it after its own exact previous SHA.
 const isLanding=path==="src/app/onboarding/verified/page.tsx";
 if(!successor)return currentBranchAuditBlob(path,
   currentOwnerFormSafetyBlob(path,isLanding?currentQaDefaultBlob(path,prior):prior));
 expect(successor.previousBlob,path).toBe(prior);
 return currentBranchAuditBlob(path,
   currentOwnerFormSafetyBlob(path,isLanding?currentQaDefaultBlob(path,successor.currentBlob):successor.currentBlob));
};
const checkEmailResendRaw=read("docs/delivery/sonic-p02-check-email-resend-bounded-notice-successor-20261108.json");
const checkEmailResend=JSON.parse(checkEmailResendRaw.toString()) as {
 schema:string;batchId:string;ownerChat:string;sourceOnly:boolean;reviewedParentHead:string;
 predecessor:{path:string;blob:string;unchanged:boolean};
 historicAuthFeedback:{path:string;blob:string;unchanged:boolean};
 historicSignupReceipt:{path:string;blob:string;unchanged:boolean};
 changedSource:Array<{path:string;previousBlob:string|null;currentBlob:string;lane:string}>;
 testCases:{authUrl:{previous:number;current:number};signupConfirm:{previous:number;current:number}};
 unchangedWorkflows:Array<{path:string;blob:string;unchanged:boolean}>;
 advisory:string;invariants:string[];acceptance:string;nextBatch:string;
};
const currentCheckEmailBlob=(path:string,previous:string|undefined):string=>{
 if(typeof previous!=="string" || !/^[a-f0-9]{40}$/.test(previous))
   throw Error("Missing prior reviewed check-email SHA: "+path);
 const next=checkEmailResend.changedSource.find(x=>x.path===path);
 if(!next)return previous;
 expect(next.previousBlob,path).toBe(previous);
 return next.currentBlob;
};
const qaActiveDefaultRaw=read("docs/delivery/sonic-p02-qa-active-default-renamed-branch-successor-20261109.json");
const qaActiveDefault=JSON.parse(qaActiveDefaultRaw.toString()) as {
 schema:string;batchId:string;ownerChat:string;sourceOnly:boolean;parentHead:string;
 predecessor:{path:string;blob:string;unchanged:boolean};
 changedSource:Array<{path:string;previousBlob:string;currentBlob:string;lane:string}>;
 tests:{path:string;previous:number;current:number;added:number;scope:string};
 immutableSources:Array<{path:string;blob:string;unchanged:boolean}>;
 invariants:string[];acceptance:string;
};
const currentQaDefaultBlob=(path:string,previous:string|undefined):string=>{
 if(typeof previous!=="string" || !/^[a-f0-9]{40}$/.test(previous))
   throw new Error("Missing reviewed QA default branch source SHA: "+path);
 const successor=qaActiveDefault.changedSource.find(item=>item.path===path);
 // A newer independently pinned owner-landing source may already have been
 // composed by an earlier historical reader. Its exact current blob is
 // separately checked below; never route it back to this older predecessor.
 if(ownerLandingRls.changedSource.some(item=>item.path===path && item.currentBlob===previous))
   return previous;
 if(!successor)return previous;
 // Multiple independent historical critics may compose the same exact
 // successor. If the earlier lineage already resolved to this pin, do not
 // wrongly interpret the final SHA as a new predecessor or waive the pin.
 if(previous===successor.currentBlob)return previous;
 expect(successor.previousBlob,path).toBe(previous);
 return successor.currentBlob;
};
const qaOwnerReadRaw=read("docs/delivery/sonic-p02-qa-owner-lookup-transport-successor-20261109.json");
const qaOwnerRead=JSON.parse(qaOwnerReadRaw.toString()) as {
 schema:string;batchId:string;ownerChat:string;sourceOnly:boolean;reviewedParentHead:string;
 predecessor:{path:string;blob:string;unchanged:boolean};
 priorExactHeadCi:{run:number;sha:string;result:string;meaning:string};
 changedSource:Array<{path:string;previousBlob:string;currentBlob:string;lane:string}>;
 tests:{path:string;old:number;current:number;added:number};
 unchangedSource:Array<{path:string;blob:string;unchanged:boolean}>;
 invariants:string[];acceptance:string;nextBatch:string;
};
const qaNoProviderRaw=read("docs/delivery/sonic-p02-qa-no-provider-request-reuse-successor-20261109.json");
const qaNoProvider=JSON.parse(qaNoProviderRaw.toString()) as {
 schema:string;batchId:string;ownerChat:string;sourceOnly:boolean;reviewedParentHead:string;
 predecessor:{path:string;blob:string;unchanged:boolean};
 changedSource:Array<{path:string;previousBlob:string;currentBlob:string;lane:string}>;
 tests:{path:string;previous:number;current:number;added:number;scope:string};
 unchangedSource:Array<{path:string;blob:string;unchanged:boolean}>;
 guards:string[];acceptance:string;
};
const qaPropertyPreflightRaw=read("docs/delivery/sonic-p02-qa-saved-property-branch-before-request-successor-20261109.json");
const qaPropertyPreflight=JSON.parse(qaPropertyPreflightRaw.toString()) as {
 schema:string;batchId:string;ownerChat:string;sourceOnly:boolean;reviewedParentHead:string;
 predecessor:{path:string;blob:string;unchanged:boolean};
 changedSource:Array<{path:string;previousBlob:string;currentBlob:string;lane:string}>;
 regressionTests:{path:string;previous:number;current:number;added:number;scope:string};
 unchangedSource:Array<{path:string;blob:string;unchanged:boolean}>;
 guards:string[];acceptance:string;
};
const qaContactlessRaw=read("docs/delivery/sonic-p02-qa-fictional-contactless-customer-property-successor-20261109.json");
const qaContactless=JSON.parse(qaContactlessRaw.toString()) as {
 schema:string;batchId:string;ownerChat:string;sourceOnly:boolean;reviewedParentHead:string;
 predecessor:{path:string;blob:string;unchanged:boolean};
 changedSource:Array<{path:string;previousBlob:string;currentBlob:string;lane:string}>;
 tests:{path:string;previous:number;current:number;added:number;scope:string};
 unchangedProofs:Array<{path:string;blob:string;unchanged:boolean}>;
 invariants:string[];acceptance:string;
};
const qaLifecycleRaw=read("docs/delivery/sonic-p02-qa-new-status-service-assignment-successor-20261110.json");
const qaLifecycle=JSON.parse(qaLifecycleRaw.toString()) as {
 schema:string;batchId:string;ownerChat:string;sourceOnly:boolean;reviewedParentHead:string;
 predecessor:{path:string;blob:string;unchanged:boolean};
 changedSource:Array<{path:string;previousBlob:string;currentBlob:string;lane:string}>;
 qa:{path:string;previous:number;current:number;added:number;scope:string};
 businessScenario:string;unchangedSource:Array<{path:string;blob:string;unchanged:boolean}>;
 invariants:string[];acceptance:string;nextBatch:string;
};
const currentQaLifecycleBlob=(path:string,prior:string|undefined):string=>{
 if(typeof prior!=="string"||!/^[a-f0-9]{40}$/.test(prior))
   throw Error("Missing reviewed QA lifecycle SHA: "+path);
 const delta=qaLifecycle.changedSource.find(x=>x.path===path);
 if(!delta)return prior;
 if(prior===delta.currentBlob)return prior;
 if(prior!==delta.previousBlob)return prior;
 expect(delta.previousBlob,path).toBe(prior);
 return delta.currentBlob;
};
const currentQaContactlessBlob=(path:string,prior:string|undefined):string=>{
 if(typeof prior!=="string"||!/^[a-f0-9]{40}$/.test(prior))
  throw Error("Missing reviewed QA contactless source SHA: "+path);
 const delta=qaContactless.changedSource.find(x=>x.path===path);
 if(!delta)return currentOwnerLandingRlsBlob(path,prior);
 if(prior===delta.currentBlob)return currentQaLifecycleBlob(path,currentOwnerLandingRlsBlob(path,prior));
 // An older historical source lock may precede multiple reviewed successors.
 // Never override its predecessor until the exact previous SHA is reached.
 if(prior!==delta.previousBlob)return currentOwnerLandingRlsBlob(path,prior);
 expect(delta.previousBlob,path).toBe(prior);
 return currentQaLifecycleBlob(path,currentOwnerLandingRlsBlob(path,delta.currentBlob));
};
const currentQaPropertyPreflightBlob=(path:string,prior:string|undefined):string=>{
 if(typeof prior!=="string"||!/^[a-f0-9]{40}$/.test(prior))
  throw Error("Missing reviewed QA property source SHA: "+path);
 const successor=qaPropertyPreflight.changedSource.find(item=>item.path===path);
 if(!successor)return currentQaContactlessBlob(path,prior);
 if(prior===successor.currentBlob)return currentQaContactlessBlob(path,prior);
 // The independently reviewed prior synthetic-marker successor must have
 // resolved before applying this later exact saved-property improvement.
 if(prior!==successor.previousBlob)return currentQaContactlessBlob(path,prior);
 expect(successor.previousBlob,path).toBe(prior);
 return currentQaContactlessBlob(path,successor.currentBlob);
};
const currentQaNoProviderBlob=(path:string,prior:string|undefined):string=>{
 if(typeof prior!=="string"||!/^[a-f0-9]{40}$/.test(prior))
   throw Error("Missing reviewed QA synthetic request source SHA: "+path);
 const successor=qaNoProvider.changedSource.find(item=>item.path===path);
 if(!successor)return currentQaPropertyPreflightBlob(path,prior);
 if(prior===successor.currentBlob)return currentQaPropertyPreflightBlob(path,prior);
 // Older review layers may have a real earlier predecessor. Their own
 // assertions must complete first. The exact final source pins below are
 // mandatory, not inferred from a passed-through earlier SHA.
 if(prior!==successor.previousBlob)return currentQaPropertyPreflightBlob(path,prior);
 expect(successor.previousBlob,path).toBe(prior);
 return currentQaPropertyPreflightBlob(path,successor.currentBlob);
};
const currentQaOwnerLookupBlob=(path:string,prior:string|undefined):string=>{
 if(typeof prior!=="string"||!/^[a-f0-9]{40}$/.test(prior))
   throw Error("Missing predecessor SHA for QA owner transport "+path);
 const delta=qaOwnerRead.changedSource.find(x=>x.path===path);
 if(!delta)return currentQaNoProviderBlob(path,prior);
 expect(delta.previousBlob,path).toBe(prior);
 return currentQaNoProviderBlob(path,delta.currentBlob);
};
const ownerFormSafetyRaw=read("docs/delivery/sonic-p02-owner-form-eligibility-valid-actor-successor-20261109.json");
const ownerFormSafety=JSON.parse(ownerFormSafetyRaw.toString()) as {
 schema:string;batchId:string;ownerChat:string;sourceOnly:boolean;parentHead:string;
 predecessor:{path:string;blob:string;unchanged:boolean};
 changedSource:Array<{path:string;previousBlob:string;currentBlob:string;lane:string}>;
 regressionTests:Array<{path:string;previous:number;current:number;added:number}>;
 unchangedWorkflow:{path:string;blob:string;unchanged:boolean};
 invariants:string[];acceptance:string;
};
const ownerFormTreeRaw=read("docs/delivery/sonic-p02-owner-form-react-tree-critic-correction-20261109.json");
const ownerFormTree=JSON.parse(ownerFormTreeRaw.toString()) as {
 schema:string;batchId:string;ownerChat:string;sourceOnly:boolean;parentHead:string;
 predecessor:{path:string;blob:string;unchanged:boolean};
 changedSource:Array<{path:string;previousBlob:string;currentBlob:string;lane:string}>;
 testCases:{path:string;previous:number;current:number;added:number};
 unchangedApplicationSource:Array<{path:string;blob:string;unchanged:boolean}>;
 unchangedWorkflow:{path:string;blob:string;unchanged:boolean};
 invariants:string[];acceptance:string;
};
const ownerLandingRlsRaw=read("docs/delivery/sonic-p02-owner-landing-rls-transport-failclosed-successor-20261110.json");
const ownerLandingRls=JSON.parse(ownerLandingRlsRaw.toString()) as {
 schema:string;batchId:string;ownerChat:string;sourceOnly:boolean;reviewedParentHead:string;
 predecessor:{path:string;blob:string;unchanged:boolean};
 changedSource:Array<{path:string;previousBlob:string;currentBlob:string;lane:string}>;
 tests:{path:string;previous:number;current:number;added:number;scope:string};
 unchangedSources:Array<{path:string;blob:string;unchanged:boolean}>;
 vetoes:string[];acceptance:string;
};
const onboardingVetoRaw=read("docs/delivery/sonic-p02-onboarding-direct-auth-foreign-rls-veto-successor-20261111.json");
const onboardingVeto=JSON.parse(onboardingVetoRaw.toString()) as {
 schema:string;batchId:string;ownerChat:string;sourceOnly:boolean;reviewedParentHead:string;
 predecessor:{path:string;blob:string;unchanged:boolean};
 changedSource:Array<{path:string;previousBlob:string;currentBlob:string;lane:string}>;
 qa:{selectedSuite:{path:string;previous:number;current:number;added:number};otherSuite:{path:string;total:number;negativeExpectationUpdated:boolean};scope:string};
 businessScenario:string;unchangedSource:Array<{path:string;blob:string;unchanged:boolean}>;
 invariants:string[];acceptance:string;nextBatch:string;
};
const returnedMembershipRaw=read("docs/delivery/sonic-p02-onboarding-returned-owner-membership-veto-successor-20261111.json");
const returnedMembership=JSON.parse(returnedMembershipRaw.toString()) as {
 schema:string;batchId:string;ownerChat:string;sourceOnly:boolean;reviewedParentHead:string;
 predecessor:{path:string;blob:string;unchanged:boolean};
 changedSource:Array<{path:string;previousBlob:string;currentBlob:string;lane:string}>;
 qa:{primary:{path:string;previous:number;current:number;added:number};secondary:{path:string;previous:number;current:number;added:number};scope:string};
 businessScenario:string;unchangedSource:Array<{path:string;blob:string;unchanged:boolean}>;
 invariants:string[];acceptance:string;nextBatch:string;
};
const typedFixtureRaw=read("docs/delivery/sonic-p02-owner-membership-typed-fixture-repair-20261111.json");
const typedFixture=JSON.parse(typedFixtureRaw.toString()) as {
 schema:string;batchId:string;ownerChat:string;sourceOnly:boolean;reviewedParentHead:string;
 predecessor:{path:string;blob:string;unchanged:boolean};
 changedSource:Array<{path:string;previousBlob:string;currentBlob:string;lane:string}>;
 diagnosis:string;qa:{path:string;count:number;change:string};
 invariants:string[];acceptance:string;nextBatch:string;
};
const explicitOnboardingRaw=read("docs/delivery/sonic-p02-explicit-onboarding-confirmed-owner-preflight-successor-20261111.json");
const explicitOnboarding=JSON.parse(explicitOnboardingRaw.toString()) as {
 schema:string;batchId:string;ownerChat:string;sourceOnly:boolean;reviewedParentHead:string;
 predecessor:{path:string;blob:string;unchanged:boolean};
 changedSource:Array<{path:string;previousBlob:string;currentBlob:string;lane:string}>;
 qa:{path:string;previous:number;current:number;added:number;scope:string};
 unchangedSources:Array<{path:string;blob:string;unchanged:boolean}>;
 invariants:string[];acceptance:string;
};
const currentExplicitOnboardingBlob=(path:string,prior:string|undefined):string=>{
 if(typeof prior!=="string"||!/^[a-f0-9]{40}$/.test(prior))
   throw Error("Missing reviewed P02 explicit owner Auth source SHA: "+path);
 const successor=explicitOnboarding.changedSource.find(x=>x.path===path);
 if(!successor)return prior;
 if(prior===successor.currentBlob)return prior;
 // Older source lineage is checked independently. A missing predecessor must
 // never silently waive the new SHA: exact current pins below are mandatory.
 if(prior!==successor.previousBlob)return prior;
 expect(successor.previousBlob,path).toBe(prior);
 return successor.currentBlob;
};
const currentTypedFixtureBlob=(path:string,prior:string|undefined):string=>{
 if(typeof prior!=="string"||!/^[a-f0-9]{40}$/.test(prior))
   throw Error("Missing reviewed owner QA test SHA "+path);
 const delta=typedFixture.changedSource.find(x=>x.path===path);
 if(!delta)return prior;
 if(prior===delta.currentBlob)return prior;
 if(prior!==delta.previousBlob)return prior;
 expect(delta.previousBlob,path).toBe(prior);
 return delta.currentBlob;
};
const currentReturnedMembershipBlob=(path:string,prior:string|undefined):string=>{
 if(typeof prior!=="string"||!/^[a-f0-9]{40}$/.test(prior))
   throw Error("Missing reviewed returned membership source SHA: "+path);
 const delta=returnedMembership.changedSource.find(x=>x.path===path);
 if(!delta)return currentTypedFixtureBlob(path,prior);
 if(prior===delta.currentBlob)return currentTypedFixtureBlob(path,prior);
 if(prior!==delta.previousBlob)return currentTypedFixtureBlob(path,prior);
 expect(delta.previousBlob,path).toBe(prior);
 return currentTypedFixtureBlob(path,delta.currentBlob);
};
const currentOnboardingVetoBlob=(path:string,prior:string|undefined):string=>{
 if(typeof prior!=="string"||!/^[a-f0-9]{40}$/.test(prior))
   throw Error("Missing approved P02 onboarding tenant SHA: "+path);
 const next=onboardingVeto.changedSource.find(x=>x.path===path);
 if(!next)return currentReturnedMembershipBlob(path,prior);
 if(prior===next.currentBlob)return currentReturnedMembershipBlob(path,prior);
 if(prior!==next.previousBlob)return currentReturnedMembershipBlob(path,prior);
 expect(next.previousBlob,path).toBe(prior);
 return currentReturnedMembershipBlob(path,next.currentBlob);
};
const currentOwnerLandingRlsBlob=(path:string,previous:string|undefined):string=>{
 if(typeof previous!=="string"||!/^[a-f0-9]{40}$/.test(previous))
   throw Error("Missing reviewed owner-landing source SHA: "+path);
 const successor=ownerLandingRls.changedSource.find(x=>x.path===path);
 if(!successor)return currentOnboardingVetoBlob(path,previous);
 if(previous===successor.currentBlob)return currentOnboardingVetoBlob(path,previous);
 // The older exact hash chain must reach this successor's own predecessor;
 // do not claim a new SHA if a legacy parent is unresolved.
 if(previous!==successor.previousBlob)return currentOnboardingVetoBlob(path,previous);
 expect(successor.previousBlob,path).toBe(previous);
 return currentOnboardingVetoBlob(path,successor.currentBlob);
};
const postRpcRecoveryRaw=read("docs/delivery/sonic-p02-post-rpc-readback-throw-recovery-successor-20261111.json");
const postRpcRecovery=JSON.parse(postRpcRecoveryRaw.toString()) as {
 schema:string;batchId:string;ownerChat:string;sourceOnly:boolean;reviewedParentHead:string;
 predecessor:{path:string;blob:string;unchanged:boolean};
 changedSource:Array<{path:string;previousBlob:string;currentBlob:string;lane:string}>;
 qa:{path:string;previous:number;current:number;added:number;scenarios:string[]};
 businessScenario:string;
 unchangedSource:Array<{path:string;blob:string;unchanged:boolean}>;
 invariants:string[];acceptance:string;nextBatch:string;
};
/** Apply only the exact final reviewed source to its already verified parent. */
const rpcErrorPairRaw=read("docs/delivery/sonic-p02-rpc-error-pair-recovery-successor-20261111.json");
const rpcErrorPair=JSON.parse(rpcErrorPairRaw.toString()) as {
 schema:string;batchId:string;ownerChat:string;sourceOnly:boolean;reviewedParentHead:string;
 predecessor:{path:string;blob:string;unchanged:boolean};
 changedSource:Array<{path:string;previousBlob:string;currentBlob:string;lane:string}>;
 qa:{path:string;previous:number;current:number;added:number;ambiguousReturnedErrors:string[];deterministicPreExecutionCodes:string[]};
 businessScenario:string;externalDocumentation:string[];
 unchangedSources:Array<{path:string;blob:string;unchanged:boolean}>;
 invariants:string[];acceptance:string;nextBatch:string;
};
const currentRpcErrorPairBlob=(path:string,prior:string|undefined):string=>{
 if(typeof prior!=="string"||!/^[a-f0-9]{40}$/.test(prior))
   throw Error("Missing approved RPC result error-pair SHA: "+path);
 const next=rpcErrorPair.changedSource.find(x=>x.path===path);
 if(!next)return prior;
 if(prior===next.currentBlob)return prior;
 if(prior!==next.previousBlob)return prior;
 expect(next.previousBlob,path).toBe(prior);
 return next.currentBlob;
};
const currentPostRpcRecoveryBlob=(path:string,prior:string|undefined):string=>{
 if(typeof prior!=="string"||!/^[a-f0-9]{40}$/.test(prior))
   throw Error("Missing approved post-RPC owner readback SHA: "+path);
 const successor=postRpcRecovery.changedSource.find(item=>item.path===path);
 if(!successor)return currentRpcErrorPairBlob(path,prior);
 if(prior===successor.currentBlob)return currentRpcErrorPairBlob(path,prior);
 if(prior!==successor.previousBlob)return currentRpcErrorPairBlob(path,prior);
 expect(successor.previousBlob,path).toBe(prior);
 return currentRpcErrorPairBlob(path,successor.currentBlob);
};
const currentOwnerFormTreeBlob=(path:string,previous:string|undefined):string=>{
 if(typeof previous!=="string"||!/^[a-f0-9]{40}$/.test(previous))
  throw Error("Missing reviewed actual React-tree QA SHA: "+path);
 const correction=ownerFormTree.changedSource.find(entry=>entry.path===path);
 if(!correction)return currentPostRpcRecoveryBlob(path,currentOwnerLandingRlsBlob(path,previous));
 if(previous===correction.currentBlob)return currentPostRpcRecoveryBlob(path,currentOwnerLandingRlsBlob(path,previous));
 // Historical lineage may not yet have reached this approved test witness.
 if(previous!==correction.previousBlob)return currentPostRpcRecoveryBlob(path,currentOwnerLandingRlsBlob(path,previous));
 expect(correction.previousBlob,path).toBe(previous);
 return currentPostRpcRecoveryBlob(path,currentOwnerLandingRlsBlob(path,correction.currentBlob));
};
const currentOwnerFormSafetyBlob=(path:string,prior:string|undefined):string=>{
 if(typeof prior!=="string"||!/^[a-f0-9]{40}$/.test(prior))
   throw Error("Missing reviewed owner form or registration SHA: "+path);
 const source=ownerFormSafety.changedSource.find(x=>x.path===path);
 if(!source)return currentOwnerFormTreeBlob(path,prior);
 if(source.currentBlob===prior)return currentOwnerFormTreeBlob(path,prior);
 // This helper can run before the older predecessor's own successor is
 // composed. The final exact-path test below still requires the reviewed SHA.
 if(source.previousBlob!==prior)return currentOwnerFormTreeBlob(path,prior);
 expect(source.previousBlob,path).toBe(prior);
 return currentOwnerFormTreeBlob(path,source.currentBlob);
};
const branchAuditRaw=read("docs/delivery/sonic-p02-two-owner-branch-assignment-audit-successor-20261109.json");
const branchAudit=JSON.parse(branchAuditRaw.toString()) as {
 schema:string;batchId:string;ownerChat:string;sourceOnly:boolean;reviewedParentHead:string;
 predecessor:{path:string;blob:string;unchanged:boolean};
 priorOwnerLanding:{path:string;blob:string;unchanged:boolean};
 changedSource:Array<{path:string;previousBlob:string;currentBlob:string;lane:string}>;
 businessScenario:string;
 nodeCalls:{perTwoOwnersBefore:number;perTwoOwnersAfter:number;readOnlyGetsBefore:number;readOnlyGetsAfter:number;readOnlyRpcPosts:number};
 qaSourceCases:{branchReadbackBefore:number;branchReadbackAfter:number};
 unchangedSources:Array<{path:string;blob:string;unchanged:boolean}>;
 invariants:string[];acceptance:string;nextBatch:string;
};
/** Apply only the exact newer reviewed source after all prior SHA successors. */
const currentBranchAuditBlob=(path:string,prior:string|undefined):string=>{
 if(typeof prior!=="string" || !/^[a-f0-9]{40}$/.test(prior))
   throw Error("Missing reviewed two-owner branch audit ancestor "+path);
 const next=branchAudit.changedSource.find(x=>x.path===path);
 if(!next)return currentOwnerLandingRlsBlob(path,prior);
 expect(next.previousBlob,path).toBe(prior);
 return currentOwnerLandingRlsBlob(path,next.currentBlob);
};
const p02NodeGateRaw=read("docs/delivery/sonic-p02-node-adversarial-gate-successor-20261109.json");
const p02NodeGate=JSON.parse(p02NodeGateRaw.toString()) as {
 schema:string;batchId:string;ownerChat:string;sourceOnly:boolean;reviewedParentHead:string;
 predecessor:{path:string;blob:string;unchanged:boolean};
 reviewedChanges:Array<{path:string;previousBlob:string;currentBlob:string;lane:string}>;
 testEntrypoint:string;
 integratedSuites:Array<{path:string;tests:number}>;
 expectedTotalNodeCases:number;
 immutableSource:Array<{path:string;blob:string;unchanged:boolean}>;
 invariants:string[];acceptance:string;nextBatch:string;
};
const reviewedP02NodeGateBlob=(path:string,prior:string|undefined):string=>{
 if(typeof prior!=="string"||!/^[a-f0-9]{40}$/.test(prior))
   throw Error("Missing old P02 Node CI gate blob "+path);
 const delta=p02NodeGate.reviewedChanges.find(x=>x.path===path);
 if(!delta)return prior;
 expect(delta.previousBlob,path).toBe(prior);
 return delta.currentBlob;
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
  expect(gitHash(p03CurrencyRaw)).toBe("d7648d1fd14e3e58f584cb0f03e5a386e4c3087d");
  expect(p03Currency.schema).toBe("servicedesk.p03.currency-first-run-owner-ux-source-successor.v1");
  expect(p03Currency.predecessor.path).toBe("docs/delivery/sonic-p02-registered-owner-ui-source-successor-20261106.json");
  expect(p03Currency.predecessor.blob).toBe(gitHash(p02Raw));
  expect(p03Currency.predecessor.unchanged).toBe(true);
  expect(p03Currency.changedSource.map(x=>x.path)).toEqual([
   "src/app/auth/create-workspace/page.tsx",
   "tests/e2e/p02-workspace-error-origin.test.ts",
  ]);
  expect(gitHash(workspaceTransportRaw)).toBe("2e0c0fd319fce1b72ea679768181af3207dba9b4");
  expect(workspaceTransport.schema).toBe("servicedesk.p02.owner-workspace-transport-uncertainty.v1");
  expect(workspaceTransport.predecessor.path).toBe("docs/delivery/sonic-p02-registered-owner-ui-source-successor-20261106.json");
  expect(workspaceTransport.predecessor.blob).toBe(gitHash(p02Raw));
  expect(workspaceTransport.predecessor.unchanged).toBe(true);
  expect(workspaceTransport.p03CurrencyPredecessor.blob).toBe(gitHash(p03CurrencyRaw));
  expect(workspaceTransport.p03CurrencyPredecessor.unchanged).toBe(true);
  expect(workspaceTransport.changedSource.map(x=>x.path)).toEqual([
    "src/app/auth/create-workspace/actions.ts",
    "tests/e2e/p02-registration-denial-action.test.ts",
  ]);
  // P02 MAIN-branch independent readback is an additive successor: never rewrite
  // earlier registration, P03 currency, F15 or navigation source pins.
  expect(ownerMainBranch.schema).toBe("servicedesk.p02.owner-main-branch-saved-rsls-readback.v1");
  expect(ownerMainBranch.batchId).toBe("P02-OWNER_REGISTRATION_MAIN_BRANCH_PERSISTENCE_READBACK-20261108");
  expect(ownerMainBranch.sourceOnly).toBe(true);
  expect(ownerMainBranch.ownerChat).toBe("PRODUCTION");
  expect(ownerMainBranch.parentHead).toBe("69f51b69af73fc9846ffd3a871e56386f4e20e47");
  expect(ownerMainBranch.predecessor).toEqual({"path":"docs/delivery/sonic-p02-active-owner-malformed-slug-veto-20261108.json","blob":"746c0779c9edbda494d3fe466584c0797e87f152","unchanged":true});
  expect(ownerMainBranch.predecessor.blob).toBe(gitHash(malformedOwnerSlugRaw));
  expect(ownerMainBranch.changedSource).toEqual([
  {
    "path": "src/features/auth/verified-owner-workspace.ts",
    "previousBlob": "1983ddf2bdca7c1015c84933b59b29a81a6b21d3",
    "currentBlob": "c1720bdc1f144357126352f54b19699739d5e612",
    "lane": "AUTH_RLS_SAVED_BRANCH_READBACK"
  },
  {
    "path": "tests/e2e/p02-owner-registration-persisted-receipt.test.ts",
    "previousBlob": "c3ae8c36b4e59e8a4362eeaaa651442079a1d8b3",
    "currentBlob": "33a3ea21d41d6553b8cdd716465777e02d106d25",
    "lane": "INDEPENDENT_SAVED_BRANCH_QA"
  },
  {
    "path": "tests/e2e/p02-registration-denial-action.test.ts",
    "previousBlob": "37ecfaba9c14a442b2a9beccf77d2aa850673622",
    "currentBlob": "d5c288aa516ae3e9b2c2f84302de22942748085f",
    "lane": "SERVER_ACTION_DENIAL_QA"
  }
]);
  for(const x of ownerMainBranch.changedSource){
    expect(x.path).not.toContain("..");
    expect(gitHash(read(x.path)),x.path).toBe(currentLandingBlob(x.path,x.currentBlob));
  }
  expect(ownerMainBranch.dbSourceUnchanged).toEqual([
  {
    "path": "supabase/migrations/0059_v3_verified_owner_workspace_bootstrap.sql",
    "blob": "ee237941a371bf36ac39641fe8c1b65ae516ebe3",
    "unchanged": true
  },
  {
    "path": "supabase/migrations/0065_v4_default_branch_membership_authority.sql",
    "blob": "a1d1097c1c31ae258ec4151b7d208bb3c415c21a",
    "unchanged": true
  }
]);
  for(const x of ownerMainBranch.dbSourceUnchanged){
    expect(x.unchanged).toBe(true);
    expect(gitHash(read(x.path)),x.path).toBe(x.blob);
  }
  expect(ownerMainBranch.workflowUnchanged).toEqual({"path":".github/workflows/v4-sonic-ir21-f20-owner-finance-retention-ci.yml","blob":"634d35b6eb34025df560b78f0dfbe3354988238c","unchanged":true});
  expect(gitHash(read(ownerMainBranch.workflowUnchanged.path)))
    .toBe(ownerMainBranch.workflowUnchanged.blob);
  expect(ownerMainBranch.expectedNewCases).toEqual({readbackSuite:{previous:6,current:8},serverActionSuite:{previous:11,current:12}});
  expect(ownerMainBranch.checkedNewBranchFields).toEqual(["id","workspace_id","code","timezone","currency","is_default","active"]);
  expect(ownerMainBranch.checkedOwnerBranchMembershipFields).toEqual(["workspace_id","branch_id","user_id","status"]);
  for(const rule of [
    "NO_ONBOARDING_SUCCESS_WITHOUT_RLS_SAVED_MAIN_BRANCH",
    "NO_ONBOARDING_SUCCESS_WITHOUT_ACTIVE_OWNER_BRANCH_MEMBERSHIP",
    "NO_CROSS_TENANT_OR_FOREIGN_BRANCH_RECEIPT",
    "NO_CONNECTED_AUTH_DB_WRITES",
    "NO_MIGRATION_INSTALL",
    "NO_VERCEL_DEPLOY",
    "P02_2_OF_7",
    "P03_0_OF_6",
  ])expect(ownerMainBranch.invariants).toContain(rule);
  expect(ownerMainBranch.acceptance).toBe("SOURCE_ONLY_NOT_TWO_REAL_OWNER_SIGNED_IN_BROWSER_JWT_RLS");
  expect(ownerMainBranch.nextBatch).toBe("P02_818_REAL_OWNER_A_B_APPROVALS");
  // Additional reviewed source successor; all owner MAIN-branch and older
  // registration, reset, F23 and F26 manifests remain byte-identical.
  expect(gitHash(ownerMainBranchRaw)).toBe("d881bf6a90a3387cff6465798342138aa7106479");
  expect(recoveryQaTransport.schema).toBe("servicedesk.p02.recovery-and-qa-transport-uncertain-successor.v1");
  expect(recoveryQaTransport.batchId).toBe("P02-RECOVERY_AND_QA_SEED_DENY_RAW_500_OR_FALSE_POST_COMMIT_RECEIPT-20261108");
  expect(recoveryQaTransport.chat).toBe("PRODUCTION_SOURCE");
  expect(recoveryQaTransport.sourceOnly).toBe(true);
  expect(recoveryQaTransport.parentHead).toBe("e98e4ff0048f283a2272a00924e5f27feee635f5");
  expect(recoveryQaTransport.predecessor).toEqual({path:"docs/delivery/sonic-p02-owner-main-branch-saved-readback-successor-20261108.json",blob:"d881bf6a90a3387cff6465798342138aa7106479",unchanged:true});
  expect(recoveryQaTransport.predecessor.blob).toBe(gitHash(ownerMainBranchRaw));
  expect(recoveryQaTransport.changedSource).toEqual([
    {path:"src/app/auth/reset-password/actions.ts",previousBlob:"833aa5e9a09d4153faea12aa7178bf7d7f1f9c94",currentBlob:"5c9919850e8ddadfb5b361d8cb942c4f7785d945",lane:"RECOVERY_ACTION"},
    {path:"src/app/auth/reset-password/page.tsx",previousBlob:"9a771cc40a68b8c5c50aaaf00ea346b1603fef45",currentBlob:"905c32bf18e1658a1ab88f6c437bf58a8c6c4fc3",lane:"RECOVERY_UI"},
    {path:"src/features/auth/verified-auth-feedback.ts",previousBlob:"cd689d192e816ccd9a1d0f0a1851f5ef97d7f728",currentBlob:"334b7b1aa396a5608ab89839071632880bc805ce",lane:"TRUSTED_FEEDBACK"},
    {path:"src/app/onboarding/verified/qa-seed-actions.ts",previousBlob:"5828d942a092d300a03f54ca751525f67a7c7056",currentBlob:"132e72cd4ea64e6c89fdc8cba3c2ae1c78aa71d9",lane:"QA_SEED_ACTION"},
    {path:"tests/e2e/p02-reset-password-session-closure.test.ts",previousBlob:"d6bc935818c6f33a45301840b4e0b04dbe256eb6",currentBlob:"f6d1ac6a027823e0b4fb8d6ddbf605cf175164f6",lane:"RECOVERY_ADVERSARIAL_QA"},
    {path:"tests/e2e/p02-qa-seed-url-saved-proof.test.ts",previousBlob:"55ab5017788b95128e2f5a7982f744f7e3fd6277",currentBlob:"0795016afdc513196fecb9b802ec9710a3720968",lane:"QA_FIXTURE_ADVERSARIAL_QA"}
  ]);
  expect(new Set(recoveryQaTransport.changedSource.map(source=>source.path)).size).toBe(6);
  for(const source of recoveryQaTransport.changedSource){
    expect(source.path).not.toContain("..");
    expect(gitHash(read(source.path)),source.path).toBe(currentQaOwnerLookupBlob(source.path,currentQaDefaultBlob(source.path,source.currentBlob)));
  }
  expect(recoveryQaTransport.regressionTests).toEqual([
    {path:"tests/e2e/p02-reset-password-session-closure.test.ts",previous:7,current:11,added:4},
    {path:"tests/e2e/p02-qa-seed-url-saved-proof.test.ts",previous:6,current:11,added:5}
  ]);
  expect(recoveryQaTransport.unchangedIntegrationWorkflow).toEqual({
    path:".github/workflows/v4-sonic-ir21-f20-owner-finance-retention-ci.yml",blob:"634d35b6eb34025df560b78f0dfbe3354988238c",unchanged:true
  });
  expect(gitHash(read(recoveryQaTransport.unchangedIntegrationWorkflow.path)))
    .toBe(recoveryQaTransport.unchangedIntegrationWorkflow.blob);
  for(const guard of ["NO_PASSWORD_UPDATE_ON_THROWN_OR_USERLESS_AUTH","NO_RESET_SUCCESS_ON_PARTIAL_OR_FOREIGN_UPDATED_USER","NO_SECOND_RESET_FORM_ON_UNCERTAIN_POST_UPDATE_RESULT","NO_QA_SEED_SUCCESS_ON_PARTIALLY_COMMITTED_TRANSPORT","NO_CONNECTED_SUPABASE_DB_OR_AUTH_WRITE","NO_DEPLOY_OR_PROVIDER_SEND","P02_REMAINS_OPEN_2_OF_7"])
    expect(recoveryQaTransport.guards).toContain(guard);
  expect(recoveryQaTransport.acceptance).toBe("SOURCE_ONLY_PENDING_REAL_TWO_OWNER_JWT_RLS_UAT");

  // Independent P02 landing acceptance: a verified OWNER alone is insufficient
  // to claim the saved default branch. Historic manifests remain unchanged.
  expect(landingBranch.schema).toBe("servicedesk.p02.verified-owner-landing-branch-readback-successor.v1");
  expect(landingBranch.batchId).toBe("P02-VERIFIED_LANDING_DIRECT_URL_MUST_PROVE_SAVED_BRANCH-20261108");
  expect(landingBranch.ownerChat).toBe("PRODUCTION");
  expect(landingBranch.sourceOnly).toBe(true);
  expect(landingBranch.reviewedParentHead).toBe("343beb7e7dee5f21358c73dfec004fbdeb3b4586");
  expect(landingBranch.predecessor).toEqual({"path":"docs/delivery/sonic-p02-recovery-qa-transport-uncertain-successor-20261108.json","blob":"b0f53922940f8025a2979e4dbd30528ef2639245","unchanged":true});
  expect(landingBranch.predecessor.blob).toBe(gitHash(recoveryQaTransportRaw));
  expect(landingBranch.priorOwnerBranchReadback).toEqual({"path":"docs/delivery/sonic-p02-owner-main-branch-saved-readback-successor-20261108.json","blob":"d881bf6a90a3387cff6465798342138aa7106479","unchanged":true});
  expect(landingBranch.priorOwnerBranchReadback.blob).toBe(gitHash(ownerMainBranchRaw));
  expect(landingBranch.changedSource).toEqual([{"path":"src/features/auth/verified-owner-workspace.ts","previousBlob":"c1720bdc1f144357126352f54b19699739d5e612","currentBlob":"1eef6fb6efe364d0dd816f5f11ecb2e3a4169ddf","lane":"AUTH_RLS_SHARED_SAVED_PROOF"},{"path":"src/app/onboarding/verified/page.tsx","previousBlob":"12eafdfa355d0c2fe59c3fa72a6533993627f60c","currentBlob":"d87b1b171095e17f5799b0b77fdee2e829a76add","lane":"OWNER_SUCCESS_LANDING"},{"path":"tests/e2e/p02-owner-registration-persisted-receipt.test.ts","previousBlob":"33a3ea21d41d6553b8cdd716465777e02d106d25","currentBlob":"90755da47752e142b7081e93a9ac04c1aa742c2d","lane":"INDEPENDENT_BRANCH_READBACK_QA"},{"path":"tests/e2e/p02-workspace-error-origin.test.ts","previousBlob":"abd144788272813d937fb2d0082b6d559b6a3dd1","currentBlob":"b490f5decc44e631ff6aef895b5b142f5f926fb0","lane":"ACTUAL_LANDING_SERVER_COMPONENT_QA"}]);
  expect(new Set(landingBranch.changedSource.map(s=>s.path)).size).toBe(4);
  for(const entry of landingBranch.changedSource){
    expect(entry.path).not.toContain("..");
    expect(gitHash(read(entry.path)),entry.path)
      .toBe(currentExplicitOnboardingBlob(entry.path,
        currentBranchAuditBlob(entry.path,
          currentOwnerFormSafetyBlob(entry.path,currentQaDefaultBlob(entry.path,entry.currentBlob)))));
  }
  expect(landingBranch.testCases).toEqual({ownerReadback:{old:8,new:10},actualOwnerNavigation:{old:31,new:35}});
  expect(landingBranch.unchangedWorkflow).toEqual({path:".github/workflows/v4-sonic-ir21-f20-owner-finance-retention-ci.yml",blob:"634d35b6eb34025df560b78f0dfbe3354988238c",unchanged:true});
  expect(gitHash(read(landingBranch.unchangedWorkflow.path))).toBe(landingBranch.unchangedWorkflow.blob);
  for(const guard of ["NO_READY_LANDING_WITHOUT_RLS_SAVED_DEFAULT_BRANCH","NO_READY_LANDING_WITHOUT_ACTIVE_OWNER_BRANCH_ASSIGNMENT","NO_QA_SEED_UI_ON_UNVERIFIED_BRANCH","NO_FALSE_500_ON_THROWN_DEFAULT_BRANCH_READ","NO_CONNECTED_AUTH_DB_WRITE","NO_SQL_OR_RELEASE_FLAG_CHANGE","NO_VERCEL_DEPLOY","P02_STAYS_OPEN_2_OF_7","P03_STAYS_OPEN_0_OF_6"])
    expect(landingBranch.securityInvariants).toContain(guard);
  expect(landingBranch.acceptance).toBe("INTEGRATED_SOURCE_ONLY_NOT_REAL_TWO_OWNER_BROWSER_JWT_RLS");
  expect(landingBranch.nextBatch).toBe("P02_818_EXACT_OWNER_SCOPED_AUTH_DB_APPROVAL");
  // Additive lock for the actual check-email resend and bounded confirmation UI.
  // Earlier source proof is immutable and still checked independently.
  expect(checkEmailResend.schema).toBe("servicedesk.p02.check-email-resend-transport-and-url-notice.v1");
  expect(checkEmailResend.batchId).toBe("P02-VERIFICATION_RESEND_SINGLE_REQUEST_AND_BOUNDED_NOTICE-20261108");
  expect(checkEmailResend.ownerChat).toBe("PRODUCTION_SOURCE");
  expect(checkEmailResend.sourceOnly).toBe(true);
  expect(checkEmailResend.reviewedParentHead).toBe("a36baf43c71101b857906b219f3edce7253be7ed");
  expect(checkEmailResend.predecessor).toEqual({"path":"docs/delivery/sonic-p02-verified-landing-saved-branch-successor-20261108.json","blob":"afece1f197317157ec0534823b51b6afa2c15753","unchanged":true});
  expect(checkEmailResend.predecessor.blob).toBe(gitHash(landingBranchRaw));
  expect(checkEmailResend.historicAuthFeedback).toEqual({"path":"docs/delivery/sonic-p02-auth-feedback-surface-successor-20261107.json","blob":"cc0c2d4e18777def4db57e8e15c0d73119cb64f3","unchanged":true});
  expect(checkEmailResend.historicAuthFeedback.blob).toBe(gitHash(authFeedbackRaw));
  expect(checkEmailResend.historicSignupReceipt).toEqual({"path":"docs/delivery/sonic-p02-signup-user-receipt-successor-20261107.json","blob":"96a70397dbbf60f8ab3f8a6ab5617e754b2d0b83","unchanged":true});
  expect(checkEmailResend.historicSignupReceipt.blob).toBe(gitHash(signupUserReceiptRaw));
  expect(checkEmailResend.changedSource).toEqual([{"path":"src/features/auth/check-email-feedback.ts","previousBlob":null,"currentBlob":"59332813362bb69cc5bf66293c90f128826bb7c6","lane":"VERIFICATION_FEEDBACK"},{"path":"src/app/auth/sign-up/check-email/actions.ts","previousBlob":"265fdc9e75e5341369b7e8928d3ebbc75ec3a8e8","currentBlob":"29e32db14a5a6eac143bd3be5acc7a6f965db0c7","lane":"AUTH_RESEND"},{"path":"src/app/auth/sign-up/check-email/page.tsx","previousBlob":"015f3d1a811ffb24b6417d9d17996dd463d0cd27","currentBlob":"2f3cf8b5ade3c7eabdb4dd8e8f3c2b82a6ed0f30","lane":"ONBOARDING_UI"},{"path":"tests/e2e/p02-auth-url-feedback-integrity.test.ts","previousBlob":"9e7d4cf6436084b99284b5da23b26181460df93f","currentBlob":"486f7787f28eac806f9e1776e1c964327d2972b5","lane":"ADVERSARIAL_URL_QA"},{"path":"tests/e2e/p02-signup-confirm-transport-outcome.test.ts","previousBlob":"6d5d988a535039b03df8fcf7082caeea8f3f3b42","currentBlob":"2e7e16db357d1249d279e3729711cc2d64c70558","lane":"DIRECT_SERVER_ACTION_QA"}]);
  expect(new Set(checkEmailResend.changedSource.map(x=>x.path)).size).toBe(5);
  for(const change of checkEmailResend.changedSource){
    expect(change.path).not.toContain("..");
    expect(gitHash(read(change.path)),change.path).toBe(change.currentBlob);
  }
  expect(checkEmailResend.testCases).toEqual({authUrl:{previous:6,current:8},signupConfirm:{previous:12,current:17}});
  expect(checkEmailResend.unchangedWorkflows).toEqual([
    {path:".github/workflows/v4-sonic-ir21-f20-owner-finance-retention-ci.yml",blob:"634d35b6eb34025df560b78f0dfbe3354988238c",unchanged:true},
    {path:".github/workflows/sonic-p02-auth-origin-focused.yml",blob:"42e200cdfe166ebb0e2f5eb187b182ab81c24490",unchanged:true}
  ]);
  for(const unchanged of checkEmailResend.unchangedWorkflows){
    expect(unchanged.unchanged).toBe(true);
    expect(gitHash(read(unchanged.path)),unchanged.path).toBe(unchanged.blob);
  }
  expect(checkEmailResend.advisory).toContain("Delivery is not confirmed;");
  for(const rule of ["NO_ARBITRARY_URL_NOTICE_REFLECTION","NO_VERIFICATION_OR_DELIVERY_CLAIM_FROM_QUERY","NO_PROVIDER_ERROR_EMAIL_ENUMERATION","NO_RAW_PROVIDER_500_ON_THROWN_RESEND","NO_AUTOMATIC_RESEND_RETRY_AFTER_UNCERTAIN_TRANSPORT","NO_CONNECTED_AUTH_PROVIDER_CALL","NO_SUPABASE_DB_WRITE_OR_MIGRATION","NO_VERCEL_DEPLOY","P02_OPEN_2_OF_7","P03_OPEN_0_OF_6"])
    expect(checkEmailResend.invariants).toContain(rule);
  expect(checkEmailResend.acceptance).toBe("INTEGRATED_SOURCE_ONLY_NOT_REAL_TWO_OWNER_BROWSER_JWT_RLS");
  expect(checkEmailResend.nextBatch).toBe("P02_818_REAL_OWNER_A_B_AUTH_DBA_AND_STAGING_APPROVAL");
  // New reviewed P02 source successor: existing #915 manifests and independent
  // historic SHA verifications remain intact; no fake connected RLS receipts.
  expect(gitHash(checkEmailResendRaw)).toBe("711b21342218b4aa93c48d915e4fc9d2d2ebdc17");
  expect(qaActiveDefault.schema).toBe("servicedesk.p02.qa-verified-active-default-branch-successor.v1");
  expect(qaActiveDefault.batchId).toBe("P02-QA_RENAMED_DEFAULT_BRANCH_RLS_PROOF_AND_NO_FOREIGN_ASSIGNMENT_20261109");
  expect(qaActiveDefault.ownerChat).toBe("PRODUCTION_SOURCE");
  expect(qaActiveDefault.sourceOnly).toBe(true);
  expect(qaActiveDefault.parentHead).toBe("2c845c7221d0533522ba2720fccf26921f59681d");
  expect(qaActiveDefault.predecessor).toEqual({path:"docs/delivery/sonic-p02-check-email-resend-bounded-notice-successor-20261108.json",blob:"711b21342218b4aa93c48d915e4fc9d2d2ebdc17",unchanged:true});
  expect(qaActiveDefault.predecessor.blob).toBe(gitHash(checkEmailResendRaw));
  expect(qaActiveDefault.changedSource).toEqual([
    {path:"src/features/auth/qa-sample-seed.ts",previousBlob:"f1f5a88d0b2fecee4a511f9dc906aa48578f10ed",currentBlob:"5ed2e466b5b5fa74e3baa91c03140d1958510ed2",lane:"QA_DEFAULT_BRANCH_SEED"},
    {path:"src/features/auth/qa-sample-readback.ts",previousBlob:"736b636462305d8ba52e546b7a9fa2a95ec730d7",currentBlob:"39432b3b076939ed0f304d56e3a7fa21112c8b70",lane:"QA_INDEPENDENT_SAVED_RECEIPT"},
    {path:"src/app/onboarding/verified/qa-seed-actions.ts",previousBlob:"132e72cd4ea64e6c89fdc8cba3c2ae1c78aa71d9",currentBlob:"5013dcd824b3dca9141162c849ebef90795671d3",lane:"OWNER_BRANCH_WRITE_GATE"},
    {path:"src/app/onboarding/verified/page.tsx",previousBlob:"d87b1b171095e17f5799b0b77fdee2e829a76add",currentBlob:"ea3c0b9e38d2f10439c9823ff6bdb7c05701231f",lane:"QA_UI_DEFAULT_BRANCH_COPY"},
    {path:"tests/e2e/p02-qa-seed-url-saved-proof.test.ts",previousBlob:"0795016afdc513196fecb9b802ec9710a3720968",currentBlob:"f769b97c4256063ec9f4dd70cf0ebf3dd519e62b",lane:"QA_ADVERSARIAL_DEFAULT_BRANCH"}
  ]);
  expect(new Set(qaActiveDefault.changedSource.map(x=>x.path)).size).toBe(5);
  for(const changed of qaActiveDefault.changedSource){
    expect(changed.path).not.toContain("..");
    expect(gitHash(read(changed.path)),changed.path).toBe(currentQaOwnerLookupBlob(changed.path,changed.currentBlob));
  }
  expect(qaActiveDefault.tests).toEqual({
    path:"tests/e2e/p02-qa-seed-url-saved-proof.test.ts",
    previous:11,current:15,added:4,
    scope:"SYNTHETIC_RLS_QA_SEED_AND_DEFAULT_BRANCH_NO_LIVE_JWT"
  });
  expect(qaActiveDefault.immutableSources).toEqual([
    {path:"src/features/auth/verified-owner-workspace.ts",blob:"1eef6fb6efe364d0dd816f5f11ecb2e3a4169ddf",unchanged:true},
    {path:".github/workflows/v4-sonic-ir21-f20-owner-finance-retention-ci.yml",blob:"634d35b6eb34025df560b78f0dfbe3354988238c",unchanged:true},
    {path:"supabase/migrations/0059_v3_verified_owner_workspace_bootstrap.sql",blob:"ee237941a371bf36ac39641fe8c1b65ae516ebe3",unchanged:true},
    {path:"supabase/migrations/0065_v4_default_branch_membership_authority.sql",blob:"a1d1097c1c31ae258ec4151b7d208bb3c415c21a",unchanged:true}
  ]);
  for(const entry of qaActiveDefault.immutableSources){
    expect(entry.unchanged).toBe(true);
    expect(gitHash(read(entry.path)),entry.path).toBe(currentBranchAuditBlob(entry.path,entry.blob));
  }
  for(const rule of [
    "RENAME_DEFAULT_BRANCH_ALLOWED_FOR_EXISTING_OWNER",
    "QA_SEED_ONLY_ONE_ACTIVE_DEFAULT_BRANCH",
    "QA_SEED_REQUIRE_OWNER_ACTIVE_DEFAULT_ASSIGNMENT",
    "QA_RECEIPT_REQUIRE_SAVED_ACTIVE_DEFAULT_AND_BRANCH_MEMBERSHIP",
    "NO_CONNECTED_DB_AUTH_WRITE","NO_NEW_MIGRATION_OR_RELEASE_FLAG",
    "NO_DEPLOY_OR_PROVIDER_SEND","P02_STILL_OPEN_2_OF_7","P03_STILL_QUEUED_0_OF_6"
  ])expect(qaActiveDefault.invariants).toContain(rule);
  expect(qaActiveDefault.acceptance).toBe("SOURCE_ONLY_PENDING_TWO_REAL_OWNER_AUTHENTICATED_JWT_RLS");

  // Separate current source-only Owner QA POST guard. Historic QA
  // provenance is preserved exactly after #42518571140 corrected the source
  // critic's recovery/QA successor ordering.
  expect(qaOwnerRead.schema).toBe("servicedesk.p02.qa-owner-lookup-transport-fail-closed.v1");
  expect(qaOwnerRead.batchId).toBe("P02-QA_OWNER_LOOKUP_THROW_MUST_NEVER_WRITE-20261109");
  expect(qaOwnerRead.ownerChat).toBe("PRODUCTION_SOURCE");
  expect(qaOwnerRead.sourceOnly).toBe(true);
  expect(qaOwnerRead.reviewedParentHead).toBe("b461e2327b0d22c3e19986e525f958132e73f0b2");
  expect(qaOwnerRead.predecessor).toEqual({"path":"docs/delivery/sonic-p02-qa-active-default-renamed-branch-successor-20261109.json","blob":"27165dfaa660454176981aa00532c77bc0ba5b7a","unchanged":true});
  expect(qaOwnerRead.predecessor.blob).toBe(gitHash(qaActiveDefaultRaw));
  expect(qaOwnerRead.priorExactHeadCi).toEqual({run:42518571140,sha:"b461e2327b0d22c3e19986e525f958132e73f0b2",result:"SUCCESS",meaning:"SOURCE_ONLY_NOT_REAL_JWT"});
  expect(qaOwnerRead.changedSource).toEqual([{"path":"src/app/onboarding/verified/qa-seed-actions.ts","previousBlob":"5013dcd824b3dca9141162c849ebef90795671d3","currentBlob":"047dc7ed709946c41065027ac7cf18db4b284131","lane":"OWNER_RLS_POST_FAIL_CLOSED"},{"path":"tests/e2e/p02-qa-seed-url-saved-proof.test.ts","previousBlob":"f769b97c4256063ec9f4dd70cf0ebf3dd519e62b","currentBlob":"615106e53b8f476b04c3ec4abb36d5c7526a6d44","lane":"ADVERSARIAL_SERVER_ACTION_QA"}]);
  expect(new Set(qaOwnerRead.changedSource.map(x=>x.path)).size).toBe(2);
  for(const change of qaOwnerRead.changedSource){
    expect(change.path).not.toContain("..");
    expect(gitHash(read(change.path)),change.path)
      .toBe(currentQaNoProviderBlob(change.path,change.currentBlob));
  }
  expect(qaOwnerRead.tests).toEqual({path:"tests/e2e/p02-qa-seed-url-saved-proof.test.ts",old:15,current:18,added:3});
  expect(qaOwnerRead.unchangedSource).toEqual([{"path":"src/features/auth/qa-sample-seed.ts","blob":"5ed2e466b5b5fa74e3baa91c03140d1958510ed2","unchanged":true},{"path":"src/features/auth/qa-sample-readback.ts","blob":"39432b3b076939ed0f304d56e3a7fa21112c8b70","unchanged":true},{"path":"src/app/onboarding/verified/page.tsx","blob":"ea3c0b9e38d2f10439c9823ff6bdb7c05701231f","unchanged":true},{"path":".github/workflows/v4-sonic-ir21-f20-owner-finance-retention-ci.yml","blob":"634d35b6eb34025df560b78f0dfbe3354988238c","unchanged":true}]);
  for(const source of qaOwnerRead.unchangedSource){
    expect(source.unchanged).toBe(true);
    expect(gitHash(read(source.path)),source.path)
      .toBe(currentQaNoProviderBlob(source.path,source.blob));
  }
  for(const guard of ["NO_RAW_500_OR_QA_WRITE_ON_THROWN_OWNER_RLS_LOOKUP","NO_QA_WRITE_WHEN_OWNER_MISSING_OR_REVOKED","VERIFY_ACTIVE_DEFAULT_BRANCH_BEFORE_QA_SEED","PRESERVE_RENAMED_DEFAULT_BRANCH_FOR_LEGITIMATE_OWNER","NO_HISTORIC_CRITIC_SHA_WEAKENING","NO_CONNECTED_SUPABASE_AUTH_DB_WRITE","NO_MIGRATION_OR_PROVIDER_SEND_OR_DEPLOY","P02_OPEN_2_OF_7","P03_OPEN_0_OF_6"])
    expect(qaOwnerRead.invariants).toContain(guard);
  expect(qaOwnerRead.acceptance).toBe("SOURCE_ONLY_NOT_TWO_OWNER_LIVE_AUTHENTICATED_JWT_RLS");
  expect(qaOwnerRead.nextBatch).toBe("P02_818_OWNER_APPROVAL_FOR_TWO_REAL_QA_SESSIONS");
  // Additive predecessor-specific review. Older manifests/DB sources stay pinned.
  expect(gitHash(qaOwnerReadRaw)).toBe("1380dae4654336ea5ba0af5639ca93a3c3467b3c");
  expect(ownerFormSafety.schema).toBe("servicedesk.p02.owner-form-eligibility-and-verified-actor.v1");
  expect(ownerFormSafety.batchId).toBe("P02-OWNER_FORM_QA_ALLOWLIST_AND_VALID_AUTH_ID_BEFORE_RPC-20261109");
  expect(ownerFormSafety.ownerChat).toBe("PRODUCTION_SOURCE");
  expect(ownerFormSafety.sourceOnly).toBe(true);
  expect(ownerFormSafety.parentHead).toBe("6497e270cc66a274ffb042555b47101843e39e63");
  expect(ownerFormSafety.predecessor).toEqual({path:"docs/delivery/sonic-p02-qa-owner-lookup-transport-successor-20261109.json",blob:"1380dae4654336ea5ba0af5639ca93a3c3467b3c",unchanged:true});
  expect(ownerFormSafety.predecessor.blob).toBe(gitHash(qaOwnerReadRaw));
  expect(ownerFormSafety.changedSource).toEqual([
    {path:"src/app/auth/create-workspace/actions.ts",previousBlob:"8e3a6e0572c38680141ce86b5d7f5f84cf5d6dfd",currentBlob:"37871b966731acf08a65f9395577eb356c5177e5",lane:"AUTH_RPC_ACTOR_ID_VETO"},
    {path:"src/app/auth/create-workspace/page.tsx",previousBlob:"2ed68d7a1ae4449e43dfb852fd8e210640664e56",currentBlob:"98c3dd145b011211d345892c01851fa22c4aadc7",lane:"OWNER_QA_ELIGIBILITY_UI"},
    {path:"tests/e2e/p02-registration-denial-action.test.ts",previousBlob:"d5c288aa516ae3e9b2c2f84302de22942748085f",currentBlob:"1cd9e8e3aad8a35574180d7bc0b29dd7033d2065",lane:"ACTION_ADVERSARIAL_TEST"},
    {path:"tests/e2e/p02-workspace-error-origin.test.ts",previousBlob:"b490f5decc44e631ff6aef895b5b142f5f926fb0",currentBlob:"cf9f60ffc6003ba65afd42269504218af5922a9c",lane:"UI_ADVERSARIAL_TEST"}
  ]);
  expect(new Set(ownerFormSafety.changedSource.map(x=>x.path)).size).toBe(4);
  for(const source of ownerFormSafety.changedSource){
    expect(source.path).not.toContain("..");
    expect(gitHash(read(source.path)),source.path).toBe(currentExplicitOnboardingBlob(source.path,currentOwnerFormTreeBlob(source.path,source.currentBlob)));
  }
  // A successful registration RPC may already have committed before saved
  // owner/branch readback throws. Preserve the user's bounded verification
  // recovery path without a second implicit RPC, provider data, or fake READY.
  expect(postRpcRecovery.schema).toBe("servicedesk.p02.post-rpc-owner-readback-transport-recovery.v1");
  expect(postRpcRecovery.batchId).toBe("P02-OWNER_REGISTRATION_POST_RPC_READBACK_THROW_NO_SECOND_WRITE-20261111");
  expect(postRpcRecovery.ownerChat).toBe("PRODUCTION_SOURCE");
  expect(postRpcRecovery.sourceOnly).toBe(true);
  expect(postRpcRecovery.reviewedParentHead).toBe("f1f9fedcacb9891fe049a063ab1899674d8100e3");
  expect(postRpcRecovery.predecessor).toEqual({
    path:"docs/delivery/sonic-p02-owner-form-eligibility-valid-actor-successor-20261109.json",
    blob:"890dd874b96eb32aa6fb8ebee81e4d01ce359035",unchanged:true});
  expect(postRpcRecovery.predecessor.blob).toBe(gitHash(ownerFormSafetyRaw));
  expect(postRpcRecovery.changedSource).toEqual([{"path":"src/app/auth/create-workspace/actions.ts","previousBlob":"37871b966731acf08a65f9395577eb356c5177e5","currentBlob":"11a85433b84c88592d6efa270a5f832b9432b7a6","lane":"OWNER_AUTH_POST_COMMIT_TRANSPORT_FAIL_CLOSED"},{"path":"tests/e2e/p02-registration-denial-action.test.ts","previousBlob":"1cd9e8e3aad8a35574180d7bc0b29dd7033d2065","currentBlob":"d0257951ed4a8c8c7f823ccd91b88f96a696a3da","lane":"INDEPENDENT_POST_COMMIT_QA"}]);
  for(const change of postRpcRecovery.changedSource){
    expect(change.path).not.toContain("..");
    expect(gitHash(read(change.path)),change.path)
      .toBe(currentRpcErrorPairBlob(change.path,change.currentBlob));
  }
  expect(postRpcRecovery.qa).toEqual({
    path:"tests/e2e/p02-registration-denial-action.test.ts",
    previous:13,current:14,added:1,scenarios:[
      "new-owner-response-readback-throws",
      "existing-owner-response-readback-throws",
      "no-implicit-retry","no-provider-secret-leak"
    ]});
  expect(postRpcRecovery.businessScenario)
    .toContain("a bounded saved-workspace recovery route");
  expect(postRpcRecovery.unchangedSource).toEqual([{"path":"src/features/auth/verified-owner-workspace.ts","blob":"221b0f52e75d2231900767f91806b3ea874f32d7","unchanged":true},{"path":"src/features/auth/workspace-registration-error.ts","blob":"73e200d522da5bf4dabe0275f97860379f53637f","unchanged":true},{"path":".github/workflows/v4-sonic-ir21-f20-owner-finance-retention-ci.yml","blob":"634d35b6eb34025df560b78f0dfbe3354988238c","unchanged":true}]);
  for(const unchanged of postRpcRecovery.unchangedSource)
    expect(gitHash(read(unchanged.path)),unchanged.path).toBe(unchanged.blob);
  const ownerAction=read("src/app/auth/create-workspace/actions.ts").toString();
  expect(ownerAction).toContain("readback = await verifyOwnerWorkspaceCreationReadback(");
  expect(ownerAction).toContain("if (!readback?.ok)");
  for(const rule of ["NO_RAW_HTTP_500_AFTER_POSSIBLE_REGISTRATION_COMMIT","NO_FALSE_OWNER_READY_AFTER_THROWN_PERSISTENCE_READBACK","NO_AUTOMATIC_SECOND_REGISTRATION_RPC","NO_PRIVATE_PROVIDER_TRANSPORT_DETAILS_IN_REDIRECT","REUSE_EXISTING_UNCERTAIN_COMMIT_USER_RECOVERY","NO_CONNECTED_DB_AUTH_WRITE_OR_REGISTRATION_SQL","NO_CUSTOMER_PROVIDER_SEND_OR_PAYMENT","NO_DEPLOY_RELEASE_FLAG_PROTECTED_MERGE","P02_OPEN_2_OF_7","P03_OPEN_0_OF_6"])
    expect(postRpcRecovery.invariants).toContain(rule);
  expect(postRpcRecovery.acceptance)
    .toBe("INTEGRATED_SOURCE_TEST_NOT_AUTHENTICATED_REAL_TWO_OWNER_RLS");
  expect(rpcErrorPair.schema).toBe("servicedesk.p02.rpc-error-pair-ambiguous-post-commit-recovery.v1");
  expect(rpcErrorPair.batchId).toBe("P02-OWNER_REGISTRATION_RETURNED_RPC_ERROR_AMBIGUITY-20261111");
  expect(rpcErrorPair.ownerChat).toBe("PRODUCTION_SOURCE");
  expect(rpcErrorPair.sourceOnly).toBe(true);
  expect(rpcErrorPair.reviewedParentHead).toBe("8e4e96b08657597cf4fc967cd000c0accba09184");
  expect(rpcErrorPair.predecessor).toEqual({
    path:"docs/delivery/sonic-p02-post-rpc-readback-throw-recovery-successor-20261111.json",
    blob:"63587689beed682ffa268b43a5bff6f8d16b4c1a",unchanged:true});
  expect(rpcErrorPair.predecessor.blob).toBe(gitHash(postRpcRecoveryRaw));
  expect(rpcErrorPair.changedSource).toEqual([{"path":"src/app/auth/create-workspace/actions.ts","previousBlob":"11a85433b84c88592d6efa270a5f832b9432b7a6","currentBlob":"472496c93c64f33f64b8667ce4f67dcbb415b2e8","lane":"OWNER_RPC_RESULT_ERROR_AMBIGUOUS_RECOVERY"},{"path":"tests/e2e/p02-registration-denial-action.test.ts","previousBlob":"d0257951ed4a8c8c7f823ccd91b88f96a696a3da","currentBlob":"942a1ab6039958187ac2e0ba1e875e2a7d6882ca","lane":"INDEPENDENT_RETURNED_POSTGREST_ERROR_QA"}]);
  for(const next of rpcErrorPair.changedSource){
    expect(next.path).not.toContain("..");
    expect(gitHash(read(next.path)),next.path).toBe(next.currentBlob);
  }
  expect(rpcErrorPair.qa).toEqual({
    path:"tests/e2e/p02-registration-denial-action.test.ts",
    previous:14,current:15,added:1,
    ambiguousReturnedErrors:["missing-code","empty-code","PGRSTX00","08006"],
    deterministicPreExecutionCodes:["PGRST202","PGRST301","42501"]
  });
  expect(rpcErrorPair.businessScenario).toContain("bounded check-saved-workspaces recovery UI");
  expect(rpcErrorPair.externalDocumentation).toEqual([
    "https://supabase.com/docs/guides/api/automatic-retries-in-supabase-js",
    "https://supabase.com/docs/guides/api/handling-errors-in-supabase-js",
    "https://supabase.com/docs/guides/api/rest/postgrest-error-codes"
  ]);
  expect(rpcErrorPair.unchangedSources).toEqual([{"path":"src/features/auth/workspace-registration-error.ts","blob":"73e200d522da5bf4dabe0275f97860379f53637f","unchanged":true},{"path":"src/features/auth/verified-owner-workspace.ts","blob":"221b0f52e75d2231900767f91806b3ea874f32d7","unchanged":true},{"path":".github/workflows/v4-sonic-ir21-f20-owner-finance-retention-ci.yml","blob":"634d35b6eb34025df560b78f0dfbe3354988238c","unchanged":true}]);
  for(const unchanged of rpcErrorPair.unchangedSources)
    expect(gitHash(read(unchanged.path)),unchanged.path).toBe(unchanged.blob);
  const rpcAction=read("src/app/auth/create-workspace/actions.ts").toString();
  for(const code of ['code === "PGRST202"','code === "PGRST301"','code === "42501"'])
    expect(rpcAction).toContain(code);
  for(const rule of ["RETURNED_NETWORK_OR_UNKNOWN_RPC_ERROR_HAS_UNCERTAIN_COMMIT_NOTICE","RPC_POST_NOT_AUTOMATICALLY_RETRIED","NO_DUPLICATE_NONIDEMPOTENT_REGISTRATION_ON_UNCERTAIN_RPC","DETERMINISTIC_PGRST202_PGRST301_42501_NOT_FALSE_COMMIT","NO_PROVIDER_ERROR_MESSAGE_DISCLOSED","NO_SIGNED_IN_OWNER_READY_WITHOUT_RLS_READBACK","NO_CONNECTED_DB_AUTH_WRITE_OR_MIGRATION","NO_CUSTOMER_PROVIDER_PAYMENT_OR_DEPLOY","NO_PROTECTED_MERGE_NO_NEW_PR","P02_OPEN_2_OF_7","P03_OPEN_0_OF_6"])expect(rpcErrorPair.invariants).toContain(rule);
  expect(rpcErrorPair.acceptance).toBe("SOURCE_ONLY_OFFLINE_TESTS_NOT_REAL_TWO_OWNER_JWT_RLS");
  expect(rpcErrorPair.nextBatch).toBe("P02_818_AUTHORIZED_TWO_OWNER_SIGNED_IN_RLS_AND_APPROVED_SQL");
  // A direct /onboarding navigation must deny unverified identity transport;
  // extra foreign rows from an RLS-filtered workspace query veto selection.
  expect(onboardingVeto.schema).toBe("servicedesk.p02.onboarding-direct-auth-foreign-tenant-veto.v1");
  expect(onboardingVeto.batchId).toBe("P02-DIRECT_ONBOARDING_AUTH_FAILURE_AND_FOREIGN_RLS_ROW_VETO-20261111");
  expect(onboardingVeto.ownerChat).toBe("PRODUCTION_SOURCE");
  expect(onboardingVeto.sourceOnly).toBe(true);
  expect(onboardingVeto.reviewedParentHead).toBe("86eb1121151e0df6866df957dc776e59e50a3f96");
  expect(onboardingVeto.predecessor).toEqual({
    path:"docs/delivery/sonic-p02-rpc-error-pair-recovery-successor-20261111.json",
    blob:"84bfc9ae26367bec4004a2a80d6539e0934884b8",unchanged:true});
  expect(onboardingVeto.predecessor.blob).toBe(gitHash(rpcErrorPairRaw));
  expect(onboardingVeto.changedSource).toEqual([{"path":"src/features/onboarding/onboarding-product-runtime.ts","previousBlob":"7da899db0de552ce8184f7db36111bb17e5f0db0","currentBlob":"0b980b4b1991f41eb2f7f4f848073e2fb8acd15f","lane":"AUTHENTICATED_OWNER_ONBOARDING_ROUTE"},{"path":"src/features/onboarding/owner-onboarding-workspace-choice.ts","previousBlob":"5d2066f151aebb61957bd33170581dbac5d63fb6","currentBlob":"fbd623618b87718bffd16abc2b212db3f2e6aebf","lane":"OWNER_TENANT_RLS_FOREIGN_ROW_VETO"},{"path":"tests/e2e/p02-workspace-error-origin.test.ts","previousBlob":"cafb82ecfc548c4b649d02a023a295b2a10bad34","currentBlob":"a716260cf036f691927fa1d448b68f4ebd3b3958","lane":"INDEPENDENT_AUTH_RLS_ADVERSARIAL_QA"},{"path":"tests/e2e/v4-multiowner-onboarding-workspace-choice.test.ts","previousBlob":"778e65243cd65f641c580921dcbf1566a5c84d19","currentBlob":"a83f68b9121d9455adc4c15b4ae6102f2f843cf3","lane":"OWNER_CHOOSER_FOREIGN_RETURN_NEGATIVE"}]);
  for(const next of onboardingVeto.changedSource){
    expect(next.path).not.toContain("..");
    // Preserve the historical onboarding source and apply only the reviewed
    // current returned-membership successor when the older SHA matches.
    expect(gitHash(read(next.path)),next.path)
      .toBe(currentExplicitOnboardingBlob(next.path,
        currentReturnedMembershipBlob(next.path,next.currentBlob)));
  }
  expect(onboardingVeto.qa).toEqual({
    selectedSuite:{path:"tests/e2e/p02-workspace-error-origin.test.ts",previous:39,current:42,added:3},
    otherSuite:{path:"tests/e2e/v4-multiowner-onboarding-workspace-choice.test.ts",total:9,negativeExpectationUpdated:true},
    scope:"SYNTHETIC_ACTUAL_SOURCE_ENTRYPOINT_NOT_LIVE_JWT"
  });
  expect(onboardingVeto.businessScenario).toContain("a null identity presents safe sign-in guidance");
  expect(onboardingVeto.unchangedSource).toEqual([{"path":"src/features/auth/verified-owner-workspace.ts","blob":"221b0f52e75d2231900767f91806b3ea874f32d7","unchanged":true},{"path":"src/features/onboarding/OnboardingProductRoute.tsx","blob":"3a91b7fddf694336ac11b0d7a265de882bf66d09","unchanged":true},{"path":".github/workflows/v4-sonic-ir21-f20-owner-finance-retention-ci.yml","blob":"634d35b6eb34025df560b78f0dfbe3354988238c","unchanged":true},{"path":"supabase/migrations/0059_v3_verified_owner_workspace_bootstrap.sql","blob":"ee237941a371bf36ac39641fe8c1b65ae516ebe3","unchanged":true},{"path":"docs/delivery/sonic-p02-rpc-error-pair-recovery-successor-20261111.json","blob":"84bfc9ae26367bec4004a2a80d6539e0934884b8","unchanged":true}]);
  for(const witness of onboardingVeto.unchangedSource)
    expect(gitHash(read(witness.path)),witness.path).toBe(witness.blob);
  const defaultOnboarding=read("src/features/onboarding/onboarding-product-runtime.ts").toString();
  expect(defaultOnboarding).toContain("identity = await auth.auth.getUser()");
  expect(defaultOnboarding).toContain('kind: "authentication"');
  const chooser=read("src/features/onboarding/owner-onboarding-workspace-choice.ts").toString();
  expect(chooser).toContain('return { ok: false, code: "WORKSPACE_UNVERIFIED" }');
  expect(chooser).toContain("!owned.has(row.id)");
  for(const guard of ["NO_HTTP_500_ON_THROWN_UNSELECTED_ONBOARDING_AUTH","NO_RLS_MEMBERSHIP_READ_AFTER_UNVERIFIED_IDENTITY","NO_FALSE_OWNER_WORKSPACE_SELECTION_ON_FOREIGN_ROW_LEAK","NO_FOREIGN_TENANT_DISPLAY_NAME_LEAK_IN_NAVIGATION","RETAIN_LEGITIMATE_SINGLE_MULTIOWNER_SELECTION","RETAIN_OWNER_AUTH_REQUIRED_FOR_OPERATIONAL_BACKEND","NO_AUTH_USER_FIXTURE_OR_DB_WRITE","NO_MIGRATION_PROVIDER_PAYMENT_OR_DEPLOY","NO_PROTECTED_MERGE_OR_NEW_PR","P02_OPEN_2_OF_7","P03_OPEN_0_OF_6"])expect(onboardingVeto.invariants).toContain(guard);
  expect(onboardingVeto.acceptance).toBe("INTEGRATED_SOURCE_ONLY_NOT_REAL_OWNER_A_B_BROWSER_JWT_RLS");
  expect(onboardingVeto.nextBatch).toBe("P02_818_OWNER_APPROVAL_FOR_INACTIVE_DB_RECOVERY_DBA_SQL_AND_TWO_REAL_QA_OWNER_SESSIONS");
  // A row filtered by the caller's session does not independently attest
  // its subject, role or ACTIVE status. Veto untrusted returned memberships.
  expect(returnedMembership.schema).toBe("servicedesk.p02.owner-onboarding-returned-membership-identity-veto.v1");
  expect(returnedMembership.batchId).toBe("P02_OWNER_WORKSPACE_CHOOSER_VERIFY_ACTUAL_RETURNED_ROLE_SUBJECT_STATUS_20261111");
  expect(returnedMembership.ownerChat).toBe("PRODUCTION_SOURCE");
  expect(returnedMembership.sourceOnly).toBe(true);
  expect(returnedMembership.reviewedParentHead).toBe("7940b945f73afa0af946af8a8d8b96439bbc53a1");
  expect(returnedMembership.predecessor).toEqual({"path":"docs/delivery/sonic-p02-onboarding-direct-auth-foreign-rls-veto-successor-20261111.json","blob":"fa9f2d10a3e789f05e9dcf079d44e341507839e5","unchanged":true});
  expect(returnedMembership.predecessor.blob).toBe(gitHash(onboardingVetoRaw));
  expect(returnedMembership.changedSource).toEqual([{"path":"src/features/onboarding/owner-onboarding-workspace-choice.ts","previousBlob":"fbd623618b87718bffd16abc2b212db3f2e6aebf","currentBlob":"edc4c7c7976b9ec1f6ea14660232218049c81832","lane":"OWNER_RETURNED_MEMBERSHIP_SUBJECT_ROLE_STATUS_GUARD"},{"path":"tests/e2e/p02-workspace-error-origin.test.ts","previousBlob":"a716260cf036f691927fa1d448b68f4ebd3b3958","currentBlob":"56966913487c69c11c612ad0019ca2ccca165dc0","lane":"INDEPENDENT_P02_OWNER_SESSION_QA"},{"path":"tests/e2e/v4-multiowner-onboarding-workspace-choice.test.ts","previousBlob":"a83f68b9121d9455adc4c15b4ae6102f2f843cf3","currentBlob":"1a6b7dd23a7a3cd83807fe25f09736a5deeb28ae","lane":"MULTI_OWNER_CHOOSER_ROLE_SUBJECT_NEGATIVE_MATRIX"}]);
  for(const delta of returnedMembership.changedSource){
    expect(delta.path).not.toContain("..");
    expect(gitHash(read(delta.path)),delta.path)
      .toBe(currentExplicitOnboardingBlob(delta.path,
        currentTypedFixtureBlob(delta.path,delta.currentBlob)));
  }
  expect(returnedMembership.qa).toEqual({"primary":{"path":"tests/e2e/p02-workspace-error-origin.test.ts","previous":42,"current":43,"added":1},"secondary":{"path":"tests/e2e/v4-multiowner-onboarding-workspace-choice.test.ts","previous":9,"current":11,"added":2},"scope":"OFFLINE_RLS_SIMULATION_NO_REAL_OWNER_JWT"});
  expect(returnedMembership.businessScenario).toContain("individually verified saved membership");
  expect(returnedMembership.unchangedSource).toEqual([{"path":"src/features/auth/verified-owner-workspace.ts","blob":"221b0f52e75d2231900767f91806b3ea874f32d7","unchanged":true},{"path":"src/features/onboarding/onboarding-product-runtime.ts","blob":"0b980b4b1991f41eb2f7f4f848073e2fb8acd15f","unchanged":true},{"path":"src/features/onboarding/OnboardingProductRoute.tsx","blob":"3a91b7fddf694336ac11b0d7a265de882bf66d09","unchanged":true},{"path":".github/workflows/v4-sonic-ir21-f20-owner-finance-retention-ci.yml","blob":"634d35b6eb34025df560b78f0dfbe3354988238c","unchanged":true},{"path":"docs/delivery/sonic-p02-onboarding-direct-auth-foreign-rls-veto-successor-20261111.json","blob":"fa9f2d10a3e789f05e9dcf079d44e341507839e5","unchanged":true}]);
  for(const row of returnedMembership.unchangedSource)
    expect(gitHash(read(row.path)),row.path)
      .toBe(currentExplicitOnboardingBlob(row.path,row.blob));
  const ownerChoice=read("src/features/onboarding/owner-onboarding-workspace-choice.ts").toString();
  for(const statement of [
    '.select("workspace_id,user_id,role,status")',
    'row.user_id !== verifiedUserId',
    'row.role !== "OWNER"',
    'row.status !== "ACTIVE"'
  ])expect(ownerChoice).toContain(statement);
  for(const guard of ["REQUIRE_RETURNED_MEMBERSHIP_USER_ID_MATCHES_VERIFIED_ID","REQUIRE_RETURNED_MEMBERSHIP_ROLE_OWNER_ACTIVE","DENY_FOREIGN_REVOKED_STAFF_RETURNED_ROW_WITHOUT_WORKSPACE_QUERY","RETAIN_LEGITIMATE_MULTI_WORKSPACE_SELECTION","RETAIN_DUPLICATE_MEMBERSHIP_DEDUPLICATION","NO_PRIVATE_TENANT_OR_PROVIDER_DETAILS_EXPOSED","NO_CONNECTED_SUPABASE_AUTH_DB_WRITES","NO_SQL_MIGRATION_PROVIDER_PAYMENT_VERCEL_DEPLOY","NO_NEW_PR_NO_PROTECTED_BRANCH_MERGE","P02_OPEN_2_OF_7","P03_OPEN_0_OF_6"])
    expect(returnedMembership.invariants).toContain(guard);
  expect(returnedMembership.acceptance).toBe("SOURCE_ONLY_VERIFIED_MOCKED_ROWS_NOT_TWO_REAL_OWNER_BROWSER_JWT_RLS");
  expect(returnedMembership.nextBatch).toBe("P02_818_OWNER_GRANTED_TWO_REAL_AUTH_SESSIONS_DBA_APPROVED_REGISTRATION_SQL_AND_STAGING_READBACK");
  // Preserve the independently checked prior source before the typed
  // negative fixture correction required by the full repository compiler.
  expect(typedFixture.schema).toBe("servicedesk.p02.owner-membership-qa-typescript-repair.v1");
  expect(typedFixture.batchId).toBe("P02_OWNER_MEMBERSHIP_INVALID_WORKSPACE_TYPED_FIXTURE_20261111");
  expect(typedFixture.ownerChat).toBe("PRODUCTION_SOURCE");
  expect(typedFixture.sourceOnly).toBe(true);
  expect(typedFixture.reviewedParentHead).toBe("125f4be54796a1f41df503ca52f569bdd00c3c97");
  expect(typedFixture.predecessor).toEqual({"path":"docs/delivery/sonic-p02-onboarding-returned-owner-membership-veto-successor-20261111.json","blob":"bf9f1c538f17e74363310d3445e8873ed3299aa4","unchanged":true});
  expect(typedFixture.predecessor.blob).toBe(gitHash(returnedMembershipRaw));
  expect(typedFixture.changedSource).toEqual([{"path":"tests/e2e/v4-multiowner-onboarding-workspace-choice.test.ts","previousBlob":"1a6b7dd23a7a3cd83807fe25f09736a5deeb28ae","currentBlob":"e729a9f6bce2780824eb7cffe0fd3f0cb6cce25c","lane":"ADVERSARIAL_QA_TYPED_INVALID_WORKSPACE"}]);
  for(const delta of typedFixture.changedSource)
    expect(gitHash(read(delta.path)),delta.path).toBe(delta.currentBlob);
  expect(typedFixture.qa).toEqual({"path":"tests/e2e/v4-multiowner-onboarding-workspace-choice.test.ts","count":11,"change":"malformed-workspace-id-fixture-inherits-valid-owner-subject-role-active-state"});
  expect(typedFixture.diagnosis).toContain("TS2739");
  expect(read("tests/e2e/v4-multiowner-onboarding-workspace-choice.test.ts").toString())
    .toContain('{ ...membership(south), workspace_id: "../../foreign" }');
  for(const invariant of ["NO_SECURITY_POLICY_OR_LIVE_DATABASE_CHANGE","NO_NEW_OWNER_AUTH_OR_PROVIDER_WRITE","KEEP_HISTORICAL_MEMBERSHIP_MANIFEST_IMMUTABLE","TYPED_INVALID_WORKSPACE_RLS_NEGATIVE_RETAINED","NO_DEPLOY_OR_PROTECTED_MERGE","P02_STILL_NOT_REAL_STAGING_ACCEPTANCE"])
    expect(typedFixture.invariants).toContain(invariant);
  expect(typedFixture.acceptance).toBe("SOURCE_ONLY_PENDING_NEW_EXACT_HEAD_TYPESCRIPT_FULL_CI");
  expect(typedFixture.nextBatch).toBe("P02_818_AUTHORIZED_TWO_REAL_OWNER_SESSIONS_DBA_APPROVED_SQL_RLS");
  // Actual onboarding consistency fix, downstream authorization unchanged.
  // The previous reviewed source and all prior Git blobs stay immutable.
  expect(gitHash(typedFixtureRaw)).toBe("86bb32420543cbacf3af09201348c51536deaec8");
  expect(explicitOnboarding.schema).toBe("servicedesk.p02.explicit-onboarding-verified-owner-session.v1");
  expect(explicitOnboarding.batchId).toBe("P02-EXPLICIT_WORKSPACE_ONBOARDING_NO_UNCONFIRMED_AUTH_BYPASS-20261111");
  expect(explicitOnboarding.ownerChat).toBe("PRODUCTION_SOURCE");
  expect(explicitOnboarding.sourceOnly).toBe(true);
  expect(explicitOnboarding.reviewedParentHead).toBe("0d00b42778e0baeb1cb1b0c12be18bb1f6ef48a7");
  expect(explicitOnboarding.predecessor).toEqual({path:"docs/delivery/sonic-p02-owner-membership-typed-fixture-repair-20261111.json",blob:"86bb32420543cbacf3af09201348c51536deaec8",unchanged:true});
  expect(explicitOnboarding.predecessor.blob).toBe(gitHash(typedFixtureRaw));
  expect(explicitOnboarding.changedSource).toEqual([
    {path:"src/features/onboarding/onboarding-product-runtime.ts",previousBlob:"0b980b4b1991f41eb2f7f4f848073e2fb8acd15f",currentBlob:"52e0cf11818bf473ce6042c935986eec0baf4adf",lane:"BARE_AND_EXPLICIT_CONFIRMED_AUTH_PREFLIGHT"},
    {path:"tests/e2e/p02-workspace-error-origin.test.ts",previousBlob:"56966913487c69c11c612ad0019ca2ccca165dc0",currentBlob:"eab720d2b782d4825e68a3ab7dc330c642e2f149",lane:"DIRECT_EXPLICIT_WORKSPACE_AUTH_NEGATIVE_QA"}
  ]);
  expect(new Set(explicitOnboarding.changedSource.map(x=>x.path)).size).toBe(2);
  for(const source of explicitOnboarding.changedSource){
    expect(source.path).not.toContain("..");
    expect(gitHash(read(source.path)),source.path).toBe(source.currentBlob);
  }
  expect(explicitOnboarding.qa).toEqual({
    path:"tests/e2e/p02-workspace-error-origin.test.ts",
    previous:43,current:45,added:2,
    scope:"SYNTHETIC_ENTRYPOINT_NO_LIVE_OWNER_JWT"
  });
  expect(explicitOnboarding.unchangedSources).toEqual([
    {path:"src/features/onboarding/owner-onboarding-workspace-choice.ts",blob:"edc4c7c7976b9ec1f6ea14660232218049c81832",unchanged:true},
    {path:"src/features/onboarding/OnboardingProductRoute.tsx",blob:"3a91b7fddf694336ac11b0d7a265de882bf66d09",unchanged:true},
    {path:".github/workflows/v4-sonic-ir21-f20-owner-finance-retention-ci.yml",blob:"634d35b6eb34025df560b78f0dfbe3354988238c",unchanged:true}
  ]);
  for(const original of explicitOnboarding.unchangedSources){
    expect(original.unchanged).toBe(true);
    expect(gitHash(read(original.path)),original.path).toBe(original.blob);
  }
  for(const guard of ["DIRECT_ONBOARDING_EXPLICIT_SLUG_REQUIRES_CONFIRMED_AUTH",
    "NO_RAW_500_ON_NULL_UNDEFINED_AUTH_RESPONSE",
    "NO_WORKSPACE_MEMBERSHIP_READ_ON_UNVERIFIED_AUTH",
    "RETAIN_DOWNSTREAM_OWNER_ROLE_AND_WORKSPACE_RLS_AUTHORIZATION",
    "RETAIN_MULTIOWNER_AND_DUPLICATE_MEMBERSHIP_NAVIGATION",
    "NO_CONNECTED_SUPABASE_AUTH_DB_WRITE","NO_SQL_MIGRATION_OR_PROVIDER_SEND_OR_PAYMENT",
    "NO_DEPLOY_OR_PROTECTED_MERGE","P02_STILL_OPEN_2_OF_7","P03_QUEUED_0_OF_6"])
      expect(explicitOnboarding.invariants).toContain(guard);
  expect(explicitOnboarding.acceptance).toBe("SOURCE_ONLY_NOT_REAL_TWO_OWNER_JWT_BROWSER_RLS");





  expect(postRpcRecovery.nextBatch)
    .toBe("P02_818_EXPLICIT_OWNER_APPROVED_TWO_REAL_JWT_SESSIONS_AND_DBA_SQL_REVIEW");
  expect(ownerFormSafety.regressionTests).toEqual([
    {path:"tests/e2e/p02-registration-denial-action.test.ts",previous:12,current:13,added:1},
    {path:"tests/e2e/p02-workspace-error-origin.test.ts",previous:35,current:37,added:2}
  ]);
  expect(ownerFormSafety.unchangedWorkflow).toEqual({
    path:".github/workflows/v4-sonic-ir21-f20-owner-finance-retention-ci.yml",
    blob:"634d35b6eb34025df560b78f0dfbe3354988238c",unchanged:true
  });
  expect(gitHash(read(ownerFormSafety.unchangedWorkflow.path))).toBe(ownerFormSafety.unchangedWorkflow.blob);
  for(const req of ["NO_QA_UNAPPROVED_OWNER_REGISTRATION_FORM",
    "NO_WORKSPACE_REGISTRATION_RPC_ON_MISSING_OR_MALFORMED_AUTH_USER_ID",
    "NO_CONNECTED_SUPABASE_AUTH_OR_DB_WRITE","NO_REGISTRATION_GUARD_INSTALL",
    "NO_DEPLOY_OR_MERGE","P02_OPEN_2_OF_7","P03_OPEN_0_OF_6"])
    expect(ownerFormSafety.invariants).toContain(req);
  expect(ownerFormSafety.acceptance).toBe("INTEGRATED_SOURCE_ONLY_NOT_TWO_REAL_OWNER_AUTHENTICATED_JWT_RLS");
  // Explicit QA tree witness correction, retaining the source fix and all
  // historical source manifest bytes, including the original test predecessor.
  expect(gitHash(ownerFormSafetyRaw)).toBe("890dd874b96eb32aa6fb8ebee81e4d01ce359035");
  expect(ownerFormTree.schema).toBe("servicedesk.p02.owner-form-test-tree-critic-correction.v1");
  expect(ownerFormTree.batchId).toBe("P02-QA_OWNER_FORM_REACT_LINK_WITNESS_AND_SOURCE_ORDER-20261109");
  expect(ownerFormTree.ownerChat).toBe("PRODUCTION_SOURCE");
  expect(ownerFormTree.sourceOnly).toBe(true);
  expect(ownerFormTree.parentHead).toBe("c18aee3c38b17edf3af568509b4dc4e4c48e7f05");
  expect(ownerFormTree.predecessor).toEqual({path:"docs/delivery/sonic-p02-owner-form-eligibility-valid-actor-successor-20261109.json",blob:"890dd874b96eb32aa6fb8ebee81e4d01ce359035",unchanged:true});
  expect(ownerFormTree.predecessor.blob).toBe(gitHash(ownerFormSafetyRaw));
  expect(ownerFormTree.changedSource).toEqual([
    {path:"tests/e2e/p02-workspace-error-origin.test.ts",previousBlob:"cf9f60ffc6003ba65afd42269504218af5922a9c",currentBlob:"23aa52648145f76b0e5fd9adab3ef45f5b2b1249",lane:"ACTUAL_REACT_ELEMENT_QA_WITNESS"}
  ]);
  expect(gitHash(read(ownerFormTree.changedSource[0].path)))
    .toBe(currentExplicitOnboardingBlob(ownerFormTree.changedSource[0].path,
      currentOwnerLandingRlsBlob(ownerFormTree.changedSource[0].path,ownerFormTree.changedSource[0].currentBlob)));
  expect(ownerFormTree.testCases).toEqual({path:"tests/e2e/p02-workspace-error-origin.test.ts",previous:37,current:37,added:0});
  expect(ownerFormTree.unchangedApplicationSource).toEqual([
    {path:"src/app/auth/create-workspace/actions.ts",blob:"37871b966731acf08a65f9395577eb356c5177e5",unchanged:true},
    {path:"src/app/auth/create-workspace/page.tsx",blob:"98c3dd145b011211d345892c01851fa22c4aadc7",unchanged:true}
  ]);
  for(const src of ownerFormTree.unchangedApplicationSource){
    expect(src.unchanged).toBe(true);
    // Historical owner form inputs remain pinned. A separately reviewed
    // post-RPC error successor may advance only the exact registered action.
    expect(gitHash(read(src.path)),src.path)
      .toBe(currentPostRpcRecoveryBlob(src.path,src.blob));
  }
  expect(ownerFormTree.unchangedWorkflow).toEqual({
    path:".github/workflows/v4-sonic-ir21-f20-owner-finance-retention-ci.yml",
    blob:"634d35b6eb34025df560b78f0dfbe3354988238c",unchanged:true
  });
  expect(gitHash(read(ownerFormTree.unchangedWorkflow.path))).toBe(ownerFormTree.unchangedWorkflow.blob);
  for(const guard of ["NO_CIRCULAR_REACT_JSX_SERIALIZATION",
    "RETAIN_ACTUAL_FORM_AND_AUTHORIZED_LINK_WITNESS",
    "ALL_HISTORIC_GIT_BLOB_PINS_RETAINED",
    "NO_CONNECTED_AUTH_OR_DATABASE_WRITE","P02_OPEN_2_OF_7","P03_OPEN_0_OF_6","NO_DEPLOY_OR_MERGE"])
    expect(ownerFormTree.invariants).toContain(guard);
  expect(ownerFormTree.acceptance).toBe("SOURCE_CORRECTION_ONLY_AWAIT_EXACT_HEAD_CI_NOT_REAL_OWNER_JWT_RLS");


  // Read-only real-session audit is an acceptance tool, not a real owner
  // receipt in CI. The saved branch's valid billing state and exact owner
  // assignment must both be proved; foreign assignment reads cannot be
  // narrowed by actor/branch/status and accidentally conceal an RLS leak.
  expect(branchAudit.schema).toBe("servicedesk.p02.two-owner-branch-assignment-and-saved-billing-validation.v1");
  expect(branchAudit.batchId).toBe("P02-AUTH_OWNER_DEFAULT_BRANCH_ASSIGNMENT_REAL_READONLY_A_B-20261109");
  expect(branchAudit.ownerChat).toBe("PRODUCTION_SOURCE");
  expect(branchAudit.sourceOnly).toBe(true);
  expect(branchAudit.reviewedParentHead).toBe("430bfb6c15bc328fd9b52c60c1798009f8e517a1");
  expect(branchAudit.predecessor).toEqual({
    path:"docs/delivery/sonic-p02-owner-form-react-tree-critic-correction-20261109.json",
    blob:"143ecec7e3003ceb4bc892950fa81fd07ac29cc9",unchanged:true});
  expect(branchAudit.predecessor.blob).toBe(gitHash(ownerFormTreeRaw));
  expect(branchAudit.priorOwnerLanding).toEqual({
    path:"docs/delivery/sonic-p02-verified-landing-saved-branch-successor-20261108.json",
    blob:"afece1f197317157ec0534823b51b6afa2c15753",unchanged:true});
  expect(branchAudit.priorOwnerLanding.blob).toBe(gitHash(landingBranchRaw));
  expect(branchAudit.changedSource).toEqual([{"path":"src/features/auth/verified-owner-workspace.ts","previousBlob":"1eef6fb6efe364d0dd816f5f11ecb2e3a4169ddf","currentBlob":"221b0f52e75d2231900767f91806b3ea874f32d7","lane":"OWNER_BRANCH_SAVED_CURRENCY_TIMEZONE"},{"path":"tests/e2e/p02-owner-registration-persisted-receipt.test.ts","previousBlob":"90755da47752e142b7081e93a9ac04c1aa742c2d","currentBlob":"de02499d2af06fcbf6e88a07a39027b8a1eb731c","lane":"OWNER_SAVED_BRANCH_ADVERSARIAL_QA"},{"path":"scripts/release/v4-p02-two-owner-readonly-acceptance.mjs","previousBlob":"f2d619d2c445a2045d1ccb31426de71a3ffcccda","currentBlob":"dc7d6b1d3b2eb84b3554c9c6b822b310049ea4a9","lane":"TWO_OWNER_LIVE_READONLY_RUNNER"},{"path":"scripts/release/v4-p02-two-owner-readonly-acceptance.test.mjs","previousBlob":"9dba110b6d186f73b8d184f04c8307f8337ffa50","currentBlob":"7be7fc80bbb4563ebc2b8da7e0de8a53e4a85726","lane":"INTEGRATION_NODE_CI_QA"},{"path":"scripts/release/tests/v4-p02-two-owner-readonly-acceptance.test.mjs","previousBlob":"b3729edf1737ece7947ef173204ba7194067c44d","currentBlob":"2eff1ec1fbcb96a2bbeb30e6af2acc309a394bb8","lane":"ADVERSARIAL_SEPARATE_OWNER_NEGATIVE_QA"},{"path":"scripts/release/tests/v4-p02-two-owner-authorization-proof.test.mjs","previousBlob":"1de9983cd2bdd67020ce85dabc07e833da546bcc","currentBlob":"da39317cab102594f780a3e2a60f5de2a8c3199b","lane":"INDEPENDENT_BRANCH_AUTHORIZATION_CRITIC"}]);
  expect(new Set(branchAudit.changedSource.map(x=>x.path)).size).toBe(6);
  for(const delta of branchAudit.changedSource){
    expect(delta.path).not.toContain("..");
    expect(gitHash(read(delta.path)),delta.path).toBe(reviewedP02NodeGateBlob(delta.path,delta.currentBlob));
  }
  // Enforce every previously source-authored independent A/B negative in the
  // existing IR21 Node command; a green run must not mean nine tests only.
  expect(p02NodeGate.schema).toBe("servicedesk.p02.two-owner-adversarial-gate-coverage.v1");
  expect(p02NodeGate.batchId).toBe("P02-READONLY_A_B_INDEPENDENT_NODE_SUITES_IN_MAIN_CI-20261109");
  expect(p02NodeGate.ownerChat).toBe("PRODUCTION_SOURCE");
  expect(p02NodeGate.sourceOnly).toBe(true);
  expect(p02NodeGate.reviewedParentHead).toBe("24f5bd5b87caa74affd9d54af5521750a4b0f4f1");
  expect(p02NodeGate.predecessor).toEqual({
    path:"docs/delivery/sonic-p02-two-owner-audit-critic-history-successor-20261109.json",
    blob:"ebe27df1d45592ab34be73cdbe3781a293c4bd3a",unchanged:true});
  expect(p02NodeGate.predecessor.blob).toBe(gitHash(read(p02NodeGate.predecessor.path)));
  expect(p02NodeGate.reviewedChanges).toEqual([{"path":"scripts/release/v4-p02-two-owner-readonly-acceptance.test.mjs","previousBlob":"7be7fc80bbb4563ebc2b8da7e0de8a53e4a85726","currentBlob":"ed6862cb74f12a1d9508e60c3ae2ddadfbf80653","lane":"CI_NODE_ADVERSARIAL_INTEGRATION"}]);
  for(const source of p02NodeGate.reviewedChanges)
    expect(gitHash(read(source.path)),source.path).toBe(source.currentBlob);
  expect(p02NodeGate.testEntrypoint)
    .toBe("node --test scripts/release/v4-p02-two-owner-readonly-acceptance.test.mjs");
  expect(p02NodeGate.integratedSuites).toEqual([{"path":"scripts/release/v4-p02-two-owner-readonly-acceptance.test.mjs","tests":9},{"path":"scripts/release/tests/v4-p02-two-owner-readonly-acceptance.test.mjs","tests":7},{"path":"scripts/release/tests/v4-p02-two-owner-authorization-proof.test.mjs","tests":18}]);
  expect(p02NodeGate.expectedTotalNodeCases).toBe(34);
  expect(p02NodeGate.integratedSuites.reduce((sum,x)=>sum+x.tests,0))
    .toBe(p02NodeGate.expectedTotalNodeCases);
  const integratedNodeTest=read(p02NodeGate.testEntrypoint.split(" ").at(-1)!).toString();
  for(const suite of p02NodeGate.integratedSuites.slice(1)){
    const importRelative="./tests/"+suite.path.split("/").at(-1);
    expect(integratedNodeTest).toContain('import "'+importRelative+'";');
  }
  const sourceCi=read(".github/workflows/v4-sonic-ir21-f20-owner-finance-retention-ci.yml").toString();
  expect(sourceCi).toContain(p02NodeGate.testEntrypoint);
  expect(p02NodeGate.immutableSource).toEqual([{"path":"scripts/release/v4-p02-two-owner-readonly-acceptance.mjs","blob":"dc7d6b1d3b2eb84b3554c9c6b822b310049ea4a9","unchanged":true},{"path":"scripts/release/tests/v4-p02-two-owner-readonly-acceptance.test.mjs","blob":"2eff1ec1fbcb96a2bbeb30e6af2acc309a394bb8","unchanged":true},{"path":"scripts/release/tests/v4-p02-two-owner-authorization-proof.test.mjs","blob":"da39317cab102594f780a3e2a60f5de2a8c3199b","unchanged":true},{"path":".github/workflows/v4-sonic-ir21-f20-owner-finance-retention-ci.yml","blob":"634d35b6eb34025df560b78f0dfbe3354988238c","unchanged":true}]);
  for(const entry of p02NodeGate.immutableSource)
    expect(gitHash(read(entry.path)),entry.path).toBe(entry.blob);
  for(const x of ["NODE_CI_INCLUDES_INDEPENDENT_FOREIGN_BRANCH_ASSIGNMENT_NEGATIVES","ADVERSARIAL_SUITES_RUN_ON_EVERY_EXISTING_IR21_PUSH","NO_PRODUCTION_JWT_IN_CI","NO_CONNECTED_DB_AUTH_WRITE","NO_SQL_MIGRATION_OR_WORKFLOW_MUTATION","NO_NEW_PR_OR_DEPLOY","P02_OPEN_2_OF_7","P03_OPEN_0_OF_6"])
    expect(p02NodeGate.invariants).toContain(x);
  expect(p02NodeGate.acceptance)
    .toBe("SOURCE_ONLY_SYNTHETIC_NODE_TEST_GATE_NOT_REAL_OWNER_A_B_JWT_PROOF");
  expect(p02NodeGate.nextBatch)
    .toBe("P02_818_REAL_OWNER_APPROVAL_DBA_AND_SIGNED_IN_TWO_OWNER_TESTS");
  // A separate reviewed source successor prevents a QA-only version tag from
  // authorizing mutation of a request that is no longer synthetic.
  expect(gitHash(p02NodeGateRaw)).toBe("da37ae64117d48a91d4135744e3923d00eace25b");
  expect(qaNoProvider.schema).toBe("servicedesk.p02.qa-synthetic-no-provider-request-resume.v1");
  expect(qaNoProvider.batchId).toBe("P02-QA_SEED_NEVER_REUSE_OR_UPDATE_PROVIDER_CONNECTED_REQUEST-20261109");
  expect(qaNoProvider.ownerChat).toBe("PRODUCTION_SOURCE");
  expect(qaNoProvider.sourceOnly).toBe(true);
  expect(qaNoProvider.reviewedParentHead).toBe("7baf4d4e8603774bc9a290c178ffcb3afcc8915f");
  expect(qaNoProvider.predecessor).toEqual({path:"docs/delivery/sonic-p02-node-adversarial-gate-successor-20261109.json",blob:"da37ae64117d48a91d4135744e3923d00eace25b",unchanged:true});
  expect(qaNoProvider.predecessor.blob).toBe(gitHash(p02NodeGateRaw));
  expect(qaNoProvider.changedSource).toEqual([
   {path:"src/features/auth/qa-sample-seed.ts",previousBlob:"5ed2e466b5b5fa74e3baa91c03140d1958510ed2",currentBlob:"ac90347b1ce5e41697838953414fa7710eb614eb",lane:"SYNTHETIC_REQUEST_RESUME_NO_PROVIDER_UPDATE"},
   {path:"tests/e2e/p02-qa-seed-url-saved-proof.test.ts",previousBlob:"615106e53b8f476b04c3ec4abb36d5c7526a6d44",currentBlob:"477fb60817caecf1b4320988d6a0a9f94391204a",lane:"ADVERSARIAL_QA_RACE"}
  ]);
  expect(new Set(qaNoProvider.changedSource.map(item=>item.path)).size).toBe(2);
  for(const item of qaNoProvider.changedSource){
    expect(item.path).not.toContain("..");
    expect(gitHash(read(item.path)),item.path)
      .toBe(currentQaPropertyPreflightBlob(item.path,item.currentBlob));
  }
  expect(qaNoProvider.tests).toEqual({
    path:"tests/e2e/p02-qa-seed-url-saved-proof.test.ts",
    previous:18,current:21,added:3,scope:"MOCKED_SSR_QA_ONLY_NO_LIVE_JWT"
  });
  expect(qaNoProvider.unchangedSource).toEqual([
    {path:"src/features/auth/qa-sample-readback.ts",blob:"39432b3b076939ed0f304d56e3a7fa21112c8b70",unchanged:true},
    {path:"src/app/onboarding/verified/qa-seed-actions.ts",blob:"047dc7ed709946c41065027ac7cf18db4b284131",unchanged:true},
    {path:".github/workflows/v4-sonic-ir21-f20-owner-finance-retention-ci.yml",blob:"634d35b6eb34025df560b78f0dfbe3354988238c",unchanged:true}
  ]);
  for(const item of qaNoProvider.unchangedSource){
    expect(item.unchanged).toBe(true);
    expect(gitHash(read(item.path)),item.path)
      .toBe(currentQaContactlessBlob(item.path,item.blob));
  }
  for(const guard of ["QA_VERSION_ALONE_NEVER_AUTHORIZES_REQUEST_REUSE",
    "REQUEST_REUSE_REQUIRES_SYNTHETIC_TRUE_PROVIDER_CONNECTED_FALSE",
    "EXACT_SAVED_DEFAULT_BRANCH_REQUIRED_BEFORE_ANY_SERVICE_AMENDMENT",
    "UPDATE_HAS_ATOMIC_BRANCH_AND_SYNTHETIC_PROVIDER_PREDICATES",
    "POST_WRITE_INDEPENDENT_SYNTHETIC_ROW_PROOF",
    "NO_CONNECT_SUPABASE_AUTH_DB_WRITE","NO_CUSTOMER_CONTACT_OR_PROVIDER_SEND",
    "NO_DEPLOY_OR_SQL_MIGRATION","P02_OPEN_2_OF_7","P03_QUEUED_0_OF_6"])
    expect(qaNoProvider.guards).toContain(guard);
  expect(qaNoProvider.acceptance).toBe("SOURCE_ONLY_PENDING_AUTHORIZED_TWO_OWNER_JWT_BROWSER_RLS");
  // Additional property lineage prevents touching a request when its saved
  // fictional QA property was transferred to another branch. Prior SHA
  // history is byte-identical and reviewed before this successor.
  expect(gitHash(qaNoProviderRaw)).toBe("cb3a49287fc3df662189b9112c9c4e8472722453");
  expect(qaPropertyPreflight.schema).toBe("servicedesk.p02.qa-property-default-branch-preflight.v1");
  expect(qaPropertyPreflight.batchId).toBe("P02-QA_PROPERTY_BRANCH_MUST_MATCH_SAVED_DEFAULT_BEFORE_REQUEST_AMENDMENT-20261109");
  expect(qaPropertyPreflight.ownerChat).toBe("PRODUCTION_SOURCE");
  expect(qaPropertyPreflight.sourceOnly).toBe(true);
  expect(qaPropertyPreflight.reviewedParentHead).toBe("c1348db822fda09dc6dca316d46451ac19cfb711");
  expect(qaPropertyPreflight.predecessor).toEqual({path:"docs/delivery/sonic-p02-qa-no-provider-request-reuse-successor-20261109.json",blob:"cb3a49287fc3df662189b9112c9c4e8472722453",unchanged:true});
  expect(qaPropertyPreflight.predecessor.blob).toBe(gitHash(qaNoProviderRaw));
  expect(qaPropertyPreflight.changedSource).toEqual([
    {path:"src/features/auth/qa-sample-seed.ts",previousBlob:"ac90347b1ce5e41697838953414fa7710eb614eb",currentBlob:"4a9a8f4ab2c8af8b12f6c54df58c598944ffd17c",lane:"QA_SAVED_PROPERTY_SCOPE_BEFORE_AMENDMENT"},
    {path:"tests/e2e/p02-qa-seed-url-saved-proof.test.ts",previousBlob:"477fb60817caecf1b4320988d6a0a9f94391204a",currentBlob:"b9119f1f911def6021a1be14857ed21e3b36edfe",lane:"SYNTHETIC_PROPERTY_MUTATION_NEGATIVE"}
  ]);
  expect(new Set(qaPropertyPreflight.changedSource.map(item=>item.path)).size).toBe(2);
  for(const item of qaPropertyPreflight.changedSource){
    expect(item.path).not.toContain("..");
    expect(gitHash(read(item.path)),item.path)
      .toBe(currentQaContactlessBlob(item.path,item.currentBlob));
  }
  expect(qaPropertyPreflight.regressionTests).toEqual({
    path:"tests/e2e/p02-qa-seed-url-saved-proof.test.ts",
    previous:21,current:22,added:1,scope:"MOCKED_REAL_QA_SEED_HELPER_NO_PRODUCTION_DB"
  });
  expect(qaPropertyPreflight.unchangedSource).toEqual([
    {path:"src/features/auth/qa-sample-readback.ts",blob:"39432b3b076939ed0f304d56e3a7fa21112c8b70",unchanged:true},
    {path:"src/app/onboarding/verified/qa-seed-actions.ts",blob:"047dc7ed709946c41065027ac7cf18db4b284131",unchanged:true},
    {path:".github/workflows/v4-sonic-ir21-f20-owner-finance-retention-ci.yml",blob:"634d35b6eb34025df560b78f0dfbe3354988238c",unchanged:true}
  ]);
  for(const item of qaPropertyPreflight.unchangedSource){
    expect(item.unchanged).toBe(true);
    expect(gitHash(read(item.path)),item.path)
      .toBe(currentQaContactlessBlob(item.path,item.blob));
  }
  for(const guard of [
   "EXISTING_QA_PROPERTY_BRANCH_SAVED_ID_EQUALS_DEFAULT_BEFORE_REQUEST_UPDATE",
   "NO_SILENT_QA_PROPERTY_BRANCH_REASSIGNMENT",
   "FAIL_CLOSED_ON_DUPLICATE_OR_INCOMPLETE_PROPERTY_READ",
   "NO_SAVED_REQUEST_SERVICE_AMENDMENT_FOR_TRANSFERRED_PROPERTY",
   "PRESERVE_PREVIOUS_SYNTHETIC_NO_PROVIDER_UPDATE_FILTER",
   "NO_CONNECTED_SUPABASE_AUTH_OR_DB_WRITE","NO_PROVIDER_SEND_OR_DEPLOY_OR_MIGRATION",
   "P02_OPEN_2_OF_7","P03_OPEN_0_OF_6"])
    expect(qaPropertyPreflight.guards).toContain(guard);
  expect(qaPropertyPreflight.acceptance).toBe("SOURCE_ONLY_NOT_AUTHENTICATED_TWO_OWNER_BROWSER_JWT_RLS");
  // Source-only critical safety improvement: no QA-labelled customer with an
  // Auth identity, contact info, real-world address, or archived state may
  // receive newly associated fictional requests or a positive QA receipt.
  expect(gitHash(qaPropertyPreflightRaw)).toBe("3d55f7b6259f05d68ae4345bc2dbd7cdc6ffe471");
  expect(qaContactless.schema).toBe("servicedesk.p02.qa-contactless-fictional-customer-property.v1");
  expect(qaContactless.batchId).toBe("P02-QA_REPURPOSED_CONTACTABLE_CUSTOMER_OR_REAL_ADDRESS_NO_REUSE_20261109");
  expect(qaContactless.ownerChat).toBe("PRODUCTION_SOURCE");
  expect(qaContactless.sourceOnly).toBe(true);
  expect(qaContactless.reviewedParentHead).toBe("acec5c4a226da8bcdc3cda31ab2cdee10936804c");
  expect(qaContactless.predecessor).toEqual({path:"docs/delivery/sonic-p02-qa-saved-property-branch-before-request-successor-20261109.json",blob:"3d55f7b6259f05d68ae4345bc2dbd7cdc6ffe471",unchanged:true});
  expect(qaContactless.predecessor.blob).toBe(gitHash(qaPropertyPreflightRaw));
  expect(qaContactless.changedSource).toEqual([
    {path:"src/features/auth/qa-sample-seed.ts",previousBlob:"4a9a8f4ab2c8af8b12f6c54df58c598944ffd17c",currentBlob:"9bcc6b03c94c9655ac6dcebd145461d52e8de416",lane:"SAVED_CUSTOMER_AND_PROPERTY_UNCONTACTABLE_REUSE"},
    {path:"src/features/auth/qa-sample-readback.ts",previousBlob:"39432b3b076939ed0f304d56e3a7fa21112c8b70",currentBlob:"6f5ebf53d3dd58731db78852f1a393fe266177bc",lane:"INDEPENDENT_FICTIONAL_RECEIPT"},
    {path:"tests/e2e/p02-qa-seed-url-saved-proof.test.ts",previousBlob:"b9119f1f911def6021a1be14857ed21e3b36edfe",currentBlob:"cd6184c36e4a9643b7441ca370623c544eb2ece8",lane:"CONTACT_ARCHIVED_REAL_CUSTOMER_PROPERTY_ADVERSARIAL"}
  ]);
  expect(new Set(qaContactless.changedSource.map(x=>x.path)).size).toBe(3);
  for(const record of qaContactless.changedSource){
    expect(record.path).not.toContain("..");
    expect(gitHash(read(record.path)),record.path).toBe(currentQaLifecycleBlob(record.path,record.currentBlob));
  }
  expect(qaContactless.tests).toEqual({
    path:"tests/e2e/p02-qa-seed-url-saved-proof.test.ts",
    previous:22,current:25,added:3,scope:"SYNTHETIC_SSR_RLS_NO_LIVE_OWNER_JWT"
  });
  expect(qaContactless.unchangedProofs).toEqual([
    {path:"src/app/onboarding/verified/qa-seed-actions.ts",blob:"047dc7ed709946c41065027ac7cf18db4b284131",unchanged:true},
    {path:"supabase/migrations/0001_core.sql",blob:"e9385c0fc97c812de1d1e3eb4dfea94d2338fbe5",unchanged:true},
    {path:".github/workflows/v4-sonic-ir21-f20-owner-finance-retention-ci.yml",blob:"634d35b6eb34025df560b78f0dfbe3354988238c",unchanged:true}
  ]);
  for(const immutable of qaContactless.unchangedProofs){
    expect(immutable.unchanged).toBe(true);
    expect(gitHash(read(immutable.path)),immutable.path).toBe(immutable.blob);
  }
  for(const invariant of [
    "QA_REUSED_CUSTOMER_EXACT_FICTIONAL_NAME_NOTES_NO_AUTH_LINK_NOT_ARCHIVED",
    "QA_CUSTOMER_CONTACTS_MUST_BE_ZERO",
    "QA_REUSED_PROPERTY_EXACT_FICTIONAL_ADDRESS_NOT_ARCHIVED",
    "NO_REQUEST_MUTATION_FOR_REPURPOSED_CUSTOMER_OR_PROPERTY",
    "SAVED_SAMPLE_RECEIPT_RECHECKS_IDENTITY_AND_CONTACTS",
    "NO_SERVICE_ROLE_OR_CONNECTED_DB_AUTH_WRITE",
    "NO_PROVIDER_CUSTOMER_CONTACT_OR_PAYMENT",
    "NO_SQL_MIGRATION_OR_DEPLOY_OR_PROTECTED_MERGE",
    "P02_OPEN_2_OF_7","P03_OPEN_0_OF_6"
  ])expect(qaContactless.invariants).toContain(invariant);
  expect(qaContactless.acceptance).toBe("SOURCE_ONLY_PENDING_OWNER_APPROVED_JWT_BROWSER_RLS");
  expect(qaLifecycle.schema).toBe("servicedesk.p02.qa-request-lifecycle-service-assignment-guard.v1");
  expect(qaLifecycle.batchId).toBe("P02-QA_SERVICE_ASSIGNMENT_ONLY_WHILE_REQUEST_NEW-20261110");
  expect(qaLifecycle.ownerChat).toBe("PRODUCTION_SOURCE");
  expect(qaLifecycle.sourceOnly).toBe(true);
  expect(qaLifecycle.reviewedParentHead).toBe("3f7486c3ab0c00db128bb0b8d4807098e541cf3c");
  expect(qaLifecycle.predecessor).toEqual({
    path:"docs/delivery/sonic-p02-qa-fictional-contactless-customer-property-successor-20261109.json",
    blob:"f79cd1810d89fbce5427baf5db7cd6fbb64396fe",unchanged:true});
  expect(qaLifecycle.predecessor.blob).toBe(gitHash(qaContactlessRaw));
  expect(qaLifecycle.changedSource).toEqual([
    {path:"src/features/auth/qa-sample-seed.ts",previousBlob:"9bcc6b03c94c9655ac6dcebd145461d52e8de416",currentBlob:"32bd6b7587aee5acbb2923e6648617ccc107d9a6",lane:"P02_QA_LIFECYCLE_SAFE_MUTATION"},
    {path:"tests/e2e/p02-qa-seed-url-saved-proof.test.ts",previousBlob:"cd6184c36e4a9643b7441ca370623c544eb2ece8",currentBlob:"14d93de4fb5d0017c1e6563f3e592002c6ee0c1c",lane:"ADVERSARIAL_NEW_VS_PROGRESS_AND_TOCTOU"}
  ]);
  for(const next of qaLifecycle.changedSource)
    expect(gitHash(read(next.path)),next.path).toBe(next.currentBlob);
  expect(qaLifecycle.qa).toEqual({
    path:"tests/e2e/p02-qa-seed-url-saved-proof.test.ts",
    previous:25,current:29,added:4,
    scope:"OFFLINE_SSR_POSTGREST_SIMULATIONS_NOT_LIVE_OWNER"
  });
  expect(qaLifecycle.businessScenario).toContain("only to the untouched fictional NEW request");
  expect(qaLifecycle.unchangedSource).toEqual([
    {path:"src/features/auth/qa-sample-readback.ts",blob:"6f5ebf53d3dd58731db78852f1a393fe266177bc",unchanged:true},
    {path:"src/app/onboarding/verified/qa-seed-actions.ts",blob:"047dc7ed709946c41065027ac7cf18db4b284131",unchanged:true},
    {path:"supabase/migrations/0001_core.sql",blob:"e9385c0fc97c812de1d1e3eb4dfea94d2338fbe5",unchanged:true},
    {path:".github/workflows/v4-sonic-ir21-f20-owner-finance-retention-ci.yml",blob:"634d35b6eb34025df560b78f0dfbe3354988238c",unchanged:true}
  ]);
  for(const prior of qaLifecycle.unchangedSource)
    expect(gitHash(read(prior.path)),prior.path).toBe(prior.blob);
  const lifecycle=read("src/features/auth/qa-sample-seed.ts").toString();
  expect(lifecycle).toContain('priorRequest?.status !== "NEW"');
  expect(lifecycle).toContain('.eq("status", "NEW")');
  expect(lifecycle).toContain('amended.data?.status !== "NEW"');
  for(const rule of ["NO_RETROACTIVE_SERVICE_ASSIGNMENT_AFTER_NEW_REQUEST_LIFECYCLE","UPDATE_REQUIRES_ATOMIC_STATUS_NEW_FILTER","NEW_FICTIONAL_REQUEST_VALID_SERVICE_ASSIGNMENT_PRESERVED","PREEXISTING_ADVANCED_SYNTHETIC_REQUEST_REUSED_WITHOUT_WRITE","NO_PROVIDER_CONNECTED_OR_REAL_CUSTOMER_MUTATION","NO_UNSCOPED_BRANCH_OR_CUSTOMER_UPDATE","NO_CONNECTED_DB_AUTH_WRITE_OR_PROVIDER_SEND","NO_SQL_MIGRATION_OR_RELEASE_FLAG_OR_DEPLOY","P02_STAYS_OPEN_2_OF_7","P03_STAYS_OPEN_0_OF_6"])
    expect(qaLifecycle.invariants).toContain(rule);
  expect(qaLifecycle.acceptance).toBe("SOURCE_ONLY_OFFLINE_NEGATIVE_AND_POSITIVE_NOT_REAL_TWO_OWNER_JWT_RLS");
  expect(qaLifecycle.nextBatch).toBe("P02_818_OWNER_APPROVED_STAGING_JWT_RLS_AND_DBA_SQL");

  // Review an independent owner-landing RLS failure boundary. All older blob
  // manifests and permanent release gates remain byte-identical.
  expect(gitHash(qaContactlessRaw)).toBe("f79cd1810d89fbce5427baf5db7cd6fbb64396fe");
  expect(ownerLandingRls.schema).toBe("servicedesk.p02.owner-landing-rls-transport-fail-closed.v1");
  expect(ownerLandingRls.batchId).toBe("P02_VERIFIED_OWNER_PAGE_NO_HTTP_500_ON_THROWN_OWNER_LOOKUP_20261110");
  expect(ownerLandingRls.ownerChat).toBe("PRODUCTION_SOURCE");
  expect(ownerLandingRls.sourceOnly).toBe(true);
  expect(ownerLandingRls.reviewedParentHead).toBe("c00a9992a38bfd238075202d42cec302dc268c61");
  expect(ownerLandingRls.predecessor).toEqual({path:"docs/delivery/sonic-p02-qa-fictional-contactless-customer-property-successor-20261109.json",blob:"f79cd1810d89fbce5427baf5db7cd6fbb64396fe",unchanged:true});
  expect(ownerLandingRls.predecessor.blob).toBe(gitHash(qaContactlessRaw));
  expect(ownerLandingRls.changedSource).toEqual([
    {path:"src/app/onboarding/verified/page.tsx",previousBlob:"ea3c0b9e38d2f10439c9823ff6bdb7c05701231f",currentBlob:"f7c2fcee7d6f6d1c95c445ee40b7f78d9037081c",lane:"VERIFIED_OWNER_RLS_TRANSPORT_DENIAL"},
    {path:"tests/e2e/p02-workspace-error-origin.test.ts",previousBlob:"23aa52648145f76b0e5fd9adab3ef45f5b2b1249",currentBlob:"cafb82ecfc548c4b649d02a023a295b2a10bad34",lane:"ACTUAL_OWNER_LANDING_ADVERSARIAL_TEST"}
  ]);
  expect(new Set(ownerLandingRls.changedSource.map(x=>x.path)).size).toBe(2);
  for(const changed of ownerLandingRls.changedSource){
    expect(changed.path).not.toContain("..");
    // Preserve the historical landing snapshot, then permit only the
    // explicitly reviewed latest P02 onboarding / foreign-RLS successor.
    expect(gitHash(read(changed.path)),changed.path)
      .toBe(currentOnboardingVetoBlob(changed.path,changed.currentBlob));
  }
  expect(ownerLandingRls.tests).toEqual({
    path:"tests/e2e/p02-workspace-error-origin.test.ts",
    previous:37,current:39,added:2,scope:"MOCKED_SSR_OWNER_RLS_AND_ACTUAL_JSX"
  });
  expect(ownerLandingRls.unchangedSources).toEqual([
    {path:"src/features/auth/verified-owner-workspace.ts",blob:"221b0f52e75d2231900767f91806b3ea874f32d7",unchanged:true},
    {path:"src/app/onboarding/verified/qa-seed-actions.ts",blob:"047dc7ed709946c41065027ac7cf18db4b284131",unchanged:true},
    {path:".github/workflows/v4-sonic-ir21-f20-owner-finance-retention-ci.yml",blob:"634d35b6eb34025df560b78f0dfbe3354988238c",unchanged:true}
  ]);
  for(const immutable of ownerLandingRls.unchangedSources){
    expect(immutable.unchanged).toBe(true);
    expect(gitHash(read(immutable.path)),immutable.path).toBe(immutable.blob);
  }
  for(const veto of [
    "NO_OWNER_DETAILS_OR_QA_SEED_ON_THROWN_RLS_LOOKUP",
    "NO_HTTP_500_OR_INTERNAL_RLS_ERROR_LEAK",
    "NO_FALSE_SAVED_BRANCH_READY_ON_MISSING_OWNER",
    "NO_GUESSING_WORKSPACE_FROM_QUERY_PARAMS",
    "NO_AUTH_DB_USER_OR_PROVIDER_WRITES",
    "NO_RELEASE_FLAGS_OR_DEPLOYMENTS_OR_PROTECTED_MERGE",
    "P02_OPEN_2_OF_7","P03_OPEN_0_OF_6"])
    expect(ownerLandingRls.vetoes).toContain(veto);
  expect(ownerLandingRls.acceptance).toBe("SOURCE_ONLY_PENDING_REAL_TWO_OWNER_AUTHENTICATED_JWT_RLS");




  expect(branchAudit.businessScenario).toContain("exactly one saved owner branch assignment");
  expect(branchAudit.nodeCalls).toEqual({
    perTwoOwnersBefore:20,perTwoOwnersAfter:24,
    readOnlyGetsBefore:16,readOnlyGetsAfter:20,readOnlyRpcPosts:4});
  expect(branchAudit.qaSourceCases).toEqual({branchReadbackBefore:10,branchReadbackAfter:11});
  expect(branchAudit.unchangedSources).toEqual([
    {path:"supabase/migrations/0059_v3_verified_owner_workspace_bootstrap.sql",blob:"ee237941a371bf36ac39641fe8c1b65ae516ebe3",unchanged:true},
    {path:"supabase/migrations/0065_v4_default_branch_membership_authority.sql",blob:"a1d1097c1c31ae258ec4151b7d208bb3c415c21a",unchanged:true},
    {path:".github/workflows/v4-sonic-ir21-f20-owner-finance-retention-ci.yml",blob:"634d35b6eb34025df560b78f0dfbe3354988238c",unchanged:true}
  ]);
  for(const unchanged of branchAudit.unchangedSources){
    expect(unchanged.unchanged).toBe(true);
    expect(gitHash(read(unchanged.path)),unchanged.path).toBe(unchanged.blob);
  }
  for(const rule of ["NO_OWNER_READY_FOR_MALFORMED_BRANCH_CURRENCY","NO_OWNER_READY_FOR_BLANK_OR_OVERSIZED_BRANCH_TIMEZONE","VALID_RENAMED_OWNER_BRANCH_REMAINS_ALLOWED","OWNER_DEFAULT_BRANCH_ASSIGNMENT_REQUIRES_EXACT_ACTIVE_USER_AND_BRANCH","FOREIGN_BRANCH_MEMBERSHIP_RLS_PROBED_WITHOUT_USER_BRANCH_STATUS_FILTERS","FOREIGN_REVOKED_BRANCH_ASSIGNMENT_IS_LEAK","NO_CONNECTED_SUPABASE_AUTH_DB_WRITE","NO_SQL_MIGRATION_INSTALL","NO_EXTERNAL_PROVIDER_SEND_OR_PAYMENT","NO_VERCEL_DEPLOY_OR_PROTECTED_MERGE","P02_REMAINS_OPEN_2_OF_7","P03_REMAINS_OPEN_0_OF_6"])
    expect(branchAudit.invariants).toContain(rule);
  expect(branchAudit.acceptance).toBe("SOURCE_ONLY_READONLY_RUNNER_NOT_EXECUTED_WITH_REAL_OWNER_A_B_JWTS");
  expect(branchAudit.nextBatch).toBe("P02_818_OWNER_APPROVED_READONLY_TWO_OWNER_JWT_BRANCH_ASSIGNMENTS_AND_DBA_SQL");
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
   const branchSuccessor=ownerMainBranch.changedSource.find(x=>x.path===source.path);
   const reviewedPreBranch=expectedCurrentOwnerSlugBlob(source.path,fixtureFix?.currentBlob??qaWitness?.currentBlob??ownerNavigation?.currentBlob??ownerRlsVeto?.currentBlob??pageCorrection?.currentBlob??recoverySuccessor?.currentBlob??navSuccessor?.currentBlob??transport?.currentBlob??replacement?.currentBlob??source.blob);
   if(branchSuccessor)expect(branchSuccessor.previousBlob,source.path).toBe(reviewedPreBranch);
   expect(gitHash(read(source.path)),source.path)
      .toBe(currentExplicitOnboardingBlob(source.path,currentOwnerFormSafetyBlob(source.path,branchSuccessor?.currentBlob??reviewedPreBranch)));
  }
  // Separate independent source successor for actual post-confirm owner routing.
   expect(postConfirmNavigation.schema).toBe("servicedesk.p02.post-confirm-owner-navigation-transport-successor.v1");
   expect(postConfirmNavigation.batchId).toBe("P02-AUTH-CONTINUE-OWNER-SETUP-NETWORK-FAIL-CLOSED-20261107");
   expect(postConfirmNavigation.sourceOnly).toBe(true);
   expect(postConfirmNavigation.chat).toBe("PRODUCTION");
   expect(postConfirmNavigation.reviewedParentHead).toBe("e28e069879f463f91757ebb83b632dfc13f48ff0");
   expect(postConfirmNavigation.predecessor).toEqual({"path":"docs/delivery/sonic-p02-signup-user-receipt-successor-20261107.json","blob":"96a70397dbbf60f8ab3f8a6ab5617e754b2d0b83","unchanged":true});
   expect(postConfirmNavigation.predecessor.blob).toBe(gitHash(signupUserReceiptRaw));
   expect(postConfirmNavigation.historicCurrencyUx).toEqual({"path":"docs/delivery/sonic-p03-currency-first-run-ux-source-successor-20261107.json","blob":"d7648d1fd14e3e58f584cb0f03e5a386e4c3087d","unchanged":true});
   expect(postConfirmNavigation.historicCurrencyUx.blob).toBe(gitHash(p03CurrencyRaw));
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
     expect(gitHash(read(change.path)),change.path)
       .toBe(currentExplicitOnboardingBlob(change.path,expectedCurrentOwnerSlugBlob(change.path,fixtureFix?.currentBlob??qaWitness?.currentBlob??latestNav?.currentBlob??ownerVeto?.currentBlob??corrected?.currentBlob??recovery?.currentBlob??change.currentBlob)));
   }
   expect(postConfirmNavigation.tests).toEqual({"path":"tests/e2e/p02-workspace-error-origin.test.ts","newCases":13,"totalCases":19,"scope":"SYNTHETIC_POST_CONFIRMATION_ENTRYPOINT_NO_LIVE_JWT"});
   expect(postConfirmNavigation.unchangedAuthorizationHelper).toEqual({"path":"src/features/auth/authorized-workspace-access.ts","blob":"9fb078e8be2d75491d2ff630e99857cdec391ee2","unchanged":true});
   const correctedAuthorizer=activeOwnerRls.changedSource.find(item=>item.path===postConfirmNavigation.unchangedAuthorizationHelper.path);
   expect(correctedAuthorizer?.previousBlob).toBe(postConfirmNavigation.unchangedAuthorizationHelper.blob);
   expect(gitHash(read(postConfirmNavigation.unchangedAuthorizationHelper.path)))
     .toBe(expectedCurrentOwnerSlugBlob(postConfirmNavigation.unchangedAuthorizationHelper.path,correctedAuthorizer?.currentBlob));
   expect(postConfirmNavigation.unchangedIntegratedWorkflow).toEqual({"path":".github/workflows/v4-sonic-ir21-f20-owner-finance-retention-ci.yml","blob":"634d35b6eb34025df560b78f0dfbe3354988238c","unchanged":true});
   expect(gitHash(read(postConfirmNavigation.unchangedIntegratedWorkflow.path)))
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
   expect(gitHash(postConfirmNavigationRaw)).toBe("08a3748c1cbefd7c3f82b013d28e9646154edfee");
   expect(uncertainRegistration.schema).toBe("servicedesk.p02.uncertain-registration-saved-readback-ui-successor.v1");
   expect(uncertainRegistration.batchId).toBe("P02-UNKNOWN-RPC-COMMIT-OWNER-VISIBLE-READBACK-20261108");
   expect(uncertainRegistration.sourceOnly).toBe(true);
   expect(uncertainRegistration.reviewedParentHead).toBe("baf7742b6e89348cbf2f2d11e6f886a079222fd5");
   expect(uncertainRegistration.predecessor).toEqual({path:"docs/delivery/sonic-p02-post-confirm-navigation-transport-successor-20261107.json",blob:"08a3748c1cbefd7c3f82b013d28e9646154edfee",unchanged:true});
   expect(uncertainRegistration.predecessor.blob).toBe(gitHash(postConfirmNavigationRaw));
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
     expect(gitHash(read(source.path)),source.path)
       .toBe(currentExplicitOnboardingBlob(source.path,expectedCurrentOwnerSlugBlob(source.path,fixtureFix?.currentBlob??qaWitness?.currentBlob??latestNav?.currentBlob??ownerVeto?.currentBlob??corrected?.currentBlob??source.currentBlob)));
   }
   expect(uncertainRegistration.testCases).toEqual({path:"tests/e2e/p02-workspace-error-origin.test.ts",prior:19,current:21,newCases:2,scope:"SYNTHETIC_UI_RECOVERY_NO_CONNECTED_DB"});
   expect(uncertainRegistration.actionUnchanged.path).toBe("src/app/auth/create-workspace/actions.ts");
   expect(uncertainRegistration.actionUnchanged.blob).toBe("8e3a6e0572c38680141ce86b5d7f5f84cf5d6dfd");
   expect(gitHash(read(uncertainRegistration.actionUnchanged.path)))
      .toBe(currentOwnerFormSafetyBlob(uncertainRegistration.actionUnchanged.path,uncertainRegistration.actionUnchanged.blob));
   expect(uncertainRegistration.actionUnchanged.mayHaveCommittedMessages).toEqual(["Workspace registration may have committed, but its result could not be confirmed. Check your authorized workspaces before trying again.","Workspace registration may have committed, but saved owner access could not be verified. Use your authorized workspaces to check before trying again."]);
   expect(uncertainRegistration.workflowUnchanged.blob).toBe("634d35b6eb34025df560b78f0dfbe3354988238c");
   expect(gitHash(read(uncertainRegistration.workflowUnchanged.path))).toBe(uncertainRegistration.workflowUnchanged.blob);
   for(const guard of ["NO_SECOND_REGISTRATION_RPC","NO_CONNECTED_AUTH_OR_DB_WRITE","NO_DEPLOY","P02_REMAINS_2_OF_7"])
      expect(uncertainRegistration.requiredGuards).toContain(guard);
   expect(uncertainRegistration.acceptanceState).toBe("INTEGRATED_SOURCE_ONLY_NOT_REAL_TWO_OWNER_AUTHENTICATED_ACCEPTANCE");
   // Failed build's source is retained exactly; corrected page has a new
   // reviewed successor rather than a rewritten predecessor or weaker critic.
   expect(gitHash(uncertainRegistrationRaw)).toBe("f7ecb97302c8b0bba90ed9c0bf5350ad744077f5");
   expect(recoveryJsx.schema).toBe("servicedesk.p02.uncertain-registration-jsx-verified-successor.v1");
   expect(recoveryJsx.batchId).toBe("P02-UNKNOWN-RPC-RECOVERY-JSX-SYNTAX-CORRECTION-20261108");
   expect(recoveryJsx.sourceOnly).toBe(true);
   expect(recoveryJsx.parentHead).toBe("8ec0894a7b643f1da10a02b6a0cab6f4c67f9023");
   expect(recoveryJsx.predecessor).toEqual({path:"docs/delivery/sonic-p02-uncertain-registration-recovery-successor-20261108.json",blob:"f7ecb97302c8b0bba90ed9c0bf5350ad744077f5",unchanged:true});
   expect(recoveryJsx.predecessor.blob).toBe(gitHash(uncertainRegistrationRaw));
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
     expect(gitHash(read(check.path)),check.path).toBe(currentExplicitOnboardingBlob(check.path,expectedCurrentOwnerSlugBlob(check.path,fixtureFix?.currentBlob??qaWitness?.currentBlob??latestNav?.currentBlob??ownerVeto?.currentBlob??check.blob)));
   }
   expect(recoveryJsx.mustRetain).toContain("P02_OPEN_2_OF_7");
   expect(recoveryJsx.mustRetain).toContain("NO_CONNECTED_DB_WRITE");
   expect(recoveryJsx.mustRetain).toContain("NO_DEPLOY");
   expect(recoveryJsx.acceptance).toBe("PENDING_EXACT_HEAD_CI_SOURCE_ONLY");
   // Existing trusted page, test and authorization-handoff provenance stays pinned.
   // The new reviewed successor only closes incomplete RLS staff visibility.
   expect(gitHash(recoveryJsxRaw)).toBe("c86c71df734e38a8e894bf590e4386001c3ef832");
   expect(activeOwnerRls.schema).toBe("servicedesk.p02.active-owner-missing-workspace-rls-veto-successor.v1");
   expect(activeOwnerRls.batchId).toBe("P02-ACTIVE_OWNER_RLS_HIDDEN_WORKSPACE_MUST_NOT_REGISTER-20261108");
   expect(activeOwnerRls.sourceOnly).toBe(true);
   expect(activeOwnerRls.parentHead).toBe("ab7da89207fa9ae8c07b775a07a3b4bba018c18e");
   expect(activeOwnerRls.predecessor).toEqual({path:"docs/delivery/sonic-p02-uncertain-registration-jsx-correction-20261108.json",blob:"c86c71df734e38a8e894bf590e4386001c3ef832",unchanged:true});
   expect(activeOwnerRls.predecessor.blob).toBe(gitHash(recoveryJsxRaw));
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
     expect(gitHash(read(changed.path)),changed.path).toBe(currentExplicitOnboardingBlob(changed.path,expectedCurrentOwnerSlugBlob(changed.path,fixtureFix?.currentBlob??qaWitness?.currentBlob??latestNav?.currentBlob??changed.currentBlob)));
   }
   expect(activeOwnerRls.tests.route).toEqual({path:"tests/e2e/p02-workspace-error-origin.test.ts",previousCases:21,currentCases:23,added:2});
   expect(activeOwnerRls.tests.unit).toEqual({path:"tests/e2e/v3-authorized-workspace-access.test.ts",previousCases:8,currentCases:9,changedExpectation:"ACTIVE_HIDDEN_OWNER_DENIED"});
   for(const oldSource of [activeOwnerRls.unchangedAuthRoute,activeOwnerRls.unchangedWorkflow])
     expect(gitHash(read(oldSource.path)),oldSource.path).toBe(oldSource.blob);
   for(const guard of ["ACTIVE_OWNER_MISSING_WORKSPACE_DENY_NOT_NEW_OWNER","PARTIAL_STAFF_RLS_READBACK_DENY","NO_CONNECTED_JWT_OR_DB_OPERATION","NO_DEPLOY","P02_OPEN_2_OF_7"])
     expect(activeOwnerRls.requiredGuards).toContain(guard);
   expect(activeOwnerRls.acceptance).toBe("SOURCE_ONLY_PENDING_TWO_REAL_OWNER_JWT_RLS");
   // Separate independent successor: prior manifest byte-identical.
   expect(gitHash(activeOwnerRlsRaw)).toBe("aa420877a08eb9a31cc47a28ba940d31d0868f92");
   expect(ownerNavigationGuard.schema).toBe("servicedesk.p02.owner-auth-navigation-transient-and-no-resubmit.v1");
   expect(ownerNavigationGuard.batchId).toBe("P02-OWNER_NAVIGATION_FAIL_CLOSED_AND_NO_DUPLICATE_REGISTRATION-20261108");
   expect(ownerNavigationGuard.sourceOnly).toBe(true);
   expect(ownerNavigationGuard.chat).toBe("PRODUCTION_SOURCE");
   expect(ownerNavigationGuard.reviewedParentHead).toBe("235c38ba022d83dfb99e96e3f5325517cf0a4e10");
   expect(ownerNavigationGuard.predecessor).toEqual({path:"docs/delivery/sonic-p02-active-owner-hidden-workspace-veto-20261108.json",blob:"aa420877a08eb9a31cc47a28ba940d31d0868f92",unchanged:true});
   expect(ownerNavigationGuard.predecessor.blob).toBe(gitHash(activeOwnerRlsRaw));
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
     expect(gitHash(read(changed.path)),changed.path).toBe(currentExplicitOnboardingBlob(changed.path,expectedCurrentOwnerSlugBlob(changed.path,fixtureFix?.currentBlob??qaWitness?.currentBlob??changed.currentBlob)));
   }
   expect(ownerNavigationGuard.regressionTests).toEqual({
     path:"tests/e2e/p02-workspace-error-origin.test.ts",previous:23,current:29,added:6,
     scope:"SYNTHETIC_SERVER_COMPONENTS_NO_SIGNED_IN_JWT"
   });
   for(const unchanged of [ownerNavigationGuard.unchangedServerAction,ownerNavigationGuard.unchangedAuthorizer,ownerNavigationGuard.unchangedWorkflow]) {
     expect(gitHash(read(unchanged.path)),unchanged.path).toBe(expectedCurrentOwnerSlugBlob(unchanged.path,unchanged.blob));
   }
   for(const guard of ["NO_DUPLICATE_REGISTRATION_FORM_ON_AMBIGUOUS_RPC","NO_RAW_AUTH_PROVIDER_500_IN_CHOOSER","NO_RAW_AUTH_PROVIDER_500_ON_VERIFIED_OWNER","NO_CONNECTED_AUTH_DB_WRITE","NO_DEPLOY","P02_REMAINS_2_OF_7"])expect(ownerNavigationGuard.requiredGuards).toContain(guard);
   expect(ownerNavigationGuard.acceptance).toBe("INTEGRATED_SOURCE_ONLY_NOT_AUTHENTICATED_TWO_OWNER_JWT_RLS_ACCEPTANCE");
   // QA repair is a separate source successor; old exact SHA remains pinned.
   expect(gitHash(ownerNavigationGuardRaw)).toBe("1e6b75052dfd1b5803ceb22da610df6d62a160ea");
   expect(ownerQaWitness.schema).toBe("servicedesk.p02.owner-navigation-qa-witness-correction.v1");
   expect(ownerQaWitness.batchId).toBe("P02-EXACT_JSX_TREE_REGISTRATION_DENIAL_WITNESS_20261108");
   expect(ownerQaWitness.sourceOnly).toBe(true);
   expect(ownerQaWitness.parentHead).toBe("c6433a0e78b83d81413e53e450e27b554563413b");
   expect(ownerQaWitness.predecessor).toEqual({path:"docs/delivery/sonic-p02-owner-navigation-transient-denial-successor-20261108.json",blob:"1e6b75052dfd1b5803ceb22da610df6d62a160ea",unchanged:true});
   expect(ownerQaWitness.predecessor.blob).toBe(gitHash(ownerNavigationGuardRaw));
   expect(ownerQaWitness.changedSource).toEqual([
     {path:"tests/e2e/p02-workspace-error-origin.test.ts",previousBlob:"f1686a3511072e56147b4dc42ee820bab88ffc00",currentBlob:"2469e781c54f285d94b63d22ddd4471da0b4e974",
       reason:"RECURSIVE_JXS_TREE_TRAVERSAL_CORRECTS_SHALLOW_TEST_FALSE_FAILURE"}
   ]);
   expect(ownerQaWitness.testCount).toBe(29);
   for(const source of ownerQaWitness.changedSource){
     const fixtureFix=qaFixtureScope.changedSource.find(item=>item.path===source.path);
     if(fixtureFix)expect(fixtureFix.previousBlob,source.path).toBe(source.currentBlob);
     expect(gitHash(read(source.path)),source.path).toBe(currentExplicitOnboardingBlob(source.path,expectedCurrentOwnerSlugBlob(source.path,fixtureFix?.currentBlob??source.currentBlob)));
   }
   expect(ownerQaWitness.productionSourceUnchanged).toEqual([
     {path:"src/app/auth/create-workspace/page.tsx",blob:"2ed68d7a1ae4449e43dfb852fd8e210640664e56",unchanged:true},
     {path:"src/app/auth/select-workspace/page.tsx",blob:"d49858992d78fcb0a84bbd84d24bb1ebf681896e",unchanged:true},
     {path:"src/app/onboarding/verified/page.tsx",blob:"12eafdfa355d0c2fe59c3fa72a6533993627f60c",unchanged:true}
   ]);
   for(const source of ownerQaWitness.productionSourceUnchanged)
     expect(gitHash(read(source.path)),source.path).toBe(currentLandingBlob(source.path,source.blob));
   expect(ownerQaWitness.guard).toContain("NO_AUTH_OR_DB_WRITE");
   expect(ownerQaWitness.guard).toContain("NO_DEPLOY");
   expect(ownerQaWitness.state).toBe("PENDING_EXACT_HEAD_SOURCE_CI");
   // Separate source successor only corrects test fixture scope; production source is identical.
   expect(gitHash(ownerQaWitnessRaw)).toBe("1d26bb853f703f62b456cd9fca506e2aca58ea51");
   expect(qaFixtureScope.schema).toBe("servicedesk.p02.owner-navigation-preview-fixture-scope-successor.v1");
   expect(qaFixtureScope.batchId).toBe("P02-OWNER_PREVIEW_FIXTURE_SCOPE_OF_FORM_RENDER_20261108");
   expect(qaFixtureScope.sourceOnly).toBe(true);
   expect(qaFixtureScope.parentHead).toBe("bada02c370cf2c2879515f2072342d38be4f29fb");
   expect(qaFixtureScope.predecessor).toEqual({path:"docs/delivery/sonic-p02-owner-navigation-qa-witness-correction-20261108.json",blob:"1d26bb853f703f62b456cd9fca506e2aca58ea51",unchanged:true});
   expect(qaFixtureScope.predecessor.blob).toBe(gitHash(ownerQaWitnessRaw));
   expect(qaFixtureScope.changedSource).toEqual([
     {path:"tests/e2e/p02-workspace-error-origin.test.ts",previousBlob:"2469e781c54f285d94b63d22ddd4471da0b4e974",currentBlob:"6aaad27365257fed0fa33d2b6c1a008f87ed3542",
      reason:"MOVE_RENDER_TEST_UNDER_VERIFIED_OWNER_QA_ENV_FIXTURE"}
   ]);
   expect(qaFixtureScope.testCount).toBe(29);
   for(const source of qaFixtureScope.changedSource)
     expect(gitHash(read(source.path)),source.path).toBe(currentExplicitOnboardingBlob(source.path,expectedCurrentOwnerSlugBlob(source.path,source.currentBlob)));
   expect(qaFixtureScope.productionSourceUnchanged).toEqual([
     {path:"src/app/auth/create-workspace/page.tsx",blob:"2ed68d7a1ae4449e43dfb852fd8e210640664e56",unchanged:true},
     {path:"src/app/auth/select-workspace/page.tsx",blob:"d49858992d78fcb0a84bbd84d24bb1ebf681896e",unchanged:true},
     {path:"src/app/onboarding/verified/page.tsx",blob:"12eafdfa355d0c2fe59c3fa72a6533993627f60c",unchanged:true}
   ]);
   for(const source of qaFixtureScope.productionSourceUnchanged)
     expect(gitHash(read(source.path)),source.path).toBe(currentLandingBlob(source.path,source.blob));
   for(const guard of ["P02_OPEN_2_OF_7","NO_CONNECTED_AUTH_OR_DB_WRITE","NO_DEPLOY","PRESERVE_ALL_SOURCE_LOCKS"])
     expect(qaFixtureScope.guards).toContain(guard);
   expect(qaFixtureScope.acceptance).toBe("SOURCE_ONLY_UNTIL_AUTHENTICATED_OWNER_A_B_RLS");
   // New adverse owner-navigation correction: no historical manifests rewritten.
   expect(gitHash(qaFixtureScopeRaw)).toBe("8e9662c5d2594eadee84b0eec79140133c0c3d5e");
   expect(malformedOwnerSlug.schema).toBe("servicedesk.p02.active-owner-malformed-address-deny-successor.v1");
   expect(malformedOwnerSlug.batchId).toBe("P02-ACTIVE_OWNER_INVALID_SLUG_MUST_NOT_RESTART_ONBOARDING-20261108");
   expect(malformedOwnerSlug.sourceOnly).toBe(true);
   expect(malformedOwnerSlug.chat).toBe("PRODUCTION_SOURCE");
   expect(malformedOwnerSlug.parentHead).toBe("4e2d7278f1d8c3ee16205d272d664286f2f0b75f");
   expect(malformedOwnerSlug.predecessor).toEqual({path:"docs/delivery/sonic-p02-owner-navigation-fixture-scope-correction-20261108.json",blob:"8e9662c5d2594eadee84b0eec79140133c0c3d5e",unchanged:true});
   expect(malformedOwnerSlug.predecessor.blob).toBe(gitHash(qaFixtureScopeRaw));
   expect(malformedOwnerSlug.changedSource).toEqual([
     {path:"src/features/auth/authorized-workspace-access.ts",previousBlob:"432490ce986695d418b7f2cf0f7bcdac27806102",currentBlob:"408f7cc2bfc5c6c94565ec4f0658840bc1a2f008",lane:"RLS_NAVIGATION_AUTHORIZATION"},
     {path:"tests/e2e/p02-workspace-error-origin.test.ts",previousBlob:"6aaad27365257fed0fa33d2b6c1a008f87ed3542",currentBlob:"abd144788272813d937fb2d0082b6d559b6a3dd1",lane:"OWNER_ROUTE_ADVERSARIAL_QA"}
   ]);
   for(const source of malformedOwnerSlug.changedSource){
     expect(source.path).not.toContain("..");
     expect(gitHash(read(source.path)),source.path).toBe(currentExplicitOnboardingBlob(source.path,currentLandingBlob(source.path,source.currentBlob)));
   }
   expect(malformedOwnerSlug.tests).toEqual({path:"tests/e2e/p02-workspace-error-origin.test.ts",previous:29,current:31,added:2,scope:"MOCKED_RLS_CONTINUATION_NO_LIVE_JWT"});
   expect(malformedOwnerSlug.unchangedWorkflow.blob).toBe("634d35b6eb34025df560b78f0dfbe3354988238c");
   expect(gitHash(read(malformedOwnerSlug.unchangedWorkflow.path))).toBe(malformedOwnerSlug.unchangedWorkflow.blob);
   for(const guard of ["MALFORMED_ACTIVE_OWNER_SLUG_RETURNS_WORKSPACE_LOOKUP","OWNER_WITH_CREW_DROPS_NO_MEMBERSHIP","NO_PROD_SQL_OR_AUTH_JWT","NO_VERCEL_DEPLOY","P02_REMAINS_2_OF_7"])
     expect(malformedOwnerSlug.invariants).toContain(guard);
   expect(malformedOwnerSlug.acceptance).toBe("SOURCE_TESTED_NOT_TWO_REAL_OWNER_AUTHENTICATED_ACCEPTANCE");







  const pricingGuard=p03Currency.safetySourceUnchanged;
  expect(gitHash(read(pricingGuard.path))).toBe(pricingGuard.blob);
  expect(read(pricingGuard.path).toString()).toContain(pricingGuard.guard);
  expect(read("src/app/auth/create-workspace/page.tsx").toString())
   .toContain("First-run cleaning pricing currently supports USD branches only.");
  expect(p03Currency.explicitNonActions).toContain("NO_CONNECTED_DB_WRITE");
  expect(p03Currency.releaseState).toContain("P03_OPEN_0_OF_6");
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
   const successor=reset.overrides.find(x=>x.path===source.path);
   if(successor)expect(successor.previousBlob,source.path).toBe(source.blob);
   if(source.path===resetRetry.reviewedPage.path)
     expect(resetRetry.reviewedPage.oldBlob).toBe(successor?.currentBlob);
   expect(gitHash(read(source.path)),source.path)
     .toBe(currentCheckEmailBlob(source.path,currentRecoveryQaSource(source.path,
       source.path===resetRetry.reviewedPage.path
         ?resetRetry.reviewedPage.newBlob:successor?.currentBlob??source.blob)));
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
  expect(gitHash(quoteCrewRaw)).toBe("e77c6661c19eca10e7e5e57f34b28c2c2362ed91");
  expect(quoteCrew.schema).toBe("servicedesk.f23.quote-crew-lock-races-successor.v1");
  expect(quoteCrew.priorVerifiedSource.path).toBe("docs/delivery/sonic-p02-qa-seed-saved-proof-successor-20261107.json");
  expect(quoteCrew.priorVerifiedSource.blob).toBe(gitHash(qaProofRaw));
  expect(quoteCrew.priorVerifiedSource.unchanged).toBe(true);
  expect(quoteCrew.workflowSuccessor.path).toBe(qaProof.workflowSuccessor.path);
  expect(quoteCrew.workflowSuccessor.previousBlob).toBe(qaProof.workflowSuccessor.currentBlob);
  expect(quoteCrew.workflowSuccessor.currentBlob).toBe("8c2cab1749d363309d5c89cce9a6980084019202");
  expect(gitHash(resetRaw)).toBe("a50e9f4b61f0b0481aae9bf7e377faa839b7b944");
  expect(reset.schema).toBe("servicedesk.p02.password-reset-session-closure-successor.v1");
  expect(reset.priorVerifiedSource.path).toBe("docs/delivery/sonic-f23-quote-crew-lock-races-successor-20261107.json");
  expect(reset.priorVerifiedSource.unchanged).toBe(true);
  expect(reset.priorVerifiedSource.blob).toBe(gitHash(quoteCrewRaw));
  expect(reset.historicAuthFeedback.blob).toBe(gitHash(authFeedbackRaw));
  expect(reset.historicAuthFeedback.unchanged).toBe(true);
  expect(reset.workflowSuccessor.path).toBe(quoteCrew.workflowSuccessor.path);
  expect(reset.workflowSuccessor.previousBlob).toBe(quoteCrew.workflowSuccessor.currentBlob);
  expect(gitHash(negativeRlsRaw)).toBe("efdebce4aab449dbf804805ea202653f19279dd7");
  expect(negativeRls.schema).toBe("servicedesk.p02.foreign-rls-negative-probe-and-f23-veto.v1");
  expect(negativeRls.priorReviewed.path).toBe("docs/delivery/sonic-p02-reset-session-closure-successor-20261107.json");
  expect(negativeRls.priorReviewed.unchanged).toBe(true);
  expect(negativeRls.priorReviewed.blob).toBe(gitHash(resetRaw));
  expect(negativeRls.workflowSuccessor.path).toBe(reset.workflowSuccessor.path);
  expect(negativeRls.workflowSuccessor.previousReviewedBlob).toBe(reset.workflowSuccessor.currentBlob);
  expect(negativeRls.workflowSuccessor.f23WitnessInterimBlob).toBe("122a1afcc1f05624e62408551b5054944967e6eb");
  expect(negativeRls.changedSource).toHaveLength(2);
  for(const source of negativeRls.changedSource){
   expect(source.path).not.toContain("..");
   expect(gitHash(read(source.path)),source.path)
     .toBe(reviewedP02NodeGateBlob(source.path,
       currentBranchAuditBlob(source.path,source.currentBlob)));
  }
  expect(negativeRls.changedSource[0].previousBlob).toBe("e5998a74c176172653fa9782ace23eaadfcbc7a8");
  expect(negativeRls.changedSource[1].previousBlob).toBeNull();
  const negativeScript=read(negativeRls.changedSource[0].path).toString();
  expect(negativeScript).toContain("table === \"memberships\" && ownScope");
  expect(negativeScript).toContain("table === \"workspace_branches\" && ownScope");
  expect(negativeRls.guards).toContain("FOREIGN_ANY_ROW_IS_RLS_VETO");
  expect(gitHash(prototypeBridgeRaw)).toBe("47b9619a854b29f9f3d3bf560d11d734b7effb8c");
  expect(gitHash(f23VetoRaw)).toBe("f8f8431210cbcaea474dd729b127629176a9c568");
  expect(gitHash(writerAuditRaw)).toBe("3844882993a074b6c722e2c2391cc9da1e196c9f");
  expect(writerAudit.schema).toBe("servicedesk.f23.quote-writer-compatibility-and-readonly-dba-preflight.v1");
  expect(writerAudit.classification).toBe("SOURCE_AUDIT_AND_DISPOSABLE_PG17_ONLY_NOT_PRODUCTION_READY");
  expect(writerAudit.priorVerifiedVeto.path).toBe("docs/delivery/sonic-f23-sibling-quote-phantom-veto-successor-20261107.json");
  expect(writerAudit.priorVerifiedVeto.blob).toBe(gitHash(f23VetoRaw));
  expect(writerAudit.priorVerifiedVeto.unchanged).toBe(true);
  expect(writerAudit.workflowSuccessor.path).toBe(f23Veto.workflowSuccessor.path);
  expect(writerAudit.workflowSuccessor.previousBlob).toBe(f23Veto.workflowSuccessor.currentBlob);
  expect(writerAudit.workflowSuccessor.currentBlob).toBe("634d35b6eb34025df560b78f0dfbe3354988238c");
  expect(gitHash(literalCriticRaw)).toBe("960f9b9a03f104f7a68f60e316c734d7a128a95e");
  expect(literalCritic.schema).toBe("servicedesk.f23.readonly-sql-literal-critic-successor.v1");
  expect(literalCritic.priorReviewed.path).toBe("docs/delivery/sonic-f23-quote-writer-compatibility-source-successor-20261107.json");
  expect(literalCritic.priorReviewed.unchanged).toBe(true);
  expect(literalCritic.priorReviewed.blob).toBe(gitHash(writerAuditRaw));
  expect(literalCritic.reviewedReplacement.path).toBe("tests/ai/f23-current-quote-schema-compatibility-veto.test.ts");
  expect(literalCritic.reviewedReplacement.previousBlob).toBe("7b51bef9c828705a75bf8cc0a915a983550b638f");
  expect(literalCritic.reviewedReplacement.currentBlob).toBe("11b477ec83b4fca7038e649c6272089121ebb85d");
  expect(gitHash(read(literalCritic.reviewedReplacement.path))).toBe(literalCritic.reviewedReplacement.currentBlob);
  expect(literalCritic.securityPreflight.path).toBe(writerAudit.changedSource[0].path);
  expect(literalCritic.securityPreflight.unchanged).toBe(true);
  expect(literalCritic.securityPreflight.blob).toBe(writerAudit.changedSource[0].blob);
  expect(gitHash(read(literalCritic.securityPreflight.path))).toBe(literalCritic.securityPreflight.blob);
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
   expect(gitHash(read(f.path)),f.path).toBe(current);
  }
  expect(writerAudit.sourcePreimagesUnchanged).toHaveLength(4);
  for(const f of writerAudit.sourcePreimagesUnchanged){
   expect(f.path).not.toContain("..");
   expect(gitHash(read(f.path)),f.path).toBe(f.blob);
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
  expect(f23Veto.predecessor.blob).toBe(gitHash(negativeRlsRaw));
  expect(f23Veto.predecessor.unchanged).toBe(true);
  expect(f23Veto.workflowSuccessor.path).toBe(negativeRls.workflowSuccessor.path);
  expect(f23Veto.workflowSuccessor.previousBlob).toBe(negativeRls.workflowSuccessor.currentBlob);
  expect(f23Veto.workflowSuccessor.currentBlob).toBe(prototypeBridge.workflowSuccessor.currentBlob);
  expect(f23Veto.reviewedCandidate.installed).toBe(false);
  expect(f23Veto.reviewedCandidate.unsafeSiblingPhantom).toBe(true);
  expect(gitHash(read(f23Veto.reviewedCandidate.path))).toBe(f23Veto.reviewedCandidate.blob);
  expect(f23Veto.sources).toHaveLength(3);
  expect(new Set(f23Veto.sources.map(f=>f.path)).size).toBe(3);
  const newF23Workflow=read(f23Veto.workflowSuccessor.path).toString();
  for(const source of f23Veto.sources){
   expect(source.path).not.toContain("..");
   expect(gitHash(read(source.path)),source.path).toBe(source.blob);
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
  expect(prototypeBridge.predecessor.blob).toBe(gitHash(negativeRlsRaw));
  expect(prototypeBridge.workflowSuccessor.previousBlob).toBe(negativeRls.workflowSuccessor.currentBlob);
  expect(prototypeBridge.workflowSuccessor.path).toBe(negativeRls.workflowSuccessor.path);
  expect(prototypeBridge.externalF23ReviewOnly.disposablePg17Only).toBe(true);
  expect(prototypeBridge.externalF23ReviewOnly.productionInstallApproved).toBe(false);
  expect(prototypeBridge.integrationRules).toContain("F23_KNOWN_UNSAFE_SIBLING_QUOTE_VETO_RETAINED");
  expect(gitHash(read(prototypeBridge.externalF23ReviewOnly.path)))
    .toBe(prototypeBridge.externalF23ReviewOnly.blob);
  expect(prototypeBridge.existingF23VetoUnchanged.path).toBe(negativeRls.simultaneousF23Veto.path);
  expect(prototypeBridge.existingF23VetoUnchanged.blob).toBe(negativeRls.simultaneousF23Veto.blob);
  expect(gitHash(read(prototypeBridge.existingF23VetoUnchanged.path)))
    .toBe(prototypeBridge.existingF23VetoUnchanged.blob);
  expect(prototypeBridge.existingF23VetoUnchanged.marker)
    .toBe(negativeRls.simultaneousF23Veto.witnessMarker);
  expect(read(prototypeBridge.workflowSuccessor.path).toString())
    .toContain("bash "+prototypeBridge.externalF23ReviewOnly.path);

  expect(negativeRls.simultaneousF23Veto.testScope).toBe("PG17_DISPOSABLE_ONLY");
  expect(negativeRls.simultaneousF23Veto.isAcceptance).toBe(false);
  expect(negativeRls.simultaneousF23Veto.releasePermission).toBe(false);
  expect(gitHash(read(negativeRls.simultaneousF23Veto.path)))
    .toBe(negativeRls.simultaneousF23Veto.blob);
  const witnessText=read(negativeRls.simultaneousF23Veto.path).toString();
  expect(witnessText).toContain(negativeRls.simultaneousF23Veto.witnessMarker);
  const combinedWorkflow=read(negativeRls.workflowSuccessor.path).toString();
  expect(combinedWorkflow).toContain("node --test scripts/release/v4-p02-two-owner-readonly-acceptance.test.mjs");
  expect(combinedWorkflow).toContain("bash "+negativeRls.simultaneousF23Veto.path);

  expect(gitHash(resetRetryRaw)).toBe("96b3557377f5fc364fee6682045224116f9c2acd");
  expect(resetRetry.schema).toBe("servicedesk.p02.reset-signout-uncertain-form-suppression.v1");
  expect(resetRetry.previousReviewed.path).toBe("docs/delivery/sonic-p02-reset-session-closure-successor-20261107.json");
  expect(resetRetry.previousReviewed.blob).toBe(gitHash(resetRaw));
  expect(resetRetry.previousReviewed.unchanged).toBe(true);
  expect(resetRetry.reviewedPage.path).toBe("src/app/auth/reset-password/page.tsx");
  expect(resetRetry.reviewedPage.oldBlob).toBe(reset.overrides.find(x=>x.path===resetRetry.reviewedPage.path)?.currentBlob);
  expect(gitHash(read(resetRetry.reviewedPage.path))).toBe(currentRecoveryQaSource(resetRetry.reviewedPage.path,resetRetry.reviewedPage.newBlob));
  expect(gitHash(read(resetRetry.reviewedTest.path))).toBe(resetRetry.reviewedTest.newBlob);
  expect(resetRetry.focusedWorkflow.oldBlob).toBe("0e1ba6155a55182e25c3831b2f46093037d71dc3");
  expect(gitHash(signInAuditRaw)).toBe("355217845c497dd3199ebc0cd3bdac58779ff53f");
  expect(signInAudit.schema).toBe("servicedesk.p02.sign-in-verified-returned-session.v1");
  expect(signInAudit.predecessor.path).toBe("docs/delivery/sonic-p02-reset-retry-form-suppression-20261107.json");
  expect(signInAudit.predecessor.unchanged).toBe(true);
  expect(signInAudit.predecessor.blob).toBe(gitHash(resetRetryRaw));
  expect(signInAudit.sourceChange.path).toBe("src/app/auth/sign-in/actions.ts");
  expect(signInAudit.sourceChange.previousBlob).toBe("17bccf3e88b0935f5fa184fc7e9ffa2225423498");
  expect(gitHash(read(signInAudit.sourceChange.path))).toBe(signInAudit.sourceChange.currentBlob);
  expect(signInAudit.newAdversarialTest.cases).toBe(7);
  expect(gitHash(read(signInAudit.newAdversarialTest.path))).toBe(signInAudit.newAdversarialTest.blob);
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
   expect(signupConfirmTransport.predecessor.blob).toBe(gitHash(signInAuditRaw));
   expect(signupConfirmTransport.changedSource).toEqual([
     {path:"src/app/auth/sign-up/actions.ts",previousBlob:"87e77031039506fd4ee7c5d9c8f2387b9821e821",currentBlob:"3e925d4ec220f7264e5c6407c42e2670be5cebef"},
     {path:"src/app/auth/confirm/route.ts",previousBlob:"6b9abb0efb56d597ee258d87faae93693b89d100",currentBlob:"4ab0f387ded6284c9af9b403c178e5869dbe8a33"},
   ]);
   for(const source of signupConfirmTransport.changedSource){
     expect(source.path).not.toContain("..");
     const successor=signupUserReceipt.changedSource.find(entry=>entry.path===source.path);
      expect(gitHash(read(source.path)),source.path).toBe(successor?.currentBlob??source.currentBlob);
   }
   expect(signupConfirmTransport.addedAdversarialTest).toEqual({
     path:"tests/e2e/p02-signup-confirm-transport-outcome.test.ts",previousBlob:null,
     currentBlob:"f6659f118c343173b12767c102afc312053a32ff",cases:11,
   });
   expect(gitHash(read(signupConfirmTransport.addedAdversarialTest.path)))
     .toBe(currentCheckEmailBlob(signupConfirmTransport.addedAdversarialTest.path,
       signupUserReceipt.changedSource.find(entry=>entry.path===signupConfirmTransport.addedAdversarialTest.path)?.currentBlob));
   expect(signupConfirmTransport.focusedWorkflow).toEqual({
     path:signInAudit.focusedWorkflow.path,
     previousBlob:"720495c3087c369249fe19495cb86c2461a0abca",
     currentBlob:"42e200cdfe166ebb0e2f5eb187b182ab81c24490",
   });
   expect(signupConfirmTransport.focusedWorkflow.previousBlob)
     .toBe(signInAudit.focusedWorkflow.currentBlob);
   expect(gitHash(read(signupConfirmTransport.focusedWorkflow.path)))
     .toBe(signupConfirmTransport.focusedWorkflow.currentBlob);
   expect(read(signupConfirmTransport.focusedWorkflow.path).toString())
     .toContain("tests/e2e/p02-signup-confirm-transport-outcome.test.ts");
   expect(signupConfirmTransport.requiredGuards).toContain("NO_CHECK_EMAIL_ON_THROWN_SIGNUP");
   expect(signupConfirmTransport.requiredGuards).toContain("NO_SUCCESSFUL_CONFIRM_WITHOUT_VERIFIED_USER_SESSION");
   expect(signupConfirmTransport.requiredGuards).toContain("NO_VERCEL_DEPLOY");
   expect(signupConfirmTransport.acceptanceState).toBe("SOURCE_ONLY_NOT_AUTHENTICATED_TWO_OWNER_ACCEPTANCE");
    // Follow-on source lock: neither original historical blob nor its manifest is altered.
    expect(gitHash(signupConfirmTransportRaw)).toBe("a25c45beaee878113757e59310ba480fc9e81c59");
    expect(signupUserReceipt.schema).toBe("servicedesk.p02.signup-provider-user-receipt-successor.v1");
    expect(signupUserReceipt.batchId).toBe("P02-SIGNUP-PARTIAL-PROVIDER-RECEIPT-DENIAL-20261107");
    expect(signupUserReceipt.sourceOnly).toBe(true);
    expect(signupUserReceipt.parentHead).toBe("13f72c92b19e524d06f1fa97563386d5ebc64cd6");
    expect(signupUserReceipt.predecessor).toEqual({
      path:"docs/delivery/sonic-p02-signup-confirm-transport-successor-20261107.json",
      blob:"a25c45beaee878113757e59310ba480fc9e81c59",unchanged:true,
    });
    expect(signupUserReceipt.predecessor.blob).toBe(gitHash(signupConfirmTransportRaw));
    expect(signupUserReceipt.changedSource).toEqual([
      {path:"src/app/auth/sign-up/actions.ts",previousBlob:"3e925d4ec220f7264e5c6407c42e2670be5cebef",currentBlob:"e08615dda66c6b7068c92ac56fe60364e6188ec4"},
      {path:"tests/e2e/p02-signup-confirm-transport-outcome.test.ts",previousBlob:"f6659f118c343173b12767c102afc312053a32ff",currentBlob:"6d5d988a535039b03df8fcf7082caeea8f3f3b42"},
    ]);
    expect(signupUserReceipt.testCases).toBe(12);
    for(const changed of signupUserReceipt.changedSource){
      expect(changed.path).not.toContain("..");
      expect(gitHash(read(changed.path)),changed.path).toBe(currentCheckEmailBlob(changed.path,changed.currentBlob));
    }
    expect(signupUserReceipt.unchangedSource).toEqual([
      {path:"src/app/auth/confirm/route.ts",blob:"4ab0f387ded6284c9af9b403c178e5869dbe8a33",unchanged:true},
      {path:".github/workflows/sonic-p02-auth-origin-focused.yml",blob:"42e200cdfe166ebb0e2f5eb187b182ab81c24490",unchanged:true},
    ]);
    for(const unchanged of signupUserReceipt.unchangedSource){
      expect(gitHash(read(unchanged.path)),unchanged.path).toBe(unchanged.blob);
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
   expect(gitHash(read(change.path)),change.path)
     .toBe(currentRecoveryQaSource(change.path,
       change.path===resetRetry.reviewedPage.path
         ?resetRetry.reviewedPage.newBlob:change.currentBlob));
  }
  expect(reset.addedSource).toHaveLength(2);
  for(const source of reset.addedSource){
   expect(source.path).not.toContain("..");
   expect(gitHash(read(source.path)),source.path).toBe(currentRecoveryQaSource(source.path,source.blob));
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
   expect(gitHash(read(lane.path)),lane.path).toBe(lane.blob);
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
   expect(gitHash(read(source.path)),source.path)
     .toBe(currentExplicitOnboardingBlob(source.path,currentQaOwnerLookupBlob(source.path,currentRecoveryQaSource(source.path,expectedCurrentOwnerSlugBlob(source.path,fixtureFix?.currentBlob??qaWitness?.currentBlob??later?.currentBlob??source.blob)))));
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
   const reviewed=f.path===race.workflow.path?writerAudit.workflowSuccessor.currentBlob:f.blob;
   expect(gitHash(read(f.path)),f.path).toBe(reviewed);
  }
  const priorWorkflow=overlay.changedFiles.find(x=>x.path===p02.workflowSuccessor.path);
  expect(priorWorkflow?.blob).toBe(p02.workflowSuccessor.previousBlob);
  for(const f of overlay.changedFiles){
   const expected=f.path===p02.workflowSuccessor.path
    ? writerAudit.workflowSuccessor.currentBlob : f.blob;
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
