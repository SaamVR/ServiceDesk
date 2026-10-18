import {describe,expect,it} from "vitest";
import {planSavedRequestReviewChecks} from "../../src/server/ai/request-review-checks";
const fact={serviceCode:"not recorded",bedrooms:null,bathrooms:null,status:"NEW"};
describe("R36 AI-D deterministic missing-field request assistant",()=>{
 it("generates actionable staff checks for only missing saved fields",()=>{
  expect(planSavedRequestReviewChecks(fact)).toMatchObject([
   {field:"serviceCode",state:"STAFF_CONFIRMATION_REQUIRED",customerContactSent:false},
   {field:"bedrooms"},{field:"bathrooms"},
  ]);
 });
 it("does not invent missing data when a verified studio request uses zero bedrooms",()=>{
  expect(planSavedRequestReviewChecks({...fact,serviceCode:"STANDARD",bedrooms:0,bathrooms:1}))
   .toEqual([]);
  expect(planSavedRequestReviewChecks({...fact,serviceCode:"DEEP",bedrooms:null,bathrooms:2}))
   .toMatchObject([{field:"bedrooms"}]);
 });
 it("rejects poisoned numeric, accessor and extra fields before model grounding",()=>{
  for(const bad of [
   {...fact,bedrooms:-1},{...fact,bathrooms:Infinity},
   {...fact,bedrooms:0.5},{...fact,secret:"customer private"},
   {...fact,serviceCode:"https://untrusted.example"},
   Object.assign(Object.create({hidden:true}),fact),
   Object.defineProperty({...fact},"status",{enumerable:true,get(){throw Error("unsafe getter");}}),
  ]){
   expect(()=>planSavedRequestReviewChecks(bad)).not.toThrow();
   expect(planSavedRequestReviewChecks(bad as typeof fact)).toBeNull();
  }
 });
});
