import { describe, expect, it } from "vitest";
import { planAuthorizedSavedIntake, type SavedIntakeDependencies } from "../../src/server/ai/f01-saved-intake-proposal";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const branchId = "33333333-3333-4333-8333-333333333333";
const serviceId = "44444444-4444-4444-8444-444444444444";
const row = { id:requestId, workspace_id:workspaceId, branch_id:branchId,
  service_id:serviceId, version:4, status:"NEW", bedrooms:2, bathrooms:null };
const catalog = { id:serviceId, workspace_id:workspaceId, code:"DEEP", active:true, requires_review:false };

function fixture(options: { request?:Record<string,unknown>; catalog?:Record<string,unknown>|null;
  secondRequest?:Record<string,unknown>; secondCatalog?:Record<string,unknown>|null;
  secondUser?:string; role?:string; otherBranch?:boolean } = {}) {
  const reads: string[] = []; let actorReads = 0;
  const data=(table:string)=> {
    const fresh = actorReads > 1;
    if(table==="requests") return {...row,...(fresh ? options.secondRequest ?? options.request : options.request)};
    if(table==="service_catalog") return fresh ? (options.secondCatalog === undefined ?
      (options.catalog === undefined ? catalog : options.catalog) : options.secondCatalog) :
      (options.catalog === undefined ? catalog : options.catalog);
    return null;
  };
  const service = { from(table:string) {
    reads.push(table);
    const chain = {
      select(_cols:string){return chain;},
      eq(_key:string,_value:unknown){return chain;},
      async maybeSingle(){return {data:data(table),error:null};},
    };
    return chain;
  }};
  const deps = { resolveActor: async () => {
    actorReads++;
    return { ok:true, value: {
      workspace:{id:workspaceId,slug:"demo-clean"},service,
      actor:{userId:actorReads>1?(options.secondUser??"owner-1"):"owner-1",
        workspaceId,role:options.role??"OWNER"},
      branchScope:{mode:options.role==="DISPATCHER"?"BRANCH":"ALL",
        selectedBranchId:options.otherBranch?"55555555-5555-4555-8555-555555555555":branchId},
    }};
  }} as unknown as SavedIntakeDependencies;
  return {deps,reads, count:()=>actorReads};
}
const input = {workspaceSlug:"demo-clean",requestId,expectedVersion:4};
describe("F01 persisted intake: authorized staff, immutable version, zero side effects",()=>{
  it("classifies only saved facts with explicit unconfirmed staff review",async()=>{
    const f=fixture();
    expect(await planAuthorizedSavedIntake(input,f.deps)).toMatchObject({
      ok:true,value:{state:"STAFF_CONFIRMATION_REQUIRED",classification:"CLARIFICATION_NEEDED",
        questions:[{field:"bathrooms"}],staffConfirmed:false,customerContactSent:false,
        evidence:{requestVersion:4,source:"AUTHORIZED_PERSISTED_REQUEST"}}});
    expect(f.reads).toEqual(["requests","service_catalog","requests","service_catalog"]);
    expect(f.count()).toBe(2);
  });
  it("requires specialist review for saved flagged services",async()=>{
    const f=fixture({catalog:{...catalog,requires_review:true}});
    expect(await planAuthorizedSavedIntake(input,f.deps))
      .toMatchObject({ok:true,value:{classification:"SPECIALIST_REVIEW"}});
  });
  it("rejects untrusted versions, foreign scope, stale fields, role changes and catalog tampering",async()=>{
    for(const change of [
      {request:{version:5}},
      {request:{workspace_id:"foreign"}},
      {request:{bedrooms:"3"}},
      {request:{status:"CANCELLED"}},
      {secondRequest:{bathrooms:4}},
      {secondRequest:{branch_id:"55555555-5555-4555-8555-555555555555"}},
      {secondCatalog:{...catalog,code:"STANDARD"}},
      {secondUser:"other-user"},
      {role:"DISPATCHER",otherBranch:true},
      {catalog:null},
    ]) {
      const result=await planAuthorizedSavedIntake(input,fixture(change).deps);
      expect(result.ok,JSON.stringify(change)).toBe(false);
    }
  });
  it("rejects unsafe/unsaved fields rather than prompting or sending",async()=>{
    const f=fixture();
    for(const bad of [
      {...input,expectedVersion:0},
      {...input,requestId:"other-tenant"},
      {...input,workspaceSlug:"../other"},
      {...input,expectedVersion:NaN},
    ]) expect((await planAuthorizedSavedIntake(bad,f.deps)).ok).toBe(false);
    expect(f.reads).toHaveLength(0);
  });
});
