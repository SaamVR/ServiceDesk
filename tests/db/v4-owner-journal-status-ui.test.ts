import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe,expect,it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readOwnerQuoteAutomationSetting,
  type OwnerQuoteAutomationDependencies } from
  "../../src/server/workflows/owner-quote-automation-setting";

const ws="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const owner="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
function evidence(installed:boolean) {
  const calls:{table:string;workspace?:unknown;head?:boolean}[]=[];
  const service={from(table:string){
    const rec:{table:string;workspace?:unknown;head?:boolean}={table};
    calls.push(rec);
    const q={
      select(_columns:string,opts?:{head?:boolean}){rec.head=opts?.head;return q;},
      eq(k:string,v:unknown){if(k==="workspace_id")rec.workspace=v;return q;},
      async maybeSingle(){return {data:null,error:null};},
      async limit(){return {data:null,error:installed?null:{code:"42P01"}};},
    };
    return q;
  }} as unknown as SupabaseClient;
  const deps={
    mode:()=>"SERVICE_ROLE",
    resolveActor:async()=>({ok:true,value:{
      actor:{role:"OWNER",workspaceId:ws,userId:owner},
      workspace:{id:ws,slug:"qa-workspace"},service,
    }}),
  } as unknown as OwnerQuoteAutomationDependencies;
  return {calls,deps};
}
describe("owner journal migration readiness UI contract",()=>{
  it.each([true,false])("reads journal status without changing the owner flag (%s)",async installed=>{
    const h=evidence(installed);
    expect(await readOwnerQuoteAutomationSetting("qa-workspace",h.deps))
      .toMatchObject({ok:true,value:{
        enabled:false,version:0,journalReady:installed,
      }});
    expect(h.calls).toHaveLength(2);
    expect(h.calls[1]).toMatchObject({
      table:"workflow_source_events",workspace:ws,head:true,
    });
  });
  it("renders a distinct migration warning and never offers enabled opt-in prematurely",()=>{
    const jsx=readFileSync(join(process.cwd(),
      "src/features/operations/OwnerQuoteAcceptedAutomationControl.tsx"),"utf8");
    expect(jsx).toContain("Journal 0063:");
    expect(jsx).toContain("!enabled && !journalReady");
    expect(jsx).toContain("enabled || (journalReady && missingSetup.length === 0)");
    expect(jsx).toContain("existing automation can");
    expect(jsx).toContain("setOwnerQuoteAutomationSetting(workspaceSlug, raw === \"true\", expectedVersion)");
  });
});
