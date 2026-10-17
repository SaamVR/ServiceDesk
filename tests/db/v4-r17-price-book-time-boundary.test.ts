import {describe, expect, it, vi} from "vitest";
import type {SupabaseClient} from "@supabase/supabase-js";
import {loadOperationalQuoteRateCard,parsePriceBookWindowInstant} from "../../src/server/core/operational-quote-rate-card";
import {defaultRateCard} from "../../src/domain/quote";
const workspace="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const branch="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const request="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const service="dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const card="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
function fixture(windows: Array<{starts_at: unknown;ends_at: unknown}>) {
 const reads:string[]=[];
 const tables:Record<string,Record<string,unknown>[]>={
  requests:[{id:request,workspace_id:workspace,branch_id:branch,service_id:service}],
  workspace_branches:[{id:branch,workspace_id:workspace,currency:"USD",active:true}],
  service_catalog:[{id:service,workspace_id:workspace,code:"STANDARD",active:true}],
  branch_price_books:windows.map(w=>({...w,workspace_id:workspace,branch_id:branch,rate_card_id:card,active:true})),
  rate_cards:[{id:card,workspace_id:workspace,version:"owner-confirmed-r17",currency:"USD",active:true,
   deposit_percent:25,valid_hours:48,buffer_minutes:20,
   rules:{...defaultRateCard,autoApprovalMaxTotalMinor:10000}}],
 };
 const db={from(table:string){reads.push(table);const filters:Array<[string,unknown]>=[];
  const rows=()=> (tables[table]??[]).filter(r=>filters.every(([k,v])=>r[k]===v));
  const chain={select(){return chain},eq(k:string,v:unknown){filters.push([k,v]);return chain},
   maybeSingle:async()=>({data:rows()[0]??null,error:null}),
   limit:async(n:number)=>({data:rows().slice(0,n),error:null})};return chain;
 }};
 return {db:db as unknown as SupabaseClient,reads};
}
describe("R17 exact saved rate-book effective window",()=>{
 it("accepts real zoned timestamps including PostgreSQL microseconds and leap days",()=>{
  const t=parsePriceBookWindowInstant("2024-02-29T12:30:00.123456+06:00");
  expect(t).toBe(Date.parse("2024-02-29T06:30:00.123Z"));
  expect(parsePriceBookWindowInstant(null)).toBeNull();
  expect(parsePriceBookWindowInstant("2026-10-17T00:00:00Z")).toBe(Date.parse("2026-10-17T00:00:00Z"));
 });
 it("rejects normalized impossible days, unzoned times, unsafe offsets and dates",()=>{
  for(const bad of ["2026-02-30T10:00:00Z","2025-02-29T00:00:00Z",
   "2026-04-31T00:00:00Z","2026-13-01T00:00:00Z",
   "2026-10-17T09:00:00","2026-10-17","2026-10-17T25:00:00Z",
   "2026-10-17T20:60:00Z","2026-10-17T00:00:60Z",
   "2026-10-17T10:00:00+15:00","2026-10-17T10:00:00+14:01",
   "2026-10-17T00:00:00.1234567Z",{},0])
   expect(parsePriceBookWindowInstant(bad)).toBeUndefined();
 });
 it("halts before reading a rate card if any saved window is ambiguous",async()=>{
  for(const invalid of ["2026-02-30T00:00:00Z","2026-10-17T00:00:00",
     "2026-10-17T00:00:00+15:00"]){
   const f=fixture([{starts_at:null,ends_at:null},{starts_at:invalid,ends_at:null}]);
   expect(await loadOperationalQuoteRateCard(f.db,workspace,request,new Date("2026-10-17T10:00:00Z")))
    .toMatchObject({ok:false,code:"QUOTE_RATE_BOOK_TIME_INVALID"});
   expect(f.reads).not.toContain("rate_cards");
  }
 });
 it("rejects reversed windows and invalid clocks without selecting a price",async()=>{
  const f=fixture([{starts_at:"2026-10-18T00:00:00Z",ends_at:"2026-10-17T00:00:00Z"}]);
  expect(await loadOperationalQuoteRateCard(f.db,workspace,request,new Date("2026-10-17T10:00:00Z")))
   .toMatchObject({ok:false,code:"QUOTE_RATE_BOOK_TIME_INVALID"});
  expect(await loadOperationalQuoteRateCard(f.db,workspace,request,new Date(NaN)))
   .toMatchObject({ok:false,code:"QUOTE_RATE_CLOCK_INVALID"});
 });
});
