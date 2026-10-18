import {describe,expect,it} from "vitest";
import {previewAutomationCatalogCoverage} from "../../src/server/ai/automation-coverage-batch";
const owner={workspaceId:"workspace-1",role:"OWNER" as const};
const sample={
 actor:owner,workspaceId:"workspace-1",branchId:"branch-1",
 scenarios:[
  {scenarioId:"scenario-request",eventType:"REQUEST_CREATED" as const,
   snapshot:{"request.serviceCode":"DEEP","request.leadSource":"WEBSITE","request.branchCode":"MAIN"}},
  {scenarioId:"scenario-accepted",eventType:"QUOTE_ACCEPTED" as const,
   snapshot:{"quote.currency":"USD","quote.branchCode":"MAIN","request.serviceCode":"STANDARD"}},
  {scenarioId:"scenario-complete",eventType:"VISIT_COMPLETED" as const,
   snapshot:{"visit.branchCode":"MAIN","request.serviceCode":"STANDARD","visit.hasIncident":true}},
 ]
};
describe("SONIC R41 bulk synthetic automation acceptance matrix",()=>{
 it("evaluates multiple fictional lifecycle events through the same real 27-template rules with no effects",()=>{
  const r=previewAutomationCatalogCoverage(sample);
  expect(r).toMatchObject({ok:true,value:{
    state:"SYNTHETIC_CATALOG_COVERAGE_ONLY",inspectedScenarios:3,
    inputSource:"FICTIONAL_OWNER_SCENARIOS",
    published:false,executed:false,providerMessagesSent:false,
    customerCharged:false,ownerApprovalRequired:true,
  }});
  if(!r.ok)throw Error("invalid verified synthetic fixture");
  expect(r.value.evaluatedPlaybookChecks).toBeGreaterThan(0);
  expect(r.value.totalTemplateMatches).toBeGreaterThan(0);
  expect(r.value.distinctMatchedTemplates).toBeGreaterThan(0);
  expect(r.value.matches).toHaveLength(3);
  expect(JSON.stringify(r)).not.toContain("example@private");
 });
 it("blocks any foreign owner or malformed scenario rather than returning partial coverage",()=>{
  expect(previewAutomationCatalogCoverage({...sample,actor:{...owner,role:"DISPATCHER"}}))
    .toMatchObject({ok:false,code:"AUTOMATION_COVERAGE_SCOPE_INVALID"});
  expect(previewAutomationCatalogCoverage({...sample,actor:{...owner,workspaceId:"other"}}))
    .toMatchObject({ok:false,code:"AUTOMATION_COVERAGE_SCOPE_INVALID"});
  expect(previewAutomationCatalogCoverage({...sample,scenarios:[
    sample.scenarios[0],{...sample.scenarios[0],scenarioId:"bad-event",
    snapshot:{"customer.email":"private@example.test"}},
  ]})).toMatchObject({ok:false,code:"AUTOMATION_COVERAGE_SOURCE_INVALID"});
 });
 it("rejects duplicate scenario IDs, hidden inputs, missing source, arrays at capacity and fake source receipts",()=>{
  expect(previewAutomationCatalogCoverage({...sample,scenarios:[sample.scenarios[0],sample.scenarios[0]]}))
    .toMatchObject({ok:false,code:"AUTOMATION_COVERAGE_SOURCE_INVALID"});
  expect(previewAutomationCatalogCoverage({...sample,scenarios:[]}))
    .toMatchObject({ok:false,code:"AUTOMATION_COVERAGE_SOURCE_INVALID"});
  expect(previewAutomationCatalogCoverage({...sample,scenarios:Array(13).fill(sample.scenarios[0])}))
    .toMatchObject({ok:false,code:"AUTOMATION_COVERAGE_SOURCE_INVALID"});
  const forged=Object.defineProperty({...sample.scenarios[0]},"published",{value:true,enumerable:false});
  expect(previewAutomationCatalogCoverage({...sample,scenarios:[forged]}))
    .toMatchObject({ok:false,code:"AUTOMATION_COVERAGE_SOURCE_INVALID"});
  expect(previewAutomationCatalogCoverage({...sample,scenarios:[{
     ...sample.scenarios[0],sourceEventId:"already-saved"
   }]})).toMatchObject({ok:false,code:"AUTOMATION_COVERAGE_SOURCE_INVALID"});
 });
});
