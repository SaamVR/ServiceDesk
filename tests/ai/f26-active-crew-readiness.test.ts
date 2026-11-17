import {describe,expect,it,vi} from "vitest";
import {readActiveBookedVisitCrew} from "../../src/server/workflows/f26-active-crew-readiness";
const ws="11111111-1111-4111-8111-111111111111";
const branch="22222222-2222-4222-8222-222222222222";
const quote="33333333-3333-4333-8333-333333333333";
const visit="44444444-4444-4444-8444-444444444444";
const request="55555555-5555-4555-8555-555555555555";
const crew="66666666-6666-4666-8666-666666666666";
const slot="77777777-7777-4777-8777-777777777777";
const member="88888888-8888-4888-8888-888888888888";
const user="99999999-9999-4999-8999-999999999999";
const foreign="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
type Row=Record<string,unknown>;
function fixture(){
 const tables:Record<string,Row[]>={
  visits:[{id:visit,workspace_id:ws,quote_id:quote,request_id:request,
   crew_id:crew,slot_id:slot,status:"SCHEDULED",version:2}],
  requests:[{id:request,workspace_id:ws,branch_id:branch}],
  capacity_slots:[{id:slot,workspace_id:ws,crew_id:crew}],
  crews:[{id:crew,workspace_id:ws,branch_id:branch,active:true}],
  crew_members:[{id:member,workspace_id:ws,crew_id:crew,user_id:user,active:true}],
  memberships:[{workspace_id:ws,user_id:user,role:"CREW",status:"ACTIVE"}],
 };
 const from=vi.fn((table:string)=>{
  const where:Array<[string,unknown]>=[];
  const inSet:Array<[string,unknown[]]>=[];
  let limit=100;
  const q={
   select(_column:string){return q;},
   eq(key:string,value:unknown){where.push([key,value]);return q;},
   in(key:string,value:unknown[]){inSet.push([key,value]);return q;},
   limit(n:number){limit=n;return q;},
   rows(){return (tables[table]??[]).filter(r=>
     where.every(([key,v])=>r[key]===v)&&
     inSet.every(([key,values])=>values.includes(r[key]))).slice(0,limit);},
   async maybeSingle(){
    const rows=q.rows();
    return {data:rows.length===1?rows[0]:null,error:rows.length>1?{message:"duplicate"}:null};
   },
   then(ok:(x:unknown)=>unknown,bad?:(reason:unknown)=>unknown){
    return Promise.resolve({data:q.rows(),error:null}).then(ok,bad);
   },
  };return q;
 });
 const actor={workspace:{id:ws},branchScope:{mode:"ALL",branches:[{id:branch}]},service:{from}};
 return {tables,from,actor};
}
describe("F26 real active booked-visit crew source (not mock receipt)",()=>{
 it("requires live crew, same-branch slot and one active CREW membership",async()=>{
  const f=fixture();const proof=await readActiveBookedVisitCrew(f.actor as never,quote,visit);
  expect(proof).toMatchObject({workspaceId:ws,branchId:branch,quoteId:quote,
   visitId:visit,crewId:crew,slotId:slot,visitVersion:2,activeMemberCount:1});
  expect(proof?.fingerprint).toContain(user);
  for(const table of ["visits","requests","capacity_slots","crews",
    "crew_members","memberships"])expect(f.from).toHaveBeenCalledWith(table);
 });
 it("denies inactive crew, crew moved to foreign branch, wrong slot and revoked membership",async()=>{
  const changes:Array<[string,string,unknown]>=[
   ["crews","active",false],["crews","branch_id",foreign],
   ["capacity_slots","crew_id",foreign],["visits","status","CANCELLED"],
   ["crew_members","active",false],["memberships","status","REVOKED"],
   ["memberships","workspace_id",foreign],["memberships","role","GUEST"],
   ["memberships","role","OWNER"],["memberships","role","DISPATCHER"],
  ];
  for(const [table,key,value] of changes){
   const f=fixture();f.tables[table][0][key]=value;
   expect(await readActiveBookedVisitCrew(f.actor as never,quote,visit),
    table+":"+key).toBeNull();
  }
 });
 it("never accepts absent, duplicate, foreign, or over-limit crew evidence",async()=>{
  const absent=fixture();absent.tables.crew_members=[];
  expect(await readActiveBookedVisitCrew(absent.actor as never,quote,visit)).toBeNull();
  const duplicate=fixture();
  duplicate.tables.crew_members.push({...duplicate.tables.crew_members[0],
   id:foreign});
  expect(await readActiveBookedVisitCrew(duplicate.actor as never,quote,visit)).toBeNull();
  const oversized=fixture();
  oversized.tables.crew_members=Array.from({length:51},(_,i)=>({
   ...oversized.tables.crew_members[0],
   id:"bbbbbbbb-bbbb-4bbb-8bbb-"+String(i).padStart(12,"0"),
   user_id:"cccccccc-cccc-4ccc-8ccc-"+String(i).padStart(12,"0"),
  }));
  expect(await readActiveBookedVisitCrew(oversized.actor as never,quote,visit)).toBeNull();
  const foreignOwner=fixture();
  foreignOwner.actor.branchScope.branches=[{id:foreign}];
  expect(await readActiveBookedVisitCrew(foreignOwner.actor as never,quote,visit)).toBeNull();
 });
 it("rejects malformed quote and visit selectors or missing request source",async()=>{
  const f=fixture();expect(await readActiveBookedVisitCrew(f.actor as never,"bad",visit)).toBeNull();
  expect(await readActiveBookedVisitCrew(f.actor as never,quote,"bad")).toBeNull();
  const missing=fixture();missing.tables.requests=[];
  expect(await readActiveBookedVisitCrew(missing.actor as never,quote,visit)).toBeNull();
 });
});