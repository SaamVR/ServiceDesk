import {describe,expect,it} from "vitest";
import {isVerifiedPaidInvoiceMilestone} from "../../src/server/workflows/paid-invoice-milestone";
const saved={
 id:"invoice-1",quote_id:"quote-1",status:"PAID",currency:"USD",
 total_minor:29000,allocated_minor:34000,refunded_minor:5000,balance_minor:0,
};
const verified=(r:unknown)=>isVerifiedPaidInvoiceMilestone(r as Record<string,unknown>);
describe("R40 C16 paid-invoice event authority",()=>{
 it("allows only committed reconciled refund-adjusted invoice milestones",()=>{
   expect(verified(saved)).toBe(true);
   expect(verified({...saved,refunded_minor:0,allocated_minor:29000})).toBe(true);
   expect(verified({...saved,allocated_minor:29000,refunded_minor:5000})).toBe(false);
 });
 it("never throws or verifies null, arrays, inherited/prototype source",()=>{
   for(const bad of [null,undefined,[],0,"PAID",
     Object.assign(Object.create({status:"PAID"}),Object.fromEntries(
       Object.entries(saved).filter(([k])=>k!=="status"))),
   ]){
     expect(()=>verified(bad)).not.toThrow();
     expect(verified(bad)).toBe(false);
   }
 });
 it("rejects concealed payment proofs, accessors, symbols and unselected provider fields",()=>{
   const hidden=Object.defineProperty({...saved},"providerPaymentReceived",{
     value:true,enumerable:false,
   });
   const accessor=Object.defineProperty({...saved},"allocated_minor",{
     enumerable:true,get(){throw Error("unsafe provider money hook");},
   });
   const symbol=Symbol("secret"),symbolRow={...saved,[symbol]:"sensitive"};
   for(const v of [hidden,accessor,symbolRow,{...saved,providerEventId:"unverified"}]){
     expect(()=>verified(v)).not.toThrow();
     expect(verified(v)).toBe(false);
   }
 });
 it("refuses missing saved financial facts and nonfinite totals",()=>{
   for(const name of ["status","currency","total_minor","allocated_minor",
     "refunded_minor","balance_minor"]){
     const row={...saved} as Record<string,unknown>;
     delete row[name];
     expect(verified(row)).toBe(false);
   }
   for(const n of [-1,NaN,Infinity,1.5,"29000"]){
     expect(verified({...saved,total_minor:n})).toBe(false);
   }
 });
});
