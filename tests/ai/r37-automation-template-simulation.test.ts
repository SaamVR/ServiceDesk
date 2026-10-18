import {describe,expect,it} from "vitest";
import {simulateAutomationCatalog} from "../../src/server/ai/automation-template-simulation";
const base={
 actor:{workspaceId:"workspace-1",role:"OWNER" as const},
 workspaceId:"workspace-1",branchId:"branch-1",
 eventType:"REQUEST_CREATED" as const,
 snapshot:{"request.serviceCode":"DEEP","request.leadSource":"WEBSITE"},
};
describe("SONIC R37 template-matching automation preview",()=>{
 it("matches existing safe templates to hypothetical deep-clean event with no effects",()=>{
  const r=simulateAutomationCatalog(base);
  expect(r).toMatchObject({ok:true,value:{
   state:"SYNTHETIC_AUTOMATION_RECOMMENDATIONS_ONLY",
   eventType:"REQUEST_CREATED",published:false,executed:false,
   sentCustomerMessage:false,chargedCustomer:false,
  }});
  if(!r.ok)throw Error("invalid fixture");
  expect(r.value.inspected).toBeGreaterThan(0);
  expect(r.value.matched).toBeGreaterThan(1);
  expect(r.value.suggestions.map(s=>s.code)).toContain("DEEP_ENQUIRY_ROUTING");
  expect(r.value.suggestions.every(s=>s.needsOwnerApproval && s.wouldCreateInternalAttention)).toBe(true);
 });
 it("does not pretend unknown signals matched template conditions",()=>{
  const r=simulateAutomationCatalog({...base,snapshot:{}});
  expect(r.ok).toBe(true);
  if(!r.ok)throw Error("fixture");
  expect(r.value.suggestions.some(x=>x.code==="DEEP_ENQUIRY_ROUTING")).toBe(false);
 });
 it("enforces owner and exact tenant scope",()=>{
  expect(simulateAutomationCatalog({...base,actor:{workspaceId:"other",role:"OWNER"}}))
   .toMatchObject({ok:false,code:"AUTOMATION_TEMPLATE_SCOPE_INVALID"});
  expect(simulateAutomationCatalog({...base,actor:{workspaceId:"workspace-1",role:"DISPATCHER"}}))
   .toMatchObject({ok:false,code:"AUTOMATION_TEMPLATE_SCOPE_INVALID"});
 });
 it("rejects provider or financial facts not in workflow event schema",()=>{
  for(const snapshot of [
   {"request.customerEmail":"secret@example.test"},
   {"invoice.paymentPaid":true},
   {"request.serviceCode":Infinity},
  ])expect(simulateAutomationCatalog({...base,snapshot}))
      .toMatchObject({ok:false,code:"AUTOMATION_TEMPLATE_INPUT_INVALID"});
 });
 it("reports bounded count and does not invent omitted matches",()=>{
  const a=simulateAutomationCatalog({...base,limit:1});
  expect(a).toMatchObject({ok:true,value:{truncated:true}});
  if(!a.ok)throw Error("fixture");
  expect(a.value.suggestions).toHaveLength(1);
  expect(a.value.matched).toBeGreaterThan(1);
 });
 it("refuses hidden event fields and accessor-based inputs without evaluating them",()=>{
  const snapshot=Object.defineProperty({"request.serviceCode":"DEEP"},"paymentPaid",{value:true,enumerable:false});
  expect(simulateAutomationCatalog({...base,snapshot}))
   .toMatchObject({ok:false,code:"AUTOMATION_TEMPLATE_INPUT_INVALID"});
  const accessor=Object.defineProperty({},"request.serviceCode",{enumerable:true,get(){throw Error("bad");}});
  expect(()=>simulateAutomationCatalog({...base,snapshot:accessor})).not.toThrow();
  expect(simulateAutomationCatalog({...base,snapshot:accessor}))
   .toMatchObject({ok:false,code:"AUTOMATION_TEMPLATE_INPUT_INVALID"});
 });
});
