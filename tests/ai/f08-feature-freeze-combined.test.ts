import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {describe,expect,it} from "vitest";

import {planAuthorizedSavedIntake} from "../../src/server/ai/f01-saved-intake-proposal";
import {proposeAuthorizedGroundedQuoteAlternatives} from "../../src/server/ai/f01-grounded-quote-alternatives";
import {proposeSavedCapacityDispatch} from "../../src/server/ai/f02-saved-capacity-dispatch";
import {proposeSavedVisitReworkReview} from "../../src/server/ai/f02-saved-visit-quality";
import {loadF03AuthorizedLedgerExplanation} from "../../src/server/ai/f03-saved-ledger-explanations";
import {loadF03SavedDailyWeeklyIntelligence} from "../../src/server/ai/f03-saved-daily-weekly-intelligence";
import {proposeF04ConsentedReplyDraft} from "../../src/server/ai/f04-consented-reply-draft";
import {proposeF04SavedRetentionReview} from "../../src/server/ai/f04-saved-retention-review";
import {prepareF05VersionedInstructionDraft} from "../../src/server/ai/f05-versioned-instruction-draft";
import {previewF05VersionedWhatIf} from "../../src/server/ai/f05-versioned-whatif";
import {proposeF06TypedEvent} from "../../src/server/ai/f06-typed-event-proposals";
import {previewF06InternalAction} from "../../src/server/ai/f06-internal-action-previews";
import {reviewF07SavedWorkflowFailures} from "../../src/server/ai/f07-saved-workflow-critic";
import {reviewF07SavedAiActionUsage} from "../../src/server/ai/f07-saved-ai-usage-review";

const manifestPath="docs/delivery/f08-feature-freeze-manifest-20261025.json";
interface PinnedFile{path:string;blobSha:string;change:string}
interface Batch{batch:string;issue:number;pr:number;headSha:string;
 sourceCiRun:number;files:PinnedFile[]}
interface Manifest{schemaVersion:string;canonicalHeadAtFreeze:string;
 batchCount:number;sourceFileCount:number;addedPathsNoOverlap:boolean;
 integrationOrder:Batch[];state:string;forbiddenWithoutOwnerApproval:string[];
 requiredProductionInterfaces:string[];providerLiveEvidence:boolean;
 tenantStagingAccepted:boolean;productionReady:boolean}
const readManifest=():Manifest=>JSON.parse(readFileSync(resolve(process.cwd(),manifestPath),"utf8")) as Manifest;
const gitBlob=(path:string)=>{
 const body=readFileSync(resolve(process.cwd(),path));
 return createHash("sha1").update(`blob ${body.length}\0`).update(body).digest("hex");
};

describe("F08 frozen F01-F07 combined source integrity and release veto",()=>{
 it("pins all 7 feature PRs, exact 30 additive blob hashes with no collisions",()=>{
  const m=readManifest();
  expect(m).toMatchObject({schemaVersion:"servicedesk-f08-freeze-manifest-v1",
   canonicalHeadAtFreeze:"f745c5990b51b5ab239c789a8c8bdbb383443223",
   state:"SOURCE_FROZEN_DRAFT_NOT_MERGED_NOT_RELEASED",batchCount:7,
   sourceFileCount:30,addedPathsNoOverlap:true});
  expect(m.integrationOrder.map(x=>x.batch)).toEqual([
   "F01","F02","F03","F04","F05","F06","F07"]);
  expect(m.integrationOrder.map(x=>x.pr)).toEqual([830,831,832,833,836,837,840]);
  expect(m.integrationOrder.map(x=>x.files.length)).toEqual([4,4,4,4,4,5,5]);
  const pinned=m.integrationOrder.flatMap(x=>x.files);
  expect(new Set(pinned.map(x=>x.path)).size).toBe(30);
  for(const f of pinned){
   expect(f).toMatchObject({change:"added",blobSha:expect.stringMatching(/^[a-f0-9]{40}$/)});
   expect(f.path).toMatch(/^(?:src\/server\/ai|tests\/ai|docs\/delivery)\/f0[1-7][\w.-]*$/);
   expect(gitBlob(f.path)).toBe(f.blobSha);
  }
 });
 it("loads 14 actual callable API surfaces at once without invoking paid provider transport",()=>{
  const callables=[
   planAuthorizedSavedIntake,proposeAuthorizedGroundedQuoteAlternatives,
   proposeSavedCapacityDispatch,proposeSavedVisitReworkReview,
   loadF03AuthorizedLedgerExplanation,loadF03SavedDailyWeeklyIntelligence,
   proposeF04ConsentedReplyDraft,proposeF04SavedRetentionReview,
   prepareF05VersionedInstructionDraft,previewF05VersionedWhatIf,
   proposeF06TypedEvent,previewF06InternalAction,
   reviewF07SavedWorkflowFailures,reviewF07SavedAiActionUsage,
  ];
  expect(callables).toHaveLength(14);
  for(const cb of callables)expect(typeof cb).toBe("function");
 });
 it("denies malformed cross-feature trigger, action, consented-draft and model spend queries before any transport",async()=>{
  expect(proposeF06TypedEvent({publish:true})).toMatchObject({ok:false});
  expect(previewF06InternalAction({kind:"SEND_WHATSAPP_TEMPLATE",recipient:"customer"}))
   .toMatchObject({ok:false});
  expect(await proposeF04ConsentedReplyDraft("../wrong","conversation-1"))
   .toMatchObject({ok:false});
  expect(await proposeF04SavedRetentionReview("../wrong"))
   .toMatchObject({ok:false});
  expect(await prepareF05VersionedInstructionDraft({} as never))
   .toMatchObject({ok:false});
  expect(await previewF05VersionedWhatIf({} as never))
   .toMatchObject({ok:false});
  expect(await reviewF07SavedWorkflowFailures("../wrong"))
   .toMatchObject({ok:false});
  expect(await reviewF07SavedAiActionUsage("../wrong"))
   .toMatchObject({ok:false});
 });
 it("preserves Production release veto, makes no claims of live provider or tenant success",()=>{
  const m=readManifest();
  expect(m.forbiddenWithoutOwnerApproval).toEqual(expect.arrayContaining([
   "canonical_merge","production_deploy","customer_sends",
   "migration_0063_0064_0065","provider_model_paid_calls",
  ]));
  expect(m.requiredProductionInterfaces.length).toBeGreaterThanOrEqual(8);
  expect(m).toMatchObject({
   providerLiveEvidence:false,tenantStagingAccepted:false,productionReady:false,
  });
 });
});
