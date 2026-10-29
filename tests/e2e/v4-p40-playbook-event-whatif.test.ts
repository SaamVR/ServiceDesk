import {describe,it,expect} from "vitest";
import {automationPlaybooks} from "../../src/features/operations/automation-playbooks";
import {reviewFictionalPlaybookSignal} from "../../src/features/operations/automation-playbook-event-whatif";
import {readFileSync} from "node:fs";
describe("P40 owner automation fictional event preview",()=>{
 it("explains all 27 static internal-attention starters without pretending a live action",()=>{
  expect(automationPlaybooks).toHaveLength(27);
  for(const playbook of automationPlaybooks){
   const missing=reviewFictionalPlaybookSignal(playbook.id,"UNKNOWN");
   expect(missing).toMatchObject({ok:true,value:{match:"UNKNOWN",action:"CREATE_ATTENTION",
    ownerApprovalRequired:true,published:false,executed:false,messagesSent:false,modelInvoked:false}});
   expect(reviewFictionalPlaybookSignal(playbook.id,"EXACT")).toMatchObject({ok:true,value:{match:"MATCHED"}});
   expect(reviewFictionalPlaybookSignal(playbook.id,"DIFFERENT"))
    .toMatchObject({ok:true,value:{match:playbook.condition?"NOT_MATCHED":"MATCHED"}});
  }
 });
 it("does not treat missing event facts as evidence of a false or true condition",()=>{
  const conditional=automationPlaybooks.find(p=>p.condition?.value==="DEEP");
  if(!conditional)throw Error("Expected DEEP condition");
  expect(reviewFictionalPlaybookSignal(conditional.id,"UNKNOWN")).toMatchObject({ok:true,value:{match:"UNKNOWN"}});
  expect(reviewFictionalPlaybookSignal(conditional.id,"DIFFERENT")).toMatchObject({ok:true,value:{match:"NOT_MATCHED"}});
 });
 it("denies untrusted playbook IDs, forged choices and prototype keys",()=>{
  for(const id of [null,{},false,"__proto__","constructor","not-in-catalogue"])
   expect(reviewFictionalPlaybookSignal(id,"EXACT")).toMatchObject({ok:false,code:"PLAYBOOK_NOT_IN_CATALOG"});
  expect(reviewFictionalPlaybookSignal(automationPlaybooks[0].id,"EXECUTE"))
   .toMatchObject({ok:false,code:"FICTIONAL_CHOICE_INVALID"});
 });
 it("provides visible keyboard-accessible UX and has no provider or DB mutation path",()=>{
  const source=readFileSync("src/features/operations/AutomationPlaybookBrowser.tsx","utf8");
  expect(source).toContain("reviewFictionalPlaybookSignal(preview.id, whatIf)");
  expect(source).toContain('aria-label="Fictional event preview"');
  expect(source).toContain('aria-live="polite"');
  expect(source).not.toContain("fetch(");
  const helper=readFileSync("src/features/operations/automation-playbook-event-whatif.ts","utf8");
  expect(helper).not.toContain("supabase");
  expect(helper).not.toContain("publishOperational");
 });
});
