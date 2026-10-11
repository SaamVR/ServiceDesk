import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { filterQualityQueue, isOverdueQualityCase, prioritizeQualityFollowUp, qualityFeedbackPrefix, qualityQueueCount, qualityQueueHref, normalizeQualityQueue, normalizeQualitySearch } from "@/features/operations/quality-queue";
const source = [
 {id:"c1",state:"OPEN",summary:"Damaged kitchen counter",ownerUserId:null},
 {id:"c2",state:"IN_REVIEW",summary:"Missed window",ownerUserId:"u1"},
 {id:"c3",state:"RESOLVED",summary:"Scratch repaired",ownerUserId:"u2"},
 {id:"c4",state:"OPEN",summary:"Bathroom service",ownerUserId:"u3"},
];
describe("authorized quality triage",()=>{
 it("makes mutually understandable tabs and accurate outstanding counts",()=>{
  expect(qualityQueueCount(source)).toEqual({all:4,open:2,review:1,overdue:0,unassigned:1,resolved:1});
  expect(filterQualityQueue(source,"unassigned","").map(x=>x.id)).toEqual(["c1"]);
  expect(filterQualityQueue(source,"resolved","").map(x=>x.id)).toEqual(["c3"]);
  expect(normalizeQualityQueue("unknown")).toBe("all");
 });
 it("searches each term in real summary plus authorized related fields",()=>{
  expect(filterQualityQueue(source,"all","Kitchen WALTER",i=>[i.summary,i.id==="c1"?"Walter Jones":undefined]).map(x=>x.id)).toEqual(["c1"]);
  expect(filterQualityQueue(source,"open","window",i=>[i.summary])).toEqual([]);
  expect(normalizeQualitySearch("  a    b  ")).toBe("a b");
 });
 it("counts and filters overdue cases using the authorized snapshot time only",()=>{
  const cases=[
    {id:"a",state:"OPEN",summary:"Late visit",dueAt:"2026-10-10T23:00:00Z"},
    {id:"b",state:"IN_REVIEW",summary:"Late review",dueAt:"2026-10-11T07:00:00Z"},
    {id:"c",state:"RESOLVED",summary:"Closed overdue",dueAt:"2026-10-10T12:00:00Z"},
    {id:"d",state:"OPEN",summary:"Future case",dueAt:"2026-10-12T00:00:00Z"},
    {id:"e",state:"OPEN",summary:"No deadline"},
    {id:"f",state:"OPEN",summary:"Malformed deadline",dueAt:"not-an-iso-time"},
  ];
  const asOf="2026-10-11T08:00:00Z";
  expect(qualityQueueCount(cases,asOf).overdue).toBe(2);
  expect(filterQualityQueue(cases,"overdue","",item=>[item.summary],asOf).map(x=>x.id)).toEqual(["a","b"]);
  expect(filterQualityQueue(cases,"overdue","review",item=>[item.summary],asOf).map(x=>x.id)).toEqual(["b"]);
  expect(isOverdueQualityCase(cases[2],asOf)).toBe(false);
  expect(isOverdueQualityCase(cases[0])).toBe(false);
  expect(isOverdueQualityCase(cases[5],asOf)).toBe(false);
  expect(qualityQueueCount(cases).overdue).toBe(0);
  expect(qualityQueueHref("overdue","Late","a")).toBe("?queue=overdue&q=Late&case=a");
  expect(qualityFeedbackPrefix("overdue","Late","a")).toBe("queue=overdue&q=Late&case=a&");
 });
 it("surfaces overdue priority and case time in the authenticated quality route",()=>{
  const route = readFileSync(join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"), "utf8");
  expect(route).toContain("qualityQueueCount(orderedCases, data.loadedAt)");
  expect(route).toContain("filterQualityQueue(orderedCases, queue, search");
  expect(route).toContain("Overdue as of snapshot");
  expect(route).toContain('tone="danger">Overdue');
 });
 it("uses the same deadline-first order in Today and Quality without fabricating due dates",()=>{
  const cases=[
    {id:"future",state:"IN_REVIEW",summary:"Awaiting review",dueAt:"2026-10-13T09:00:00Z"},
    {id:"late-open",state:"OPEN",summary:"Late service",dueAt:"2026-10-10T00:00:00Z"},
    {id:"closed",state:"RESOLVED",summary:"Completed",dueAt:"2026-10-08T00:00:00Z"},
    {id:"missing",state:"OPEN",summary:"No known deadline",dueAt:"invalid"},
    {id:"late-review",state:"IN_REVIEW",summary:"Late follow-up",dueAt:"2026-10-09T00:00:00Z"},
  ];
  const sorted=prioritizeQualityFollowUp(cases,"2026-10-11T08:00:00Z");
  expect(sorted.map(x=>x.id)).toEqual(["late-review","late-open","future","missing","closed"]);
  expect(cases[0].id).toBe("future");
  const dashboard=readFileSync(join(process.cwd(),"src/features/operations/StaffOverviewDashboard.tsx"),"utf8");
  expect(dashboard).toContain("prioritizeQualityFollowUp(snapshot.qualityCases, snapshot.loadedAt)");
  expect(dashboard).toContain("overdueQualityCount");
  expect(dashboard).toContain("?queue=overdue");
  expect(dashboard).toContain('isOverdueQualityCase(item, snapshot.loadedAt) ? "Overdue"');
  const route=readFileSync(join(process.cwd(),"src/features/operations/OperationalProductRoute.tsx"),"utf8");
  expect(route).toContain("prioritizeQualityFollowUp(data.qualityCases, data.loadedAt)");
 });
 it("keeps status and text filter after authenticated case actions",()=>{
  expect(qualityQueueHref("review","Missed window","c2")).toBe("?queue=review&q=Missed+window&case=c2");
  expect(qualityFeedbackPrefix("review","Missed window","c2")).toBe("queue=review&q=Missed+window&case=c2&");
  expect(qualityQueueHref("all","")).toBe("?");
 });
});
