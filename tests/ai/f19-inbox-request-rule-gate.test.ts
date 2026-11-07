import {describe,expect,it} from "vitest";
import {canProcessSavedInboxRequestRules} from "../../src/features/operations/inbox-request-rule-gate";
const requestId="11111111-1111-4111-8111-111111111111";
const branch="22222222-2222-4222-8222-222222222222";
const ruleId="33333333-3333-4333-8333-333333333333";
function setup(patch:Record<string,unknown>={}){
 return {
  request:{id:requestId,branchId:branch,status:"NEW"},
  mode:"SERVICE_ROLE",workflowAvailable:true,
  rules:[{id:ruleId,branchId:branch,status:"ACTIVE",publishedVersionNumber:3}],
  versions:[{ruleId,branchId:branch,versionNumber:3,state:"PUBLISHED",eventType:"REQUEST_CREATED"}],
  ...patch,
 } as never;
}
describe("F19 owner Inbox executable rule eligibility gate",()=>{
 it("shows action only for existing published active REQUEST_CREATED rules on selected branch",()=>{
  expect(canProcessSavedInboxRequestRules(setup())).toBe(true);
  for(const status of ["NEW","COLLECTING","READY","NEEDS_REVIEW","QUOTED","BOOKED"]){
   expect(canProcessSavedInboxRequestRules(setup({request:{id:requestId,branchId:branch,status}}))).toBe(true);
  }
 });
 it("never displays privileged control under RLS QA or disabled backend",()=>{
  for(const mode of ["QA_SESSION_RLS","DISABLED"])
   expect(canProcessSavedInboxRequestRules(setup({mode}))).toBe(false);
  expect(canProcessSavedInboxRequestRules(setup({workflowAvailable:false}))).toBe(false);
  expect(canProcessSavedInboxRequestRules(setup({workflowAvailable:undefined}))).toBe(false);
 });
 it("rejects missing request, bad state or unsupported branch identity",()=>{
  for(const request of [
   undefined,{id:requestId,status:"NEW"},{id:requestId,branchId:"bad",status:"NEW"},
   {id:requestId,branchId:branch,status:"CLOSED"},
   {id:requestId,branchId:branch,status:"LOST"},
   {id:"fake@example.org",branchId:branch,status:"NEW"},
  ])expect(canProcessSavedInboxRequestRules(setup({request}))).toBe(false);
 });
 it("requires exact rule state, branch, published revision and event family",()=>{
  for(const rules of [
   [],[{id:ruleId,branchId:branch,status:"DRAFT",publishedVersionNumber:3}],
   [{id:ruleId,branchId:branch,status:"PAUSED",publishedVersionNumber:3}],
   [{id:ruleId,branchId:"44444444-4444-4444-8444-444444444444",status:"ACTIVE",publishedVersionNumber:3}],
   [{id:ruleId,branchId:branch,status:"ACTIVE",publishedVersionNumber:4}],
   [{id:ruleId,branchId:branch,status:"ACTIVE",publishedVersionNumber:0}],
  ])expect(canProcessSavedInboxRequestRules(setup({rules}))).toBe(false);
  for(const versions of [
   [],[{ruleId,branchId:branch,versionNumber:3,state:"DRAFT",eventType:"REQUEST_CREATED"}],
   [{ruleId,branchId:branch,versionNumber:3,state:"PUBLISHED",eventType:"QUOTE_ACCEPTED"}],
   [{ruleId:"55555555-5555-4555-8555-555555555555",branchId:branch,versionNumber:3,state:"PUBLISHED",eventType:"REQUEST_CREATED"}],
   [{ruleId,branchId:"44444444-4444-4444-8444-444444444444",versionNumber:3,state:"PUBLISHED",eventType:"REQUEST_CREATED"}],
  ])expect(canProcessSavedInboxRequestRules(setup({versions}))).toBe(false);
 });
 it("bounds oversized or absent saved source collections",()=>{
  expect(canProcessSavedInboxRequestRules(setup({rules:undefined}))).toBe(false);
  expect(canProcessSavedInboxRequestRules(setup({versions:null}))).toBe(false);
  expect(canProcessSavedInboxRequestRules(setup({rules:Array(65).fill({id:ruleId,branchId:branch,status:"ACTIVE",publishedVersionNumber:3})}))).toBe(false);
  expect(canProcessSavedInboxRequestRules(setup({versions:Array(257).fill({ruleId,branchId:branch,versionNumber:3,state:"PUBLISHED",eventType:"REQUEST_CREATED"})}))).toBe(false);
 });
});
