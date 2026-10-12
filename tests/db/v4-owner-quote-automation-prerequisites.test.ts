import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyOwnerQuoteAutomationPrerequisites } from "../../src/server/workflows/owner-quote-automation-prerequisites";

const ws = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const branch = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const rule = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const serviceId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

type RecordRow = Record<string, unknown>;
function fixture(overrides: Partial<Record<string, RecordRow[]>> = {}, failureTable?:string) {
  const queried: {table:string;filter:Record<string,unknown>}[] = [];
  const tables: Record<string,RecordRow[]> = {
    service_catalog: [{id:serviceId,workspace_id:ws,active:true}],
    workspace_branches: [{id:branch,workspace_id:ws,active:true,currency:"USD"}],
    branch_price_books: [{branch_id:branch,workspace_id:ws,active:true}],
    workflow_rules: [{id:rule,workspace_id:ws,branch_id:branch,status:"ACTIVE",published_version_number:2}],
    workflow_rule_versions: [{
      workspace_id:ws,rule_id:rule,branch_id:branch,version_number:2,
      state:"PUBLISHED",event_type:"QUOTE_ACCEPTED",actions:[{type:"CREATE_ATTENTION"}],
    }],
    ...overrides,
  };
  const service = {
    from(table:string) {
      const filter:Record<string,unknown> = {};
      let maximum=Number.POSITIVE_INFINITY;
      const read=() => {
        queried.push({table,filter:{...filter}});
        if(table === failureTable) return {data:null,error:{code:"NETWORK"}};
        const rows=(tables[table]??[]).filter(row=>Object.entries(filter)
          .every(([key,value])=>row[key]===value)).slice(0,maximum);
        return {data:rows,error:null};
      };
      const q={
        select(_selection:string) {return q;},
        eq(k:string,v:unknown) {filter[k]=v;return q;},
        limit(n:number) {
          maximum=n;return {then(resolve:(v:ReturnType<typeof read>)=>void) {resolve(read());}};
        },
        async maybeSingle() {
          const result=read();
          if(result.error) return result;
          return {data:result.data?.[0]??null,error:result.data && result.data.length>1
            ? {code:"MULTIPLE"} : null};
        },
      };
      return q;
    },
  } as unknown as SupabaseClient;
  return {service,queried};
}

describe("real persisted prerequisites for owner quote automation opt-in", () => {
  it("allows only saved priced USD branch with exactly current published internal rule",async()=>{
    const f=fixture();
    expect(await verifyOwnerQuoteAutomationPrerequisites(f.service,ws))
      .toEqual({ok:true,branchId:branch,ruleId:rule});
    expect(f.queried).toHaveLength(5);
    for(const call of f.queried) expect(call.filter.workspace_id).toBe(ws);
  });

  it("denies empty service catalog and never calls a workflow provider",async()=>{
    const f=fixture({service_catalog:[]});
    expect(await verifyOwnerQuoteAutomationPrerequisites(f.service,ws))
      .toMatchObject({ok:false,code:"AUTO_QUOTE_SERVICE_MISSING"});
    expect(f.queried.some(x=>x.table==="workflow_executions")).toBe(false);
  });

  it("denies no active pricebook, non-USD branch and foreign-workspace price records",async()=>{
    for(const changes of [
      {branch_price_books:[]},
      {workspace_branches:[{id:branch,workspace_id:ws,active:true,currency:"GBP"}]},
      {branch_price_books:[{workspace_id:other,branch_id:branch,active:true}]},
    ]) {
      const f=fixture(changes);
      expect(await verifyOwnerQuoteAutomationPrerequisites(f.service,ws))
        .toMatchObject({ok:false,code:"AUTO_QUOTE_PRICING_MISSING"});
    }
  });

  it("requires published QUOTE_ACCEPTED CREATE_ATTENTION in same eligible branch",async()=>{
    for(const changes of [
      {workflow_rules:[]},
      {workflow_rules:[{id:rule,workspace_id:ws,branch_id:other,status:"ACTIVE",published_version_number:2}]},
      {workflow_rule_versions:[]},
      {workflow_rule_versions:[{
        workspace_id:ws,rule_id:rule,branch_id:branch,version_number:2,
        state:"PUBLISHED",event_type:"REQUEST_CREATED",actions:[{type:"CREATE_ATTENTION"}],
      }]},
      {workflow_rule_versions:[{
        workspace_id:ws,rule_id:rule,branch_id:branch,version_number:2,
        state:"PUBLISHED",event_type:"QUOTE_ACCEPTED",actions:[{type:"SEND_EMAIL_TEMPLATE"}],
      }]},
    ]) {
      const f=fixture(changes);
      expect(await verifyOwnerQuoteAutomationPrerequisites(f.service,ws))
        .toMatchObject({ok:false,code:"AUTO_QUOTE_INTERNAL_RULE_MISSING"});
    }
  });

  it("fails closed on unknown database snapshots and malformed workspace IDs",async()=>{
    for(const name of ["service_catalog","workspace_branches","branch_price_books","workflow_rules","workflow_rule_versions"]) {
      const f=fixture({},name);
      expect(await verifyOwnerQuoteAutomationPrerequisites(f.service,ws))
        .toMatchObject({ok:false,code:"AUTO_QUOTE_PREREQUISITES_UNVERIFIED"});
    }
    const f=fixture();
    expect(await verifyOwnerQuoteAutomationPrerequisites(f.service,"not-a-uuid"))
      .toMatchObject({ok:false,code:"AUTO_QUOTE_PREREQUISITES_UNVERIFIED"});
    expect(f.queried).toHaveLength(0);
  });

  it("does not infer proof from truncated 200+ branches/rules",async()=>{
    const many=Array.from({length:205},(_,index)=>({
      id:`20000000-0000-4000-8000-${String(index).padStart(12,"0")}`,
      workspace_id:ws,active:true,currency:"USD",
    }));
    const f=fixture({workspace_branches:many});
    expect(await verifyOwnerQuoteAutomationPrerequisites(f.service,ws))
      .toMatchObject({ok:false,code:"AUTO_QUOTE_PREREQUISITES_UNVERIFIED"});
  });
});
