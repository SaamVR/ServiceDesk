import { describe, expect, test } from "vitest";
import { explainOwnerMetric } from "../../src/server/ai/owner-assistant";
const base={
 workspaceId:"workspace-qa",source:"CORE_METRICS" as const,
 from:"2026-10-01T00:00:00.000Z",to:"2026-10-18T00:00:00.000Z",
 metrics:{OPEN_REQUESTS:2,OVERDUE_INVOICES_MINOR:1250},
};
const owner={workspaceId:"workspace-qa",userId:"owner-qa",role:"OWNER" as const};
describe("SONIC R33 owner metric evidence integrity",()=>{
 test("returns count+time-window read-only explanation for exact authorized data",()=>{
  const result=explainOwnerMetric(owner,base,"OPEN_REQUESTS");
  expect(result).toMatchObject({ok:true,value:{value:2,source:"CORE_METRICS",readOnly:true,
    timeRange:{from:base.from,to:base.to}}});
 });
 test("refuses out-of-tenant and non-owner access before source narration",()=>{
  expect(explainOwnerMetric({...owner,workspaceId:"other"},base,"OPEN_REQUESTS"))
    .toMatchObject({ok:false,code:"WORKSPACE_MISMATCH"});
  expect(explainOwnerMetric({...owner,role:"DISPATCHER"},base,"OPEN_REQUESTS"))
    .toMatchObject({ok:false,code:"OWNER_ROLE_REQUIRED"});
 });
 test("refuses invalid metric values rather than displaying fabricated negative/NaN totals",()=>{
  for (const value of [-1,NaN,Infinity,-Infinity,1.5,2**53,"5",null]){
    const source={...base,metrics:{OPEN_REQUESTS:value}};
    expect(explainOwnerMetric(owner,source as typeof base,"OPEN_REQUESTS"))
      .toMatchObject({ok:false,code:"OWNER_METRIC_VALUE_UNVERIFIED"});
  }
 });
 test("rejects invalid reporting windows and source provenance",()=>{
  for(const changes of [
   {from:"2026-10-18T00:00:00.000Z",to:"2026-10-01T00:00:00.000Z"},
   {from:"2026-02-30T00:00:00.000Z"},
   {from:"2026-10-01"},
   {to:"2026-10-18T00:00:00"},
   {from:"2020-01-01T00:00:00.000Z"},
   {source:"MODEL_PREDICTION"},
   {metrics:{NOT_PERMITTED:10}},
   {metrics:[1,2]},
  ]) {
   const result=explainOwnerMetric(owner,{...base,...changes} as typeof base,"OPEN_REQUESTS");
   expect(result).toMatchObject({ok:false,code:"OWNER_METRIC_SOURCE_UNVERIFIED"});
  }
 });
 test("does not reinterpret missing metric as zero or extrapolate revenue",()=>{
  expect(explainOwnerMetric(owner,{...base,metrics:{} },"OPEN_REQUESTS"))
    .toMatchObject({ok:false,code:"METRIC_NOT_AVAILABLE"});
  expect(explainOwnerMetric(owner,base,"EXPECTED_REVENUE"))
    .toMatchObject({ok:false,code:"UNKNOWN_METRIC"});
 });
});
