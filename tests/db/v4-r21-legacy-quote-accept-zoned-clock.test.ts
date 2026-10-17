import {describe,expect,it,vi} from "vitest";
import type {QuoteSnapshot} from "../../src/domain/quote";
import {acceptQuoteByIdWithRepository} from "../../src/server/core/quotes";
const standard: QuoteSnapshot={
 id:"quote-r21",workspaceId:"ws-r21",requestId:"req-r21",
 version:3,status:"SENT",currency:"USD",serviceCode:"STANDARD",
 subtotalMinor:10000,taxMinor:0,totalMinor:10000,
 depositMinor:2500,balanceMinor:7500,durationMinutes:90,bufferMinutes:30,
 rateVersion:"owner-priced-contract-fixture",validUntil:"2026-10-20T12:00:00Z",lineItems:[],
};
function repo(saved: QuoteSnapshot){
 const updateQuoteStatus=vi.fn(async()=>undefined);
 return {updateQuoteStatus,repository:{
  nextQuoteId:()=> "unused",findById:async()=>saved,
  findLatestByRequest:async()=>saved,saveQuote:async()=>undefined,
  supersedeQuote:async()=>undefined,updateQuoteStatus,
 }};
}
describe("R21 legacy saved quote acceptance clock fail-closed",()=>{
 it("refuses nonexistent dates, invalid UTC offsets, unzoned strings and NaN time before any status change",async()=>{
  const badDates=[
   "2026-02-30T11:00:00Z","2026-04-31T12:00:00Z",
   "2025-02-29T12:00:00Z","2026-10-20T25:00:00Z",
   "2026-10-20T12:00:60Z","2026-10-20T12:00:00",
   "2026-10-20T12:00:00+14:01","2026-10-20T12:00:00+15:00",
   "not-an-instant",
  ];
  for(const stamp of badDates){
   for(const field of ["now","validUntil"] as const){
    const saved={...standard,validUntil:field==="validUntil"?stamp:standard.validUntil};
    const r=repo(saved);
    const out=await acceptQuoteByIdWithRepository(r.repository,standard.id,{
     expectedVersion:3,now:field==="now"?stamp:"2026-10-17T12:00:00Z",
    });
    expect(out,field+" "+stamp).toMatchObject({ok:false,code:"QUOTE_EXPIRED"});
    expect(r.updateQuoteStatus).not.toHaveBeenCalled();
   }
  }
 });
 it("refuses exact expiry, permits genuine leap and offset instants before expiry",async()=>{
   const eq=repo({...standard,validUntil:"2026-10-17T12:00:00Z"});
   expect(await acceptQuoteByIdWithRepository(eq.repository,standard.id,{
     now:"2026-10-17T12:00:00Z",expectedVersion:3
   })).toMatchObject({ok:false,code:"QUOTE_EXPIRED"});
   expect(eq.updateQuoteStatus).not.toHaveBeenCalled();
   for(const now of ["2026-10-17T17:00:00+06:00","2026-10-17T11:00:00.123456Z"]){
     const r=repo(standard);
     expect(await acceptQuoteByIdWithRepository(r.repository,standard.id,{
       now,expectedVersion:3
     })).toMatchObject({ok:true,value:{status:"ACCEPTED"}});
     expect(r.updateQuoteStatus).toHaveBeenCalledTimes(1);
   }
 });
});