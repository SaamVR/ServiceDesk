import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { parseOwnerCleaningPricingSetup } from "../../src/server/core/owner-cleaning-pricing-input";
import {
  setupAuthorizedCleaningPricing, type PricingSetupDependencies,
} from "../../src/server/core/owner-cleaning-pricing-setup";

const workspaceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const branchId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const rateCardId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const priceBookId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const setupId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function form() {
  const data = new FormData();
  const values: Record<string,string> = {
    setupId, branchId, currency: "USD",
    nameStandard: "Standard cleaning",
    nameDeep: "Deep cleaning",
    nameMoveOut: "Move-out cleaning",
    depositPercent: "25", validHours: "48",
    bufferMinutes: "30", autoApprovalMax: "550.50",
  };
  for (const prefix of ["standard", "deep", "moveOut"]) {
    Object.assign(values, {
      [prefix + "Base"]: "125.25", [prefix + "BaseMinutes"]: "90",
      [prefix + "Bedroom"]: "20.00", [prefix + "BedroomMinutes"]: "15",
      [prefix + "Bathroom"]: "15.50", [prefix + "BathroomMinutes"]: "10",
    });
    if (prefix === "moveOut") Object.assign(values, {
      moveOutOven: "35.50", moveOutOvenMinutes: "25",
    });
  }
  for (const [name,value] of Object.entries(values)) data.set(name,value);
  return data;
}
function harness(options: { role?: string; mode?: "SERVICE_ROLE"|"QA_SESSION_RLS"; missingProof?: boolean; disabledBranch?: boolean; readbackThrows?: boolean; rpcThrows?: boolean }={}) {
  const parsed = parseOwnerCleaningPricingSetup(form());
  if (!parsed.ok) throw new Error(parsed.message);
  const savedRules = parsed.value.rules;
  const rows: Record<string,Record<string,unknown>[]> = {
    service_catalog: ["STANDARD","DEEP","MOVE_OUT"].map(code => ({
      workspace_id:workspaceId,code,active:true,
      name: code === "STANDARD" ? "Standard cleaning" :
        code === "DEEP" ? "Deep cleaning" : "Move-out cleaning",
    })),
    rate_cards: options.missingProof ? [] : [{
      id:rateCardId, workspace_id:workspaceId,version:"owner-cleaning-"+setupId,
      active:true,currency:"USD",rules:savedRules,
    }],
    branch_price_books: [{
      id:priceBookId,workspace_id:workspaceId,branch_id:branchId,
      rate_card_id:rateCardId,active:true,
    }],
  };
  const seen: string[]=[];
  const service = {
    from(table:string) {
      seen.push(table);
      const filters: Array<[string,unknown]>=[];
      let codes: string[] | undefined;
      const query = {
        select() { return query; },
        eq(key:string,value:unknown) { filters.push([key,value]); return query; },
        in(_key:string,items:string[]) { codes=items;return query; },
        async maybeSingle() {
          if (options.readbackThrows && table === "rate_cards") {
            throw new Error("transient-readback-connection");
          }
          const data=(rows[table]??[]).filter(r=> filters.every(([k,v])=>r[k]===v))[0]??null;
          return {data,error:null};
        },
        then(resolve:(result:{data:Record<string,unknown>[],error:null})=>void) {
          const data=(rows[table]??[]).filter(r=>filters.every(([k,v])=>r[k]===v)
            && (!codes || codes.includes(String(r.code))));
          return Promise.resolve(resolve({data,error:null}));
        },
      };
      return query;
    },
  };
  const rpc = {rpc:vi.fn(async (_name:string, payload:{p_input:Record<string,unknown>})=>{
    expect(payload.p_input.workspaceId).toBe(workspaceId);
    expect(payload.p_input.actorUserId).toBe("owner-qa");
    expect(payload.p_input.setupId).toBe(setupId);
    if (options.rpcThrows) throw new Error("unknown-committed-rpc-result");
    return {data:{
      ok:true,duplicate:false,rateCardId,priceBookId,branchId,
      rateVersion:"owner-cleaning-"+setupId,
    },error:null};
  })};
  const resolveActor=vi.fn(async()=>({ok:true as const,value:{
    actor:{workspaceId,userId:"owner-qa",role:options.role??"OWNER"},
    workspace:{id:workspaceId,slug:"fictional-qa",currency:"USD"},
    branchScope:{mode:"ALL",branches:options.disabledBranch?[]:[
      {id:branchId,currency:"USD",name:"Main",code:"MAIN"}]},
    service,rpc,
  }}));
  return {resolveActor,rpc,seen, deps:{
    resolveActor,mode:()=>options.mode??"SERVICE_ROLE",
  } as unknown as PricingSetupDependencies};
}

describe("V4 first-run owner cleaning price configuration",()=>{
  it("parses real owner-entered USD major units without float rounding or preset prices",()=>{
    const result=parseOwnerCleaningPricingSetup(form());
    expect(result).toMatchObject({ok:true,value:{
      rules:{standard:{baseMinor:12525,bedroomMinor:2000,bathroomMinor:1550},
      moveOut:{ovenMinor:3550}},depositPercent:25,
    }});
    const absent=form();absent.delete("standardBase");
    expect(parseOwnerCleaningPricingSetup(absent)).toMatchObject({ok:false});
    const exponential=form();exponential.set("standardBase","1e4");
    expect(parseOwnerCleaningPricingSetup(exponential)).toMatchObject({ok:false});
    const fraction=form();fraction.set("standardBase","8.999");
    expect(parseOwnerCleaningPricingSetup(fraction)).toMatchObject({ok:false});
    const negative=form();negative.set("moveOutOven","-5");
    expect(parseOwnerCleaningPricingSetup(negative)).toMatchObject({ok:false});
  });

  it("requires a real service role, authenticated owner and authorized branch BEFORE RPC",async()=>{
    for (const cfg of [
      {mode:"QA_SESSION_RLS" as const}, {role:"DISPATCHER"},
      {disabledBranch:true},
    ]) {
      const h=harness(cfg);
      const value=await setupAuthorizedCleaningPricing("fictional-qa",form(),h.deps);
      expect(value.ok).toBe(false);
      expect(h.rpc.rpc).not.toHaveBeenCalled();
    }
  });

  it("executes transactional owner RPC and verifies same-workspace saved catalog/rate/book readback",async()=>{
    const h=harness();
    const value=await setupAuthorizedCleaningPricing("fictional-qa",form(),h.deps);
    expect(value).toMatchObject({ok:true,value:{
      state:"PERSISTED_OWNER_PRICING_VERIFIED",
      rateCardId,priceBookId,branchId,externalCustomerMessagesSent:0,
    }});
    expect(h.rpc.rpc).toHaveBeenCalledOnce();
    expect(h.seen.sort()).toEqual(["branch_price_books","rate_cards","service_catalog"]);
  });

  it("does not falsely acknowledge owner names if the stored catalog differs",async()=>{
    const h=harness();
    const wrongName=form();
    wrongName.set("nameStandard","Owner renamed standard clean");
    expect(await setupAuthorizedCleaningPricing("fictional-qa",wrongName,h.deps))
      .toMatchObject({ok:false,code:"PRICING_SETUP_READBACK_UNVERIFIED"});
  });

  it("never reports saved pricing when a DB-acknowledged row is missing on readback",async()=>{
    const h=harness({missingProof:true});
    expect(await setupAuthorizedCleaningPricing("fictional-qa",form(),h.deps))
      .toMatchObject({ok:false,code:"PRICING_SETUP_READBACK_UNVERIFIED"});
  });

  it("does not throw or claim a failed write after a committed RPC when readback loses connectivity",async()=>{
    const h=harness({readbackThrows:true});
    const result=await setupAuthorizedCleaningPricing("fictional-qa",form(),h.deps);
    expect(h.rpc.rpc).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ok:false,code:"PRICING_SETUP_READBACK_UNVERIFIED"});
    if (result.ok) throw new Error("Readback exception must not be verified");
    expect(result.message).toContain("Reload Settings");
    expect(result.message).not.toContain("No prices have been saved");
  });

  it("does not assume rollback when a priced RPC response is lost after the server may commit",async()=>{
    const h=harness({rpcThrows:true});
    const result=await setupAuthorizedCleaningPricing("fictional-qa",form(),h.deps);
    expect(h.rpc.rpc).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ok:false,code:"PRICING_SETUP_RPC_UNAVAILABLE"});
    if (result.ok) throw new Error("Unknown RPC outcome is not a confirmed success");
    expect(result.message).toContain("Reload Settings");
    expect(h.seen).toHaveLength(0);
  });

  it("keeps the migration service-role-only, invoker-secured and owner-scoped",()=>{
    const read=(p:string)=>readFileSync(join(process.cwd(),p),"utf8");
    const sql=read("supabase/migrations/0061_v4_owner_first_run_pricing.sql");
    expect(sql).toContain("security invoker");
    expect(sql).toContain("from public.memberships");
    expect(sql).toContain("servicedesk_actor_has_branch_access");
    expect(sql).toContain("from public.branch_price_books");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("on conflict (workspace_id,code) do update");
    expect(sql).toContain("sc.active is distinct from true");
    expect(sql).toContain("v_existing.deposit_percent = (p_input->>'depositPercent')::integer");
    expect(sql).toContain("v_existing.valid_hours = (p_input->>'validHours')::integer");
    expect(sql).toContain("v_existing.buffer_minutes = (p_input->>'bufferMinutes')::integer");
    expect(sql.indexOf("sc.active is distinct from true"))
      .toBeLessThan(sql.indexOf("insert into public.service_catalog"));
    expect(sql).toContain("sc.name=trim(v_names->>'STANDARD')");
    expect(sql).toContain("from public,anon,authenticated");
    expect(sql).toContain("to service_role");
    expect(sql).not.toContain("security definer");
    const ui=read("src/features/operations/OwnerCleaningPricingSetupForm.tsx");
    expect(ui).toContain("No monetary preset");
    expect(ui).toContain('name="branchId"');
    expect(read("src/features/operations/OperationalProductRoute.tsx"))
      .toContain("setupAuthorizedCleaningPricing(workspaceSlug, formData)");
  });
});
