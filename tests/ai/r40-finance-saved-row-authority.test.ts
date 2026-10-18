import {describe,expect,it} from "vitest";
import {planOwnerInvoiceExceptions} from "../../src/server/ai/invoice-exception-review";
import type {InvoiceDTO} from "../../src/contracts";
const workspaceId="ws-ledger",actor={workspaceId,role:"OWNER" as const};
const inv=(id:string):InvoiceDTO=>({id,workspaceId,status:"ISSUED",currency:"USD",
 totalMinor:1000,allocatedMinor:100,refundedMinor:0,balanceMinor:900});
const plan=(invoices:InvoiceDTO[])=>planOwnerInvoiceExceptions({workspaceId,actor,invoices});
describe("SONIC R40 finance source has no hidden approval or unreviewed ledger data",()=>{
 it("keeps a genuine saved invoice available for manual review without charging",()=>{
   expect(plan([inv("invoice-1")])).toMatchObject({ok:true,value:{
    inspectedCount:1,exceptionCount:1,paymentConfirmed:false,
    refundAuthorized:false,providerMessageQueued:false}});
 });
 it("rejects prototype-backed and accessor-replaced invoice rows",()=>{
   const inherited=Object.assign(Object.create({customerContact:"private"}),inv("invoice-1"));
   const accessor=Object.defineProperty({...inv("invoice-1")},"status",{
     enumerable:true,get(){throw Error("unexpected customer data read");},
   });
   for(const row of [inherited,accessor]){
     expect(()=>plan([row])).not.toThrow();
     expect(plan([row])).toMatchObject({ok:false,code:"FINANCE_SOURCE_INVALID"});
   }
 });
 it("does not silently ignore hidden saved invoice fields or symbols",()=>{
   const hidden=Object.defineProperty({...inv("invoice-1")},"customerPhone",{
     enumerable:false,value:"customer private contact",
   });
   const sym=Symbol("secret");
   const symbolRow={...inv("invoice-1"),[sym]:"private"};
   for(const row of [hidden,symbolRow]){
     expect(plan([row])).toMatchObject({ok:false,code:"FINANCE_SOURCE_INVALID"});
   }
 });
 it("rejects sparse arrays, metadata-bearing batches and full-page unknown completeness",()=>{
   const sparse=[inv("invoice-1"),inv("invoice-2")];
   delete sparse[1];
   expect(plan(sparse)).toMatchObject({ok:false,code:"FINANCE_SOURCE_INVALID"});
   const hidden=Object.defineProperty([inv("invoice-1")],"cursor",{
      value:"next-page",enumerable:false,
   });
   expect(plan(hidden)).toMatchObject({ok:false,code:"FINANCE_SOURCE_INVALID"});
   const cap=Array.from({length:500},(_,i)=>inv("invoice-"+i));
   expect(plan(cap)).toMatchObject({ok:false,code:"FINANCE_SOURCE_INVALID"});
 });
 it("rejects arbitrary saved-row properties that can conceal payment authority",()=>{
   expect(plan([{...inv("invoice-1"),paymentStatus:"VERIFIED"} as unknown as InvoiceDTO]))
     .toMatchObject({ok:false,code:"FINANCE_SOURCE_INVALID"});
   expect(plan([{...inv("invoice-1"),providerMessageSent:true} as unknown as InvoiceDTO]))
     .toMatchObject({ok:false,code:"FINANCE_SOURCE_INVALID"});
 });
});
