import {describe,expect,it} from "vitest";
import {buildDispatchRecommendations, type DispatchSnapshot} from "../../src/features/dispatch/recommendations";
const base: DispatchSnapshot={
 visits:[{id:"visit-a",workspaceId:"ws-1",requestId:"req-a",quoteId:"quote-a",
 status:"CONFIRMED",version:1,startAt:"2026-10-18T11:00:00.000Z",
 serviceMinutes:120,bufferMinutes:30,serviceCode:"DEEP"}],
 crews:[{id:"crew-a",workspaceId:"ws-1",active:true,
 availableFrom:"2026-10-18T08:00:00.000Z",availableTo:"2026-10-18T18:00:00.000Z",
 serviceCodes:["DEEP"]}],
};
const candidate=(snap:DispatchSnapshot)=>buildDispatchRecommendations(snap)[0]?.candidates[0];
describe("R34 dispatch automatic advice must refuse unsafe saved schedule",()=>{
 it("keeps ordinary real bounded crew assignment eligible for human approval",()=>{
   const c=candidate(base);
   expect(c).toMatchObject({eligible:true,conflicts:[],humanApprovalRequired:true});
 });
 it("rejects missing, invalid-zone and impossible job calendar dates",()=>{
   for(const time of ["2026-02-30T10:00:00.000Z","2026-10-18T11:00:00",
     "2026-10-18T11:00:00+15:00","bad"]){
     const c=candidate({...base,visits:[{...base.visits[0]!,startAt:time}]});
     expect(c?.eligible).toBe(false);
     expect(c?.conflicts).toContain("SCHEDULE_UNVERIFIED");
     expect(c?.reasons).not.toContain("No schedule overlap");
   }
 });
 it("rejects partial or invalid crew availability and never counts it as verified",()=>{
   for(const crew of [
     {...base.crews[0]!,availableTo:undefined},
     {...base.crews[0]!,availableFrom:"bad"},
     {...base.crews[0]!,availableTo:"2026-10-18T07:00:00.000Z"},
   ]){
     const c=candidate({...base,crews:[crew]});
     expect(c?.eligible).toBe(false);
     expect(c?.conflicts).toContain("SCHEDULE_UNVERIFIED");
   }
 });
 it("refuses invalid duration and invalid existing assigned visit as false free capacity",()=>{
   for(const serviceMinutes of [0,-2,NaN,Infinity,100000]){
     const visit={...base.visits[0]!,serviceMinutes};
     expect(candidate({...base,visits:[visit]})?.conflicts).toContain("SCHEDULE_UNVERIFIED");
   }
   const existing={...base.visits[0]!,id:"visit-old",crewId:"crew-a",status:"ASSIGNED" as const,
     startAt:"unknown"};
   const c=candidate({...base,visits:[...base.visits,existing]});
   expect(c?.conflicts).toContain("SCHEDULE_UNVERIFIED");
   expect(c?.reasons).not.toContain("No schedule overlap");
 });
 it("critic: malformed recovered visit date cannot crash full dispatch recommendation",()=>{
   const corrupted={...base.visits[0]!,startAt:null as unknown as string};
   expect(()=>candidate({...base,visits:[corrupted]})).not.toThrow();
   expect(candidate({...base,visits:[corrupted]})?.conflicts).toContain("SCHEDULE_UNVERIFIED");
 });
 it("keeps overlap conflict and exact tenant constraint for known appointment times",()=>{
   const assigned={...base.visits[0]!,id:"visit-b",crewId:"crew-a",status:"ASSIGNED" as const,
     startAt:"2026-10-18T11:30:00.000Z"};
   expect(candidate({...base,visits:[...base.visits,assigned]})?.conflicts)
     .toContain("SCHEDULE_OVERLAP");
   expect(candidate({...base,crews:[{...base.crews[0]!,workspaceId:"ws-other"}]})?.conflicts)
     .toContain("CREW_WORKSPACE_MISMATCH");
 });
});
