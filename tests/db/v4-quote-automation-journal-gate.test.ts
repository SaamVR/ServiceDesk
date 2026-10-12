import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { verifiedQuoteCaptureJournalReady } from
  "../../src/server/workflows/owner-quote-automation-setting";

const ws="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function db(result: {error:unknown}|null={error:null}) {
  const calls:{table:string;column?:string;head?:boolean;filters:Record<string,unknown>;
    limit?:number}[]=[];
  const service={from(table:string){
    const c:{table:string;column?:string;head?:boolean;filters:Record<string,unknown>;
      limit?:number}={table,filters:{}};
    calls.push(c);
    const q={
      select(column:string,opts:{head?:boolean}){c.column=column;c.head=opts.head;return q;},
      eq(k:string,v:unknown){c.filters[k]=v;return q;},
      async limit(n:number){c.limit=n; if(result===null) throw Error("DB disconnected");return result;},
    };
    return q;
  }} as unknown as SupabaseClient;
  return {service,calls};
}

describe("migration 0063 owner quote journal enrollment guard",()=>{
  it("admits only an actual successful workspace-scoped HEAD check",async()=>{
    const h=db();
    expect(await verifiedQuoteCaptureJournalReady(h.service,ws)).toBe(true);
    expect(h.calls).toEqual([{
      table:"workflow_source_events",column:"id",head:true,
      filters:{workspace_id:ws},limit:1,
    }]);
  });
  it("cannot arm when journal is uninstalled or inaccessible",async()=>{
    const h=db({error:{code:"42P01",message:"relation does not exist"}});
    expect(await verifiedQuoteCaptureJournalReady(h.service,ws)).toBe(false);
  });
  it("returns unavailable rather than trusting an exception",async()=>{
    const h=db(null);
    expect(await verifiedQuoteCaptureJournalReady(h.service,ws)).toBe(false);
  });
  it("rejects malformed workspace IDs without database reads",async()=>{
    const h=db();
    expect(await verifiedQuoteCaptureJournalReady(h.service,"not-a-workspace")).toBe(false);
    expect(h.calls).toHaveLength(0);
  });
});
