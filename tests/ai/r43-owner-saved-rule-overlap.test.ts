import {describe,expect,it} from "vitest";
import {compileModelWorkflowDraft} from "../../src/server/ai/workflow-draft-proposal";
import {reviewAuthorizedSavedOwnerRules,type OwnerPublishedRuleOverlapDeps} from "../../src/server/ai/owner-saved-rule-overlap";
import type {WorkflowRuleVersionDTO} from "../../src/contracts";
const ws="11111111-1111-4111-8111-111111111111",branch="22222222-2222-4222-8222-222222222222";
const scope={workspaceId:ws,branchId:branch,actorWorkspaceId:ws,role:"OWNER" as const};
const d=compileModelWorkflowDraft({eventType:"REQUEST_CREATED",severity:"WARNING"},scope);
if(!d.ok)throw Error("draft fixture");
const rule:WorkflowRuleVersionDTO={id:"version-1",ruleId:"rule-1",workspaceId:ws,branchId:branch,
 versionNumber:2,state:"PUBLISHED",eventType:"REQUEST_CREATED",conditions:[],
 actions:[{type:"CREATE_ATTENTION",severity:"WARNING",summaryKey:"SAFE_REVIEW"}],
 maxActionsPerEvent:1,createdAt:"2026-10-18T00:00:00Z"};
function fixture(opts:{drift?:boolean;revoke?:boolean;partial?:boolean}={}){
 let auth=0,reads=0,branchReads=0;
 const deps={
  resolveActor:async()=>{auth++;return {ok:true,value:{
    workspace:{id:ws,slug:"qa-cleaning"},
    actor:{workspaceId:ws,userId:auth>1&&opts.revoke?"other-user":"owner-1",role:"OWNER"},
    service:{} as never,
  }};},
  verifyBranch:async()=>{branchReads++;return true;},
  loadPublished:async()=>{
   reads++;
   if(opts.partial)return null;
   return reads>1&&opts.drift?[{...rule,versionNumber:3}]:[rule];
  },
 } as unknown as OwnerPublishedRuleOverlapDeps;
 return {deps,counts:()=>({auth,reads,branchReads})};
}
describe("R43 owner signed-in persisted published-rule overlap reader",()=>{
 it("returns true saved-rule overlap only after two owner/branch and inventory checks",async()=>{
  const q=fixture();const r=await reviewAuthorizedSavedOwnerRules("qa-cleaning",branch,[d.value],q.deps);
  expect(r).toMatchObject({ok:true,value:{
    overlapCount:1,ownerAndPublishedInventoryDoubleChecked:true,
    persistedRulePagesComplete:true,published:false,executed:false,
  }});
  expect(q.counts()).toEqual({auth:2,reads:2,branchReads:2});
 });
 it("rejects stale changed published rule and revoked owner after first read",async()=>{
  expect(await reviewAuthorizedSavedOwnerRules("qa-cleaning",branch,[d.value],fixture({drift:true}).deps))
   .toMatchObject({ok:false,code:"RULE_OWNER_SOURCE_CHANGED"});
  expect(await reviewAuthorizedSavedOwnerRules("qa-cleaning",branch,[d.value],fixture({revoke:true}).deps))
   .toMatchObject({ok:false,code:"RULE_OWNER_SOURCE_CHANGED"});
 });
 it("cannot label failed/truncated inventory as no conflict",async()=>{
  expect(await reviewAuthorizedSavedOwnerRules("qa-cleaning",branch,[d.value],fixture({partial:true}).deps))
   .toMatchObject({ok:false,code:"RULE_OWNER_INVENTORY_UNVERIFIED"});
  expect(await reviewAuthorizedSavedOwnerRules("qa-cleaning","invalid",[d.value],fixture().deps))
   .toMatchObject({ok:false,code:"RULE_OWNER_INPUT_INVALID"});
 });
});
