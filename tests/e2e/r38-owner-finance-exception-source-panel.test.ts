import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {parseOwnerFinanceExceptions} from "../../src/features/operations/owner-finance-exception-proof";

const base={state:"FINANCE_OWNER_MANUAL_REVIEW",
 source:"AUTHORIZED_SAVED_INVOICE_SNAPSHOT",workspaceId:"workspace-a",
 inspectedCount:3,exceptionCount:2,
 exceptions:[
  {invoiceId:"invoice-a",priority:"HIGH",codes:["PAID_STATUS_LEDGER_CONFLICT"]},
  {invoiceId:"invoice-b",priority:"NORMAL",codes:["PARTIAL_BALANCE_REVIEW"]},
 ],
 paymentConfirmed:false,refundAuthorized:false,providerMessageQueued:false,
};
const read=(p:string)=>readFileSync(join(process.cwd(),p),"utf8");
describe("R38 owner finance source-only exception investigation",()=>{
 it("accepts only two-read source proof and exact status/priority categories",()=>{
   expect(parseOwnerFinanceExceptions(base)).toEqual(base);
   expect(parseOwnerFinanceExceptions({...base,source:"MODEL_INFERRED"})).toBeNull();
   expect(parseOwnerFinanceExceptions({...base,paymentConfirmed:true})).toBeNull();
   expect(parseOwnerFinanceExceptions({...base,refundAuthorized:true})).toBeNull();
   expect(parseOwnerFinanceExceptions({...base,providerMessageQueued:true})).toBeNull();
   expect(parseOwnerFinanceExceptions({...base,exceptionCount:0})).toBeNull();
   expect(parseOwnerFinanceExceptions({...base,inspectedCount:1})).toBeNull();
 });
 it("rejects malformed ledger refs, duplicate rows, nonsource amounts and invented success",()=>{
   for(const record of [
    {...base,exceptions:[base.exceptions[0],base.exceptions[0]]},
    {...base,exceptions:[{...base.exceptions[0],customerEmail:"private@example.test"},base.exceptions[1]]},
    {...base,exceptions:[{...base.exceptions[0],priority:"NORMAL"},base.exceptions[1]]},
    {...base,exceptions:[{...base.exceptions[0],codes:["SEND_MONEY"]},base.exceptions[1]]},
    {...base,exceptions:[{...base.exceptions[0],invoiceId:"<script>"},base.exceptions[1]]},
    {...base,exceptions:[base.exceptions[1],base.exceptions[0]]},
    {...base,apiKey:"DO_NOT_RENDER"},
    {...base,inspectedCount:300},
    {...base,exceptions:[]},
   ])expect(parseOwnerFinanceExceptions(record)).toBeNull();
 });
 it("distinguishes verified zero from source unavailable and rejects unknown counts",()=>{
   const empty={...base,inspectedCount:0,exceptionCount:0,exceptions:[]};
   expect(parseOwnerFinanceExceptions(empty)?.exceptionCount).toBe(0);
   expect(parseOwnerFinanceExceptions({ok:false,code:"FINANCE_SOURCE_INCOMPLETE"})).toBeNull();
   expect(parseOwnerFinanceExceptions({...base,exceptionCount:-1})).toBeNull();
 });
 it("connects protected owner-only HTTP, correct saved invoice route and fail-closed status",()=>{
   const ui=read("src/features/operations/OwnerFinanceExceptionReview.tsx");
   const parent=read("src/features/operations/AiOwnerOperationsBrief.tsx");
   const css=read("src/features/operations/OwnerFinanceExceptionReview.module.css");
   expect(parent).toContain("<OwnerFinanceExceptionReview workspaceSlug={workspaceSlug}/>");
   expect(ui).toContain('fetch("/api/internal/ai/finance-review"');
   expect(ui).toContain('method:"POST",credentials:"same-origin",cache:"no-store"');
   expect(ui).toContain('body:JSON.stringify({workspaceSlug})');
   expect(ui).toContain('invoiceQueueHref("all","",item.invoiceId)');
   expect(ui).toContain("This is NOT proof that");
   expect(ui).toContain("uses no generative model");
   expect(ui).toContain('controller.signal.aborted||request.current!==controller');
   expect(css).toContain("@media(max-width:540px)");
   expect(css).toContain("focus-visible");
 });
});
