import { describe, expect, it } from "vitest";
import {
 generateOwnerOperationsBrief,
 type OwnerOperationsBriefDependencies,
} from "../../src/server/ai/owner-operations-brief";

const at = "2026-10-17T07:00:00.000Z";
const workspaceId = "workspace-qa-a";
const userId = "owner-a";
const slug = "qa-cleaning-a";
const actor = { userId, workspaceId, role: "OWNER" };
const workspace = { id: workspaceId, slug };
const snapshot = () => ({
 workspace, actor, loadedAt: at,
 requests: [{ status: "NEW" }], quotes: [], invoices: [], visits: [],
 attentionItems: [],
});
function testDependencies(secondActorWorkspace: string) {
 let sourceReads=0;
 let modelCalls=0;
 const deps = {
  now: () => Date.parse(at),
  resolveActor: async () => ({ok:true,value:{actor,workspace}}),
  loadSnapshot: async () => {
   sourceReads++;
   return {ok:true,value:{...snapshot(),
    actor:{...actor,workspaceId:sourceReads===1?workspaceId:secondActorWorkspace}}};
  },
  readConfig: () => ({ok:true,value:{model:"inert-test-no-network"}}),
  callModel: async () => {
   modelCalls++;
   return {ok:true,value:{
     replyDraft:"Review open requests in the saved queue.",
     requestedToolCalls:[],citations:[],
   }};
  },
 } as unknown as OwnerOperationsBriefDependencies;
 return {deps,readCount:()=>sourceReads,modelCount:()=>modelCalls};
}
describe("R19E verified owner brief rechecks actor tenant on post-model snapshot",()=>{
 it("accepts the two same-owner, same-workspace checked snapshots with stubbed AI",async()=>{
  const f=testDependencies(workspaceId);
  const result=await generateOwnerOperationsBrief(slug,f.deps);
  expect(result).toMatchObject({ok:true,value:{state:"OWNER_AI_ADVISORY_ONLY"}});
  expect(f.readCount()).toBe(2);
  expect(f.modelCount()).toBe(1);
 });
 it("rejects a new actor workspace despite unchanged workspace record, user and counts",async()=>{
  const f=testDependencies("workspace-qa-b");
  const result=await generateOwnerOperationsBrief(slug,f.deps);
  expect(result).toMatchObject({ok:false,code:"OWNER_BRIEF_ACCESS_REVOKED"});
  expect(f.readCount()).toBe(2);
  expect(f.modelCount()).toBe(1);
 });
});
