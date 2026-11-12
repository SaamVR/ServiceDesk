import {beforeEach,describe,expect,it,vi} from "vitest";
import type {OwnerAutomationOpportunityDependencies} from "../../src/server/ai/owner-automation-opportunities";
const mocked=vi.hoisted(()=>({suggest:vi.fn()}));
vi.mock("../../src/server/ai/owner-automation-opportunities",()=>({
 suggestOwnerAutomationOpportunities:mocked.suggest,
}));
import {requestOwnerOpportunityPreview} from "../../src/features/operations/owner-opportunity-preview-action";
const ws="11111111-1111-4111-8111-111111111111";
const branch="22222222-2222-4222-8222-222222222222";
const slug="qa-cleaning";
const rule=(kind:"critical"|"request")=>({
 state:"DRAFT_REQUIRES_OWNER_REVIEW",
 source:"UNTRUSTED_MODEL_SUGGESTION_STRICTLY_COMPILED",
 workspaceId:ws,branchId:branch,
 eventType:kind==="critical"?"ATTENTION_OPENED":"REQUEST_CREATED",
 conditions:[],
 actions:[{type:"CREATE_ATTENTION",severity:kind==="critical"?"CRITICAL":"WARNING",
  summaryKey:kind==="critical"?"AI_TRIAGE_EXCEPTION":"AI_REVIEW_NEW_REQUEST"}],
 maxActionsPerEvent:1,published:false,requiresOwnerPublish:true,
 previewOnly:true,sendsCustomerMessages:false,mutatesFinancialState:false,
});
function response(){
 return {ok:true,value:{
  state:"OWNER_SAVED_SIGNALS_FUTURE_RULE_DRAFTS_ONLY",
  source:"DOUBLE_CHECKED_OWNER_WORKDAY_AND_SAVED_BRANCH",
  workspaceId:ws,branchId:branch,inspectedPriorities:2,
  suggestions:[
   {evidenceKey:"CRITICAL_ATTENTION",savedCount:2,target:"FUTURE_ATTENTION_OPENED",
    draft:rule("critical"),existingCasesProcessed:false,published:false,requiresOwnerApproval:true},
   {evidenceKey:"OPEN_REQUEST",savedCount:4,target:"FUTURE_REQUEST_CREATED",
    draft:rule("request"),existingCasesProcessed:false,published:false,requiresOwnerApproval:true},
  ],
  modelInvoked:false,published:false,providerMessagesSent:false,financialStateChanged:false,
 }};
}
function mockSource(options:{active?:boolean;foreign?:boolean;error?:boolean}={}){
 const tables:string[]=[],filters:Array<[string,unknown]>=[];
 const query={select(){return query;},eq(k:string,v:unknown){filters.push([k,v]);return query;},
  async maybeSingle(){return {error:options.error?{code:"DB_FAILURE"}:null,
   data:{id:branch,workspace_id:options.foreign?"other_ws":ws,active:options.active!==false}};}};
 const service={from(table:string){tables.push(table);return query;}};
 mocked.suggest.mockImplementation(async (_slug:string,_branch:string,deps:OwnerAutomationOpportunityDependencies)=>{
  if(!deps?.verifyBranch||!(await deps.verifyBranch(service as never,ws,branch)))
   return {ok:false,code:"OPPORTUNITY_BRANCH_UNVERIFIED"};
  return response();
 });
 return {tables,filters};
}
beforeEach(()=>mocked.suggest.mockReset());
describe("F12 owner source action and saved active workspace_branch guard",()=>{
 it("reuses owner read engine with verified real workspace_branches query and safe projection",async()=>{
  const rig=mockSource();
  const r=await requestOwnerOpportunityPreview({workspaceSlug:slug,branchId:branch});
  expect(r).toMatchObject({ok:true,state:"OWNER_OPPORTUNITY_REVIEW_ONLY",
   modelInvoked:false,saved:false,executed:false,published:false,providerMessagesSent:false,
   financialStateChanged:false,
   suggestions:[{evidenceKey:"CRITICAL_ATTENTION",eventType:"ATTENTION_OPENED",
    summaryKey:"AI_TRIAGE_EXCEPTION"},{evidenceKey:"OPEN_REQUEST",
    eventType:"REQUEST_CREATED",summaryKey:"AI_REVIEW_NEW_REQUEST"}]});
  expect(rig.tables).toEqual(["workspace_branches"]);
  expect(rig.filters).toContainEqual(["workspace_id",ws]);
  expect(rig.filters).toContainEqual(["active",true]);
 });
 it("rejects revoked, foreign branch or failed saved branch query",async()=>{
  for(const options of [{active:false},{foreign:true},{error:true}]){
   mockSource(options);
   expect(await requestOwnerOpportunityPreview({workspaceSlug:slug,branchId:branch}))
    .toMatchObject({ok:false,state:"OWNER_OPPORTUNITY_UNAVAILABLE"});
  }
 });
 it("denies malformed input, injected send flags, getter and hidden permission fields before engine call",async()=>{
  mockSource();
  expect(await requestOwnerOpportunityPreview({workspaceSlug:"bad slug",branchId:branch}))
   .toMatchObject({ok:false});
  expect(await requestOwnerOpportunityPreview({workspaceSlug:slug,branchId:branch,paidModel:true}))
   .toMatchObject({ok:false});
  const a={workspaceSlug:slug,branchId:branch};
  Object.defineProperty(a,"workspaceSlug",{get(){throw Error("poison");}});
  expect(await requestOwnerOpportunityPreview(a)).toMatchObject({ok:false});
  const b={workspaceSlug:slug,branchId:branch};
  Object.defineProperty(b,"send",{value:true,enumerable:false});
  expect(await requestOwnerOpportunityPreview(b)).toMatchObject({ok:false});
  expect(mocked.suggest).not.toHaveBeenCalled();
 });
 it("denies forged model action, source and fake published flags",async()=>{
  mockSource();
  mocked.suggest.mockResolvedValueOnce({...response(),
   value:{...response().value,suggestions:[{...response().value.suggestions[0],
    draft:{...rule("critical"),actions:[{type:"SEND_EMAIL_TEMPLATE",severity:"CRITICAL",
     summaryKey:"AI_TRIAGE_EXCEPTION"}]}}]}});
  expect(await requestOwnerOpportunityPreview({workspaceSlug:slug,branchId:branch}))
   .toMatchObject({ok:false});
  mocked.suggest.mockResolvedValueOnce({...response(),value:{...response().value,modelInvoked:true}});
  expect(await requestOwnerOpportunityPreview({workspaceSlug:slug,branchId:branch}))
   .toMatchObject({ok:false});
 });
});
