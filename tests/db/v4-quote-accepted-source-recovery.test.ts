import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SupabaseRpcClient } from "../../src/server/core/payment-application-postgres";
import {
  runInternalQuoteSourceRecoveryBatch,
  type InternalSourceWorkerDependencies,
} from "../../src/server/workflows/customer-quote-source-recovery";

const workspace="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const quote="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const request="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const customer="dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const id="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const workerId="worker_qa_20261012";
const claimed={
  id, workspace_id:workspace, quote_id:quote,
  event_type:"QUOTE_ACCEPTED", state:"PROCESSING",
  locked_by:workerId, locked_until:new Date(Date.now()+60_000).toISOString(), attempts:1,
};

function harness(options:{
  entries?:unknown[];
  quoteStatus?:string;
  foreignRequest?:boolean;
  bridgeFails?:boolean;
  optedOut?:boolean;
  badCompletion?:boolean;
  deadLetter?:boolean;
  throwBridge?:boolean;
  claimError?:boolean;
}={}){
  const rows={
    quotes:[{id:quote,workspace_id:workspace,request_id:request,status:options.quoteStatus??"ACCEPTED"}],
    requests:[{id:request,workspace_id:options.foreignRequest?"other-tenant":workspace,customer_id:customer}],
  };
  const service={from(table:string){
    const filters:Record<string,unknown>={};
    const q={
      select(){return q;},
      eq(k:string,v:unknown){filters[k]=v;return q;},
      async maybeSingle(){
        const data=(rows[table as keyof typeof rows]??[]).find(row=>
          Object.entries(filters).every(([k,v])=>(row as Record<string,unknown>)[k]===v));
        return {data:data??null,error:null};
      },
    };
    return q;
  }} as unknown as SupabaseClient;
  const events:Array<{fn:string,args:Record<string,unknown>}>=[];
  const rpc={rpc:vi.fn(async(fn:string,args:Record<string,unknown>)=>{
    events.push({fn,args});
    if(fn==="servicedesk_claim_quote_source_events")
      return options.claimError?{data:null,error:{code:"DB_FAILURE"}}
        :{data:options.entries??[claimed],error:null};
    if(fn==="servicedesk_complete_quote_source_event")
      return options.badCompletion?{data:{ok:false},error:null}
        :{data:{ok:true,state:args.p_outcome === "FAILED"
          ? (options.deadLetter ? "DEAD_LETTER" : "RETRY_PENDING")
          : args.p_outcome},error:null};
    return {data:null,error:{code:"UNKNOWN_RPC"}};
  })} as unknown as SupabaseRpcClient;
  const bridge=vi.fn(async() => {
    if(options.throwBridge)throw Error("simulated crash");
    if(options.optedOut)return {ok:false as const,code:"QUOTE_AUTOMATION_WORKSPACE_NOT_OPTED_IN",message:"off"};
    if(options.bridgeFails)return {ok:false as const,code:"QUOTE_AUTOMATION_RULES_UNAVAILABLE",message:"fail"};
    return {ok:true as const,value:{state:"PERSISTED_INTERNAL_QUOTE_ACCEPTED_AUTOMATION",
      newlyRecordedRuleExecutions:1,reusedRuleExecutions:0,completedAttentionActions:1,
      approvalRequired:1,providerMessagesSent:0 as const}};
  });
  const deps={enabled:()=>true,bridge} as unknown as InternalSourceWorkerDependencies;
  return {service,rpc,bridge,deps,events};
}
const run=(h:ReturnType<typeof harness>,enabled=true)=>
 runInternalQuoteSourceRecoveryBatch({
  service:h.service,rpc:h.rpc,workerId,maxBatch:4,
 }, {...h.deps,enabled:()=>enabled});

describe("V4 trusted internal quote source recovery worker",()=>{
  it("never claims events while the server kill switch is disabled",async()=>{
    const h=harness();
    expect(await run(h,false)).toMatchObject({state:"NO_DEPLOYMENT_OPT_IN",claimed:0});
    expect(h.events).toHaveLength(0);
    expect(h.bridge).not.toHaveBeenCalled();
  });
  it("re-reads saved scoped accepted quote and customer before internal bridge",async()=>{
    const h=harness();
    expect(await run(h)).toMatchObject({state:"BATCH_PROCESSED",claimed:1,
      completed:1,retryPending:0,providerMessagesSent:0});
    expect(h.bridge).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId:workspace,customerId:customer,quoteId:quote,
    }));
    expect(h.events).toHaveLength(2);
    expect(h.events[0]).toEqual({fn:"servicedesk_claim_quote_source_events",
      args:{p_worker:workerId,p_limit:4}});
    expect(h.events[1]).toEqual({fn:"servicedesk_complete_quote_source_event",
      args:{p_id:id,p_worker:workerId,p_outcome:"SUCCEEDED",p_error_code:null}});
  });
  it("marks a later owner opt-out SKIPPED, never auto-sends or retries",async()=>{
    const h=harness({optedOut:true});
    expect(await run(h)).toMatchObject({claimed:1,skipped:1,completed:0,retryPending:0});
    expect(h.events[1].args.p_outcome).toBe("SKIPPED");
    expect(h.events[1].args.p_error_code).toBeNull();
  });
  it("retries transient rule failure with sanitized machine-only error code",async()=>{
    const h=harness({bridgeFails:true});
    expect(await run(h)).toMatchObject({retryPending:1,completed:0});
    expect(h.events[1].args).toMatchObject({p_outcome:"FAILED",
      p_error_code:"QUOTE_AUTOMATION_RULES_UNAVAILABLE"});
  });
  it("reports final-attempt dead letters as terminal failures, not retry successes",async()=>{
    const h=harness({bridgeFails:true,deadLetter:true});
    expect(await run(h)).toMatchObject({claimed:1,deadLetter:1,retryPending:0,completed:0,
      providerMessagesSent:0});
  });
  it("denies unaccepted or foreign-scoped customer facts before invoking rules",async()=>{
    for(const options of [{quoteStatus:"SENT"},{foreignRequest:true}]){
      const h=harness(options);
      expect(await run(h)).toMatchObject({claimed:1,retryPending:1,completed:0});
      expect(h.bridge).not.toHaveBeenCalled();
      expect(h.events[1].args.p_outcome).toBe("FAILED");
    }
  });
  it("is honest about claim, transient crash and completion failure",async()=>{
    const claim=harness({claimError:true});
    expect(await run(claim)).toMatchObject({state:"CLAIM_UNVERIFIED",claimed:0});
    expect(claim.bridge).not.toHaveBeenCalled();
    const crash=harness({throwBridge:true});
    expect(await run(crash)).toMatchObject({claimed:1,retryPending:1});
    expect(crash.events[1].args.p_error_code).toBe("QUOTE_SOURCE_REPLAY_EXCEPTION");
    const noAck=harness({badCompletion:true});
    expect(await run(noAck)).toMatchObject({claimed:1,completionNotVerified:1,completed:0});
  });
  it("cannot execute an event leased by another worker or after its lease expires",async()=>{
    const cases=[
      {...claimed,locked_by:"foreign_worker_99"},
      {...claimed,locked_until:"2020-01-01T00:00:00Z"},
      {...claimed,locked_until:"invalid"},
      {...claimed,attempts:9},
      {...claimed,attempts:0},
    ];
    for(const row of cases){
      const h=harness({entries:[row]});
      expect(await run(h)).toMatchObject({claimed:0,completed:0,completionNotVerified:1});
      expect(h.bridge).not.toHaveBeenCalled();
      expect(h.events.map(e=>e.fn)).toEqual(["servicedesk_claim_quote_source_events"]);
    }
  });
  it("rejects non-lease/foreign/malformed results rather than fabricating completion",async()=>{
    const h=harness({entries:[{...claimed,id:"not-a-uuid"},{...claimed,workspace_id:"different"},claimed,claimed]});
    const result=await run(h);
    expect(result).toMatchObject({claimed:1,completed:1,completionNotVerified:3});
    expect(h.bridge).toHaveBeenCalledTimes(1);
  });
});

describe("V4 SQL transactional internal source migration contract",()=>{
  const migration=readFileSync(join(process.cwd(),
    "supabase/migrations/0063_v4_quote_accept_internal_source_journal.sql"),"utf8");
  it("records only accepted quotes for opted-in workspace in same transaction",()=>{
    expect(migration).toContain("after update of status on public.quotes");
    expect(migration).toContain("new.status::text = 'ACCEPTED'");
    expect(migration).toContain("feature_key = 'AUTO_INTERNAL_QUOTE_ACCEPTED'");
    expect(migration).toContain("f.workspace_id = new.workspace_id");
    expect(migration).toContain("on conflict (workspace_id,event_type,quote_id) do nothing");
    expect(migration).toContain("unique (workspace_id, event_type, quote_id)");
    expect(migration).not.toMatch(/insert into public\.outbox_events/i);
  });
  it("limits lease concurrency, retries and stranded last attempts",()=>{
    expect(migration).toContain("for update skip locked");
    expect(migration).toContain("locked_until < now()");
    expect(migration).toContain("attempts < 8");
    expect(migration).toContain("LEASE_EXPIRED_MAX_ATTEMPTS");
    expect(migration).toContain("DEAD_LETTER");
    expect(migration).toContain("RETRY_PENDING");
    expect(migration).toContain("locked_by=p_worker");
  });
  it("restricts service-only RPC execution and denies browser table operations",()=>{
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all on public.workflow_source_events from public, anon, authenticated");
    expect(migration).toContain("to service_role;");
    expect(migration).toContain("revoke all on function public.servicedesk_claim_quote_source_events");
    expect(migration).toContain("revoke all on function public.servicedesk_complete_quote_source_event");
    expect(migration).toContain("security definer set search_path = ''");
    expect(migration).toContain("security invoker set search_path = ''");
  });
});
