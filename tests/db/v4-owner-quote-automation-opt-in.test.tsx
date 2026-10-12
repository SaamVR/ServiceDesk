import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  QUOTE_ACCEPTED_INTERNAL_FEATURE_KEY,
  readOwnerQuoteAutomationSetting,
  setOwnerQuoteAutomationSetting,
  workspaceQuoteAutomationEnabled,
  type OwnerQuoteAutomationDependencies,
} from "../../src/server/workflows/owner-quote-automation-setting";

const ws = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const owner = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const key = QUOTE_ACCEPTED_INTERNAL_FEATURE_KEY;

function harness(options: {
  enabled?: boolean;
  version?: number;
  absent?: boolean;
  role?: string;
  actorWorkspace?: string;
  mode?: "SERVICE_ROLE" | "QA_SESSION_RLS";
  readError?: boolean;
} = {}) {
  let row: {enabled:boolean; version:number; updated_by:string | null} | undefined =
    options.absent ? undefined :
      { enabled: options.enabled ?? false, version: options.version ?? 1, updated_by: owner };
  const operations: Array<{kind:string; table:string; filters:Record<string,unknown>}> = [];
  const service = {
    from(table: string) {
      const filters: Record<string,unknown> = {};
      let kind = "read";
      let payload: Record<string,unknown> = {};
      const q = {
        select() { return q; },
        eq(k:string,v:unknown) { filters[k]=v; return q; },
        insert(v: Record<string,unknown>) { kind="insert"; payload=v; return q; },
        update(v: Record<string,unknown>) { kind="update"; payload=v; return q; },
        async maybeSingle() {
          operations.push({kind,table,filters:{...filters}});
          if (options.readError && kind==="read") return {data:null,error:{code:"NETWORK"}};
          if (table!=="workspace_feature_flags" ||
              filters.workspace_id !== ws || filters.feature_key !== key) {
            return {data:null,error:null};
          }
          if (kind==="insert") {
            if (row) return {data:null,error:{code:"23505"}};
            row={enabled:payload.enabled as boolean,version:payload.version as number,
              updated_by:payload.updated_by as string};
            return {data:{...row},error:null};
          }
          if (kind==="update") {
            if (!row || filters.version !== row.version) return {data:null,error:null};
            row={enabled:payload.enabled as boolean,version:payload.version as number,
              updated_by:payload.updated_by as string};
            return {data:{...row},error:null};
          }
          return {data:row?{...row}:null,error:null};
        },
      };
      return q;
    },
  } as unknown as SupabaseClient;
  const resolveActor = vi.fn(async () => ({ok:true as const,value:{
    actor:{role:options.role??"OWNER",workspaceId:options.actorWorkspace??ws,userId:owner},
    workspace:{slug:"qa-workspace",id:ws},
    service,
  }}));
  const deps = {
    mode: () => options.mode ?? "SERVICE_ROLE",
    resolveActor,
  } as unknown as OwnerQuoteAutomationDependencies;
  return {service,resolveActor,deps,operations,get row(){return row;}};
}

describe("V4 owner-only per-tenant automated quote follow-up", () => {
  it("is off when no persisted workspace flag exists",async()=>{
    const h=harness({absent:true});
    expect(await readOwnerQuoteAutomationSetting("qa-workspace",h.deps))
      .toMatchObject({ok:true,value:{enabled:false,version:0}});
    expect(await workspaceQuoteAutomationEnabled(h.service,ws)).toBe(false);
  });

  it("requires verified OWNER, same workspace, and protected server mode before any write",async()=>{
    for(const opt of [
      {role:"DISPATCHER"}, {actorWorkspace:"cccccccc-cccc-4ccc-8ccc-cccccccccccc"},
      {mode:"QA_SESSION_RLS" as const},
    ]) {
      const h=harness(opt);
      const res=await setOwnerQuoteAutomationSetting("qa-workspace",true,1,h.deps);
      expect(res.ok).toBe(false);
      expect(h.operations.filter(v=>v.kind!=="read")).toHaveLength(0);
    }
  });

  it("optimistically inserts the first tenant flag and verifies owner-scoped readback",async()=>{
    const h=harness({absent:true});
    const result=await setOwnerQuoteAutomationSetting("qa-workspace",true,0,h.deps);
    expect(result).toMatchObject({ok:true,value:{enabled:true,version:1}});
    expect(h.row).toEqual({enabled:true,version:1,updated_by:owner});
    expect(await workspaceQuoteAutomationEnabled(h.service,ws)).toBe(true);
    expect(h.operations.filter(x=>x.kind==="insert")).toHaveLength(1);
    for(const entry of h.operations) {
      if(entry.filters.workspace_id) expect(entry.filters.workspace_id).toBe(ws);
      if(entry.filters.feature_key) expect(entry.filters.feature_key).toBe(key);
    }
  });

  it("rejects stale or invalid version rather than overwriting a concurrent owner change",async()=>{
    const h=harness({enabled:false,version:5});
    expect(await setOwnerQuoteAutomationSetting("qa-workspace",true,4,h.deps))
      .toMatchObject({ok:false,code:"AUTO_QUOTE_VERSION_CONFLICT"});
    expect(await setOwnerQuoteAutomationSetting("qa-workspace",true,Number.NaN,h.deps))
      .toMatchObject({ok:false,code:"AUTO_QUOTE_INVALID_INPUT"});
    expect(h.row?.enabled).toBe(false);
    expect(h.operations.filter(v=>v.kind==="update")).toHaveLength(0);
  });

  it("lets only that owner disable its own persisted switch with version CAS",async()=>{
    const h=harness({enabled:true,version:3});
    expect(await setOwnerQuoteAutomationSetting("qa-workspace",false,3,h.deps))
      .toMatchObject({ok:true,value:{enabled:false,version:4}});
    expect(h.operations.filter(v=>v.kind==="update")[0]?.filters.version).toBe(3);
    expect(await workspaceQuoteAutomationEnabled(h.service,ws)).toBe(false);
  });

  it("denies when tenant flag cannot be verified or workspace is foreign",async()=>{
    const h=harness({enabled:true,readError:true});
    expect(await workspaceQuoteAutomationEnabled(h.service,ws)).toBe(false);
    expect(await workspaceQuoteAutomationEnabled(h.service,"not-a-uuid")).toBe(false);
    expect(await workspaceQuoteAutomationEnabled(h.service,"cccccccc-cccc-4ccc-8ccc-cccccccccccc")).toBe(false);
    expect(await readOwnerQuoteAutomationSetting("qa-workspace",h.deps))
      .toMatchObject({ok:false,code:"AUTO_QUOTE_FLAG_READ_UNAVAILABLE"});
  });

  it("UI renders only for owners and server action cannot accept client-provided actor/tenant IDs",()=>{
    const read=(p:string)=>readFileSync(join(process.cwd(),p),"utf8");
    const route=read("src/features/operations/OperationalProductRoute.tsx");
    const panel=read("src/features/operations/OwnerQuoteAcceptedAutomationControl.tsx");
    const bridge=read("src/server/workflows/customer-quote-accepted-bridge.ts");
    const customer=read("src/features/operations/customer-product-runtime.ts");
    expect(route.match(/data.actor.role === "OWNER" \? <OwnerQuoteAcceptedAutomationControl/g)?.length).toBe(2);
    expect(panel).toContain("setOwnerQuoteAutomationSetting(workspaceSlug, raw === \"true\", expectedVersion)");
    expect(panel).toContain("Saving workspace choice…");
    expect(panel).not.toContain("name=\"workspaceId\"");
    expect(panel).not.toContain("name=\"actorUserId\"");
    expect(bridge).toContain("workspaceQuoteAutomationEnabled(service, workspaceId)");
    expect(customer).toContain('process.env.SERVICEDESK_AUTO_INTERNAL_QUOTE_ACCEPTED === "true"');
    expect(customer).toContain("QUOTE_AUTOMATION_WORKSPACE_NOT_OPTED_IN");
  });
});
