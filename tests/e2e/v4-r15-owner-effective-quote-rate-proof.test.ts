import {describe,it,expect} from "vitest";
import {defaultRateCard} from "../../src/domain/quote";
import {verifiedPricedOwnerBranchIds as verified} from "../../src/features/operations/verified-owner-price-evidence";
const branch="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const cardId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const serviceId="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const card={id:cardId,active:true,currency:"USD",version:"owner-approved-v1",
 deposit_percent:25,valid_hours:48,buffer_minutes:30,rules:{
  autoApprovalMaxTotalMinor:50000,standard:defaultRateCard.standard,
  deep:defaultRateCard.deep,moveOut:defaultRateCard.moveOut}};
const book={branch_id:branch,rate_card_id:cardId,active:true,starts_at:null,ends_at:null};
const svc={id:serviceId,code:"STANDARD",active:true};
const evidence=(patch:{books?:Record<string,unknown>[];cards?:Record<string,unknown>[];services?:Record<string,unknown>[];now?:number}={})=>
 verified({books:patch.books??[book],cards:patch.cards??[card],
  services:patch.services??[svc],now:patch.now??Date.parse("2026-10-17T00:00:00Z")});
describe("Owner pricing evidence agrees with saved quote authority",()=>{
 it("displays a verifiable persisted rate card only with a supported active service",()=>{
  expect(evidence()).toEqual([branch]);
  expect(evidence({services:[]})).toEqual([]);
  expect(evidence({services:[{...svc,active:false}]})).toEqual([]);
 });
 it("rejects a pointer to an incomplete, invented or contradictory USD rate card",()=>{
  const failures=[{version:"synthetic-cleaning-v1"},{version:""},{currency:"GBP"},
   {deposit_percent:"25"},{valid_hours:0},{buffer_minutes:1441},
   {rules:{standard:{baseMinor:7000},deep:card.rules.deep,moveOut:card.rules.moveOut,
    autoApprovalMaxTotalMinor:50000}},
   {rules:{...card.rules,moveOut:{...card.rules.moveOut,ovenMinutes:undefined}}},
   {rules:{...card.rules,standard:{...card.rules.standard,bedroomMinor:-1}}},
   {rules:{...card.rules,autoApprovalMaxTotalMinor:"50000"}}];
  for(const change of failures)expect(evidence({cards:[{...card,...change}]})).toEqual([]);
 });
 it("refuses overlapping active books even if only one points at a good card",()=>{
  expect(evidence({books:[book,{...book,rate_card_id:"dddddddd-dddd-4ddd-8ddd-dddddddddddd"}]})).toEqual([]);
  expect(evidence({books:[book,{...book,starts_at:"2030-01-01T00:00:00Z"}]})).toEqual([branch]);
 });
 it("does not silently treat malformed timing as a current owner price",()=>{
  for(const bad of ["not a time",{},true])
    expect(evidence({books:[{...book,starts_at:bad}]})).toEqual([]);
  expect(evidence({books:[{...book,ends_at:"2026-10-17T00:00:00Z"}]})).toEqual([]);
 });
});
