import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {describe,it,expect} from "vitest";
import {reviewFictionalPlaybookSignal} from "../../src/features/operations/automation-playbook-event-whatif";
import {automationPlaybooks} from "../../src/features/operations/automation-playbooks";
import {evaluateOwnerPricingScenarioMatrix} from "../../src/features/operations/owner-pricing-scenario-matrix";

type Locked={path:string;blobSha:string;sourcePr:number};
const manifest=JSON.parse(readFileSync("docs/delivery/sonic-p40-source-provenance-20261029.json","utf8")) as {
 base:string;lockedSources:Locked[];ownerApproval:null;productionMutation:boolean;canonicalMerged:boolean;
};
function gitBlobSha(value:Buffer):string{
 return createHash("sha1").update(Buffer.from("blob "+value.length+"\0")).update(value).digest("hex");
}
function ownerForm(){
 const form=new FormData();
 for(const [k,v] of Object.entries({setupId:"11111111-1111-4111-8111-111111111111",
 branchId:"22222222-2222-4222-8222-222222222222",currency:"USD",nameStandard:"Owner Standard",
 nameDeep:"Owner Deep",nameMoveOut:"Owner Moveout",depositPercent:"40",validHours:"24",
 bufferMinutes:"30",autoApprovalMax:"250.00"}))form.set(k,v);
 for(const p of ["standard","deep","moveOut"]){
  for(const [suffix,val] of Object.entries({Base:"140.00",BaseMinutes:"90",Bedroom:"30.00",
   BedroomMinutes:"15",Bathroom:"15.00",BathroomMinutes:"10"}))form.set(p+suffix,val);
 }
 form.set("moveOutOven","45.00");form.set("moveOutOvenMinutes","20");return form;
}
describe("independent P40 integrated source/provenance and business boundary critic",()=>{
 it("preserves the nine exact source file objects from two nonoverlapping feature PRs",()=>{
  expect(manifest.base).toBe("224f88ce76525bc0235acecb9e45a9ec34c9aaaa");
  expect(manifest.lockedSources).toHaveLength(9);
  expect(new Set(manifest.lockedSources.map(x=>x.path)).size).toBe(9);
  expect(manifest.ownerApproval).toBe(null);
  expect(manifest.productionMutation).toBe(false);
  expect(manifest.canonicalMerged).toBe(false);
  expect(new Set(manifest.lockedSources.map(x=>x.sourcePr))).toEqual(new Set([902,903]));
  for(const file of manifest.lockedSources){
   const bytes=readFileSync(file.path);
   expect(gitBlobSha(bytes),file.path).toBe(file.blobSha);
  }
 });
 it("never turns unavailable/unsupported owner prices into nine invented dollar values",()=>{
  const form=ownerForm();form.delete("standardBase");
  expect(evaluateOwnerPricingScenarioMatrix(form,false)).toMatchObject({state:"INCOMPLETE"});
  form.set("standardBase","140.00");form.set("currency","EUR");
  expect(evaluateOwnerPricingScenarioMatrix(form,false)).toMatchObject({state:"INCOMPLETE"});
  form.set("currency","USD");form.set("standardBedroom","NaN");
  expect(evaluateOwnerPricingScenarioMatrix(form,false)).toMatchObject({state:"INCOMPLETE"});
 });
 it("retains exact owner-entered policy and zero persisted actions on all nine hypothetical quotes",()=>{
  const rows=evaluateOwnerPricingScenarioMatrix(ownerForm(),true);
  expect(rows.state).toBe("READY");
  if(rows.state!=="READY")return;
  expect(rows.rows).toHaveLength(9);
  expect(rows.pricesSaved).toBe(false);
  expect(rows.customerQuoteCreated).toBe(false);
  for(const r of rows.rows){
   expect(r.subtotalMinor).toBeGreaterThan(0);
   expect(r.depositMinor+r.balanceMinor).toBe(r.subtotalMinor);
   expect(r.durationMinutes).toBeGreaterThan(0);
  }
 });
 it("treats unknown fictional event fields as unknown for every internal-only playbook",()=>{
  expect(automationPlaybooks).toHaveLength(27);
  for(const starter of automationPlaybooks){
   expect(starter.condition?.operator??"EQ").toBe("EQ");
   expect(reviewFictionalPlaybookSignal(starter.id,"UNKNOWN")).toMatchObject({
    ok:true,value:{match:"UNKNOWN",action:"CREATE_ATTENTION",published:false,
     executed:false,messagesSent:false,modelInvoked:false,financialStateChanged:false}});
   expect(reviewFictionalPlaybookSignal(starter.id,"DIFFERENT")).toMatchObject({
    ok:true,value:{match:starter.condition?"NOT_MATCHED":"MATCHED"}});
  }
  expect(reviewFictionalPlaybookSignal("untrusted","EXACT")).toMatchObject({ok:false});
 });
 it("keeps all UI what-if and pricing calculations local and cannot turn on live services",()=>{
  const files=["src/features/operations/owner-pricing-scenario-matrix.ts",
   "src/features/operations/automation-playbook-event-whatif.ts",
   "src/features/operations/AutomationPlaybookBrowser.tsx",
   "src/features/operations/OwnerCleaningPricingWorksheet.tsx"];
  const code=files.map(x=>readFileSync(x,"utf8")).join("\n");
  for(const forbidden of ["supabase.from(","publishOperationalWorkflowVersion(","chargeCustomer(",
   "queueApprovedInboxReply(","fetch("])expect(code).not.toContain(forbidden);
  expect(code).toContain('aria-live="polite"');
  expect(code).toContain('aria-label="Unsaved cleaning price scenario comparison"');
 });
});
