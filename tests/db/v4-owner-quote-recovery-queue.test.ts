import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  readOwnerQuoteRecoverySummary,
  type OwnerQuoteRecoverySummaryDependencies,
  type QuoteQueueState,
} from "../../src/server/workflows/owner-quote-recovery-queue";

const workspaceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ownerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const all: QuoteQueueState[] = [
  "PENDING", "PROCESSING", "RETRY_PENDING", "SUCCEEDED", "SKIPPED", "DEAD_LETTER",
];

function ownerHarness(options: { role?:string; slug?:string; actorWorkspace?:string;
  backend?: "SERVICE_ROLE" | "QA_SESSION_RLS"; count?:number|null }={}) {
  const calls:Array<{workspaceId:string;state:QuoteQueueState}> = [];
  const service = { from:vi.fn() } as unknown as SupabaseClient;
  const resolveActor = vi.fn(async()=>({ok:true as const,value:{
    actor:{role:options.role??"OWNER",workspaceId:options.actorWorkspace??workspaceId,userId:ownerId},
    workspace:{id:workspaceId,slug:options.slug??"qa-workspace"},service,
  }}));
  const count = vi.fn(async(_service:unknown, id:string, state:QuoteQueueState)=>{
    calls.push({workspaceId:id,state});
    return options.count===undefined ? 0 : options.count;
  });
  const health=vi.fn(async()=>({dueNow:0,expiredLeases:0}));
  const deps={
    mode:()=>options.backend??"SERVICE_ROLE", resolveActor, count,health,
    now:()=> "2026-10-13T00:00:00.000Z",
  } as unknown as OwnerQuoteRecoverySummaryDependencies;
  return {deps,service,resolveActor,count,health,calls};
}

describe("V4 private owner source recovery queue counts",()=>{
  it("shows saved zeroes only after all six state queries succeed",async()=>{
    const h=ownerHarness();
    expect(await readOwnerQuoteRecoverySummary("qa-workspace",h.deps)).toEqual({
      state:"AVAILABLE",
      health:{dueNow:0,expiredLeases:0},
      counts:{ PENDING:0,PROCESSING:0,RETRY_PENDING:0,
        SUCCEEDED:0,SKIPPED:0,DEAD_LETTER:0 },
    });
    expect(h.calls.map(c=>c.state)).toEqual(all);
    expect(h.calls.every(c=>c.workspaceId===workspaceId)).toBe(true);
    expect(h.health).toHaveBeenCalledWith(h.service,workspaceId,"2026-10-13T00:00:00.000Z");
  });
  it("denies staff, cross-workspace claims and mismatched workspace slugs",async()=>{
    for(const opt of [
      {role:"DISPATCHER"}, {actorWorkspace:ownerId},{slug:"foreign"},
    ]){
      const h=ownerHarness(opt);
      expect(await readOwnerQuoteRecoverySummary("qa-workspace",h.deps))
        .toEqual({state:"OWNER_REQUIRED"});
      expect(h.count).not.toHaveBeenCalled();
    }
  });
  it("does not query without the protected backend mode",async()=>{
    const h=ownerHarness({backend:"QA_SESSION_RLS"});
    expect(await readOwnerQuoteRecoverySummary("qa-workspace",h.deps))
      .toEqual({state:"UNAVAILABLE"});
    expect(h.resolveActor).not.toHaveBeenCalled();
  });
  it("treats missing migration or failed first query as UNAVAILABLE, not zero",async()=>{
    const h=ownerHarness({count:null});
    expect(await readOwnerQuoteRecoverySummary("qa-workspace",h.deps))
      .toEqual({state:"UNAVAILABLE"});
    expect(h.calls).toEqual([{workspaceId,state:"PENDING"}]);
  });
  it("does not return incomplete totals when a later state fails",async()=>{
    const h=ownerHarness();
    h.count.mockImplementation(async(_service, _id, state)=>
      state==="DEAD_LETTER" ? null : 2);
    expect(await readOwnerQuoteRecoverySummary("qa-workspace",h.deps))
      .toEqual({state:"UNAVAILABLE"});
    expect(h.count).toHaveBeenCalledTimes(6);
  });
  it("does not manufacture due or expired health when protected reads fail",async()=>{
    const h=ownerHarness();
    h.health.mockResolvedValueOnce(null as never);
    expect(await readOwnerQuoteRecoverySummary("qa-workspace",h.deps)).toEqual({state:"UNAVAILABLE"});
    h.health.mockResolvedValueOnce({dueNow:3,expiredLeases:-1});
    expect(await readOwnerQuoteRecoverySummary("qa-workspace",h.deps)).toEqual({state:"UNAVAILABLE"});
  });
  it("reports persisted due and expired totals as counts only",async()=>{
    const h=ownerHarness();
    h.health.mockResolvedValueOnce({dueNow:4,expiredLeases:2});
    expect(await readOwnerQuoteRecoverySummary("qa-workspace",h.deps))
      .toMatchObject({state:"AVAILABLE",health:{dueNow:4,expiredLeases:2}});
  });
  it("keeps data private with a scoped and count-only Supabase query",async()=>{
    const calls:Array<{table:string;select:string;head?:boolean;count?:string;
      filters:Record<string,unknown>}>=[];
    const service={
      from(table:string){
        const call={table,select:"",head:false,count:"",
          filters:{} as Record<string,unknown>};
        calls.push(call);
        const q={
          select(column:string,options:{head?:boolean;count?:string}){
            call.select=column;call.head=options.head??false;
            call.count=options.count??"";return q;
          },
          eq(k:string,v:unknown){call.filters[k]=v;return q;},
          in(k:string,v:unknown){call.filters[k]=v;return q;},
          lte(k:string,v:unknown){call.filters[k]=v;return q;},
          lt(k:string,v:unknown){call.filters[k]=v;return q;},
          then(resolve:(o:{count:number;error:null})=>unknown){
            resolve({count:3,error:null});
          },
        };
        return q;
      },
    } as unknown as SupabaseClient;
    const deps={
      mode:()=>"SERVICE_ROLE",
      resolveActor:async()=>({ok:true,value:{
        actor:{role:"OWNER",workspaceId,userId:ownerId},
        workspace:{slug:"qa-workspace",id:workspaceId},service,
      }}),
    } as unknown as OwnerQuoteRecoverySummaryDependencies;
    const result=await readOwnerQuoteRecoverySummary("qa-workspace",deps);
    expect(result).toMatchObject({state:"AVAILABLE",counts:{DEAD_LETTER:3}});
    expect(calls).toHaveLength(8);
    for(const call of calls){
      expect(call.table).toBe("workflow_source_events");
      expect(call.select).toBe("id");
      expect(call.count).toBe("exact");
      expect(call.head).toBe(true);
      expect(call.filters.workspace_id).toBe(workspaceId);
      if(typeof call.filters.state==="string") expect(all).toContain(call.filters.state);
    }
    expect(calls[6].filters.state).toEqual(["PENDING","RETRY_PENDING"]);
    expect(calls[6].filters.next_attempt_at).toEqual(expect.any(String));
    expect(calls[7].filters.state).toBe("PROCESSING");
    expect(calls[7].filters.locked_until).toEqual(expect.any(String));
  });
});
