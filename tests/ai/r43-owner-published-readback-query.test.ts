import {describe,expect,it} from "vitest";
import {reviewAuthorizedSavedOwnerRules,type OwnerPublishedRuleOverlapDeps} from "../../src/server/ai/owner-saved-rule-overlap";
import {compileModelWorkflowDraft} from "../../src/server/ai/workflow-draft-proposal";

const ws="11111111-1111-4111-8111-111111111111";
const branch="22222222-2222-4222-8222-222222222222";
const made=compileModelWorkflowDraft({eventType:"REQUEST_CREATED",severity:"WARNING"},{
 workspaceId:ws,branchId:branch,actorWorkspaceId:ws,role:"OWNER"
});
if(!made.ok)throw Error("draft fixture");
const savedRow={
 id:"33333333-3333-4333-8333-333333333333",
 workspace_id:ws,branch_id:branch,rule_id:"44444444-4444-4444-8444-444444444444",
 version_number:2,state:"PUBLISHED",event_type:"REQUEST_CREATED",
 conditions:[],actions:[{type:"CREATE_ATTENTION",severity:"WARNING",summaryKey:"SAFE_REVIEW"}],
 max_actions_per_event:1,created_at:"2026-10-18T00:00:00Z",
};
function source(opts:{rows?:unknown[];branch?:boolean;revoke?:boolean}={}){
 const recorded:{table:string;method:string;args:unknown[]}[]=[];
 let auth=0, reads=0;
 const service={from(table:string){
  const builder={
   select(...args:unknown[]){recorded.push({table,method:"select",args});return this;},
   eq(...args:unknown[]){recorded.push({table,method:"eq",args});return this;},
   order(...args:unknown[]){recorded.push({table,method:"order",args});return this;},
   async limit(...args:unknown[]){
     recorded.push({table,method:"limit",args});reads++;
     return {error:null,data:opts.rows??[savedRow]};
   },
   async maybeSingle(){return {error:null,data:opts.branch===false?null:{id:branch,workspace_id:ws}};},
  };
  return builder;
 }};
 const deps={resolveActor:async()=>{
   auth++;return {ok:true,value:{
     workspace:{id:ws,slug:"qa-cleaning"},
     actor:{workspaceId:ws,userId:auth===2&&opts.revoke?"other-owner":"owner-a",role:"OWNER"},
     service,
   }};
 }} as unknown as OwnerPublishedRuleOverlapDeps;
 return {deps,recorded,reads:()=>reads,auth:()=>auth};
}
describe("R43 critic owner published-rule readback query contract",()=>{
 it("reads exact workspace/branch published versions with capped pagination twice",async()=>{
  const fixture=source();
  const r=await reviewAuthorizedSavedOwnerRules("qa-cleaning",branch,[made.value],fixture.deps);
  expect(r).toMatchObject({ok:true,value:{overlapCount:1,
    ownerAndPublishedInventoryDoubleChecked:true,persistedRulePagesComplete:true}});
  expect(fixture.auth()).toBe(2);
  expect(fixture.reads()).toBe(2);
  const filters=fixture.recorded.filter(x=>x.table==="workflow_rule_versions");
  expect(filters.filter(x=>x.method==="eq").map(x=>x.args)).toEqual([
    ["workspace_id",ws],["branch_id",branch],["state","PUBLISHED"],
    ["workspace_id",ws],["branch_id",branch],["state","PUBLISHED"],
  ]);
  expect(filters.filter(x=>x.method==="limit").map(x=>x.args)).toEqual([[201],[201]]);
  expect(filters.filter(x=>x.method==="order").map(x=>x.args))
    .toEqual([["rule_id",{ascending:true}],["rule_id",{ascending:true}]]);
 });
 it("rejects a full sentinel page, denied saved branch, or revoked owner",async()=>{
  const filled=source({rows:Array(201).fill(savedRow)});
  expect(await reviewAuthorizedSavedOwnerRules("qa-cleaning",branch,[made.value],filled.deps))
   .toMatchObject({ok:false,code:"RULE_OWNER_INVENTORY_UNVERIFIED"});
  const denied=source({branch:false});
  expect(await reviewAuthorizedSavedOwnerRules("qa-cleaning",branch,[made.value],denied.deps))
   .toMatchObject({ok:false,code:"RULE_OWNER_BRANCH_UNVERIFIED"});
  const revoked=source({revoke:true});
  expect(await reviewAuthorizedSavedOwnerRules("qa-cleaning",branch,[made.value],revoked.deps))
   .toMatchObject({ok:false,code:"RULE_OWNER_SOURCE_CHANGED"});
 });
});
