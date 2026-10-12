import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseRequestQuoteInputs } from "../../src/features/operations/request-quote-input";

const { resolveStaffActor, requireOperationalBranchResource, createFacade } =
  vi.hoisted(() => ({
    resolveStaffActor: vi.fn(),
    requireOperationalBranchResource: vi.fn(),
    createFacade: vi.fn(),
  }));
vi.mock("../../src/features/operations/operational-product-runtime", () => ({
  resolveStaffActor, requireOperationalBranchResource,
}));
vi.mock("../../src/server/core/request-quote-capacity-postgres", () => ({
  createPostgresRequestQuoteCapacityFacadeMethods: createFacade,
}));
import { completeOperationalRequestQuoteInputs } from "../../src/features/operations/request-quote-input-action";

const workspaceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const branchId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const requestId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const serviceId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const userId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function form(): FormData {
  const data = new FormData();
  data.set("requestId", requestId);
  data.set("serviceCode", "STANDARD");
  data.set("bedrooms", "2");
  data.set("bathrooms", "1");
  data.set("expectedVersion", "3");
  return data;
}

function harness(options: {
  role?: string;
  requestedVersion?: number;
  selectedBranch?: string;
  existingBranch?: string;
  noActiveService?: boolean;
  terminalStatus?: string;
  readbackMismatch?: boolean;
  rpcFails?: boolean;
} = {}) {
  const request = {
    id: requestId, workspace_id: workspaceId,
    branch_id: options.existingBranch ?? branchId,
    version: options.requestedVersion ?? 3,
    status: options.terminalStatus ?? "NEW",
    service_id: null as string | null,
    bedrooms: null as number | null,
    bathrooms: null as number | null,
  };
  let saved = false;
  const service = {
    from(table: string) {
      const filters: Record<string,unknown>={};
      const q = {
        select() { return q; },
        eq(k: string, v: unknown) {filters[k] = v;return q;},
        async maybeSingle() {
          if (table === "requests") {
            if (filters.workspace_id !== workspaceId || filters.id !== requestId)
              return { data: null, error: null };
            return { data: saved && options.readbackMismatch
              ? { ...request, service_id: "wrong-service" } : { ...request }, error: null };
          }
          if (table === "service_catalog") return {data: options.noActiveService
            ? null : {id:serviceId,code:"STANDARD",active:true},error:null};
          return { data:null,error:null };
        },
      };
      return q;
    },
  };
  const updateRequest = vi.fn(async(_actor:unknown,_id:string,patch:{
    serviceCode:string;bedrooms:number;bathrooms:number;
  },meta:{expectedVersion:number})=>{
    if (options.rpcFails) return {ok:false,code:"VERSION_CONFLICT",message:"stale"};
    if (meta.expectedVersion !== request.version) return {ok:false,code:"VERSION_CONFLICT",message:"stale"};
    saved = true;
    request.version++;
    request.service_id=serviceId;
    request.bedrooms=patch.bedrooms;
    request.bathrooms=patch.bathrooms;
    return {ok:true,value:{id:requestId,...patch}};
  });
  resolveStaffActor.mockResolvedValue({ok:true,value:{
    workspace:{id:workspaceId,slug:"cleaning-qa"},
    actor:{role:options.role??"OWNER",workspaceId,userId},
    branchScope:{mode:"BRANCH",selectedBranchId:options.selectedBranch??branchId,
      branches:[{id:branchId,currency:"USD",name:"North"}]},
    service,rpc:{rpc:vi.fn()},
  }});
  requireOperationalBranchResource.mockResolvedValue(undefined);
  createFacade.mockReturnValue({updateRequest});
  return {service,request,updateRequest};
}

beforeEach(()=>{
  resolveStaffActor.mockReset();
  requireOperationalBranchResource.mockReset();
  createFacade.mockReset();
});

describe("V4 human-confirmed saved request facts",()=>{
  it("strictly parses service, version and 0-10 room counts without defaulting missing data",()=>{
    expect(parseRequestQuoteInputs(form())).toMatchObject({ok:true,value:{
      requestId,expectedVersion:3,serviceCode:"STANDARD",bedrooms:2,bathrooms:1,
    }});
    for(const [key,bad] of [
      ["serviceCode","AI_CUSTOM"],["expectedVersion","0"],["expectedVersion","1.5"],
      ["bedrooms","11"],["bathrooms","-1"],["bathrooms","1e2"],
      ["requestId","wrong-workspace"],
    ]) {
      const candidate=form();candidate.set(key,bad);
      expect(parseRequestQuoteInputs(candidate)).toMatchObject({ok:false});
    }
  });

  it("saves only real catalog service and owner-confirmed room data under a versioned staff RPC",async()=>{
    const h=harness();
    const result=await completeOperationalRequestQuoteInputs("cleaning-qa",form());
    expect(result).toMatchObject({ok:true});
    expect(h.updateRequest).toHaveBeenCalledOnce();
    expect(h.updateRequest.mock.calls[0][1]).toBe(requestId);
    expect(h.updateRequest.mock.calls[0][2]).toEqual({
      serviceCode:"STANDARD",bedrooms:2,bathrooms:1,
    });
    expect(h.updateRequest.mock.calls[0][3].expectedVersion).toBe(3);
    expect(h.request.version).toBe(4);
    expect(result.message).toContain("Quote calculation still requires");
  });

  it("denies unauthorized roles, active branch mismatch, terminal requests and missing saved services",async()=>{
    for (const config of [
      {role:"CREW"}, {role:"CUSTOMER"}, {selectedBranch:"ffffffff-ffff-4fff-8fff-ffffffffffff"},
      {existingBranch:"ffffffff-ffff-4fff-8fff-ffffffffffff"},
      {terminalStatus:"BOOKED"}, {noActiveService:true},
    ]) {
      const h=harness(config);
      const result=await completeOperationalRequestQuoteInputs("cleaning-qa",form());
      expect(result.ok).toBe(false);
      expect(h.updateRequest).not.toHaveBeenCalled();
    }
  });

  it("honors the selected-branch authorization helper before reading or updating",async()=>{
    const h=harness();
    requireOperationalBranchResource.mockResolvedValue({
      ok:false,message:"This record is not available in your selected branch.",
    });
    expect(await completeOperationalRequestQuoteInputs("cleaning-qa",form()))
      .toMatchObject({ok:false});
    expect(h.updateRequest).not.toHaveBeenCalled();
  });

  it("rejects stale optimistic version with no mutation",async()=>{
    const h=harness({requestedVersion:4});
    const result=await completeOperationalRequestQuoteInputs("cleaning-qa",form());
    expect(result.ok).toBe(false);
    expect(result.message).toContain("changed");
    expect(h.updateRequest).not.toHaveBeenCalled();
  });

  it("treats missing persisted readback as unverified even if the RPC claimed success",async()=>{
    const h=harness({readbackMismatch:true});
    const result=await completeOperationalRequestQuoteInputs("cleaning-qa",form());
    expect(h.updateRequest).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ok:false});
    expect(result.message).toContain("Reload");
  });

  it("does not claim a save on version-conflicting RPC response",async()=>{
    const h=harness({rpcFails:true});
    const result=await completeOperationalRequestQuoteInputs("cleaning-qa",form());
    expect(result).toMatchObject({ok:false});
    expect(h.request.version).toBe(3);
  });

  it("wires the real staff-only form into Quote readiness without synthetic service defaults",()=>{
    const route=readFileSync(join(process.cwd(),
      "src/features/operations/OperationalProductRoute.tsx"),"utf8");
    const action=readFileSync(join(process.cwd(),
      "src/features/operations/request-quote-input-action.ts"),"utf8");
    expect(route).toContain("completeOperationalRequestQuoteInputs(workspaceSlug, formData)");
    expect(route).toContain('name="serviceCode"');
    expect(route).toContain('name="expectedVersion"');
    expect(route).toContain('name="bedrooms"');
    expect(route).toContain('name="bathrooms"');
    expect(route).toContain("supportedActiveServices");
    expect(route).toContain("human-confirmed");
    expect(action).toContain("requireOperationalBranchResource");
    expect(action).toContain("createPostgresRequestQuoteCapacityFacadeMethods");
    expect(action).not.toContain("defaultRateCard");
  });
});
