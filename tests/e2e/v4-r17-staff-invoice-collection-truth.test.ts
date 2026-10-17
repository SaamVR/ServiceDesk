import {describe,expect,it} from "vitest";
import {isVerifiedStaffCollectibleInvoice} from "../../src/features/operations/staff-invoice-collection-readiness";
const saved={status:"ISSUED",currency:"USD",totalMinor:12000,
 allocatedMinor:2000,refundedMinor:0,balanceMinor:10000};
describe("R17 staff invoice collection saved ledger authority",()=>{
 it("permits only saved eligible invoice statuses and exact minor-unit arithmetic",()=>{
  expect(isVerifiedStaffCollectibleInvoice(saved)).toBe(true);
  expect(isVerifiedStaffCollectibleInvoice({...saved,status:"PARTIALLY_PAID",
    allocatedMinor:5500,refundedMinor:500,balanceMinor:7000})).toBe(true);
  for(const patch of [{status:"DRAFT"},{status:"PAID"},{status:"VOID"},
    {balanceMinor:9000},{totalMinor:0},{balanceMinor:0},
    {allocatedMinor:1000,refundedMinor:2000},{currency:"usd"},
    {allocatedMinor:Number.MAX_SAFE_INTEGER,refundedMinor:0,balanceMinor:10000},
    {allocatedMinor:5.5},{allocatedMinor:NaN}])
   expect(isVerifiedStaffCollectibleInvoice({...saved,...patch})).toBe(false);
 });
 it("never converts an object, array or malicious status into staff collection authority",()=>{
  const poison={toString(){throw new Error("UNTRUSTED_STATUS_COERCION");}};
  for(const status of [poison,{toString:()=> "ISSUED"},["ISSUED"],0,true,null]) {
   expect(()=>isVerifiedStaffCollectibleInvoice({...saved,status})).not.toThrow();
   expect(isVerifiedStaffCollectibleInvoice({...saved,status})).toBe(false);
  }
  expect(isVerifiedStaffCollectibleInvoice(null as unknown as typeof saved)).toBe(false);
 });
});
