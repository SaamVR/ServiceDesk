import { describe, expect, it } from "vitest";
import { filterQualityQueue, qualityFeedbackPrefix, qualityQueueCount, qualityQueueHref, normalizeQualityQueue, normalizeQualitySearch } from "@/features/operations/quality-queue";
const source = [
 {id:"c1",state:"OPEN",summary:"Damaged kitchen counter",ownerUserId:null},
 {id:"c2",state:"IN_REVIEW",summary:"Missed window",ownerUserId:"u1"},
 {id:"c3",state:"RESOLVED",summary:"Scratch repaired",ownerUserId:"u2"},
 {id:"c4",state:"OPEN",summary:"Bathroom service",ownerUserId:"u3"},
];
describe("authorized quality triage",()=>{
 it("makes mutually understandable tabs and accurate outstanding counts",()=>{
  expect(qualityQueueCount(source)).toEqual({all:4,open:2,review:1,unassigned:1,resolved:1});
  expect(filterQualityQueue(source,"unassigned","").map(x=>x.id)).toEqual(["c1"]);
  expect(filterQualityQueue(source,"resolved","").map(x=>x.id)).toEqual(["c3"]);
  expect(normalizeQualityQueue("unknown")).toBe("all");
 });
 it("searches each term in real summary plus authorized related fields",()=>{
  expect(filterQualityQueue(source,"all","Kitchen WALTER",i=>[i.summary,i.id==="c1"?"Walter Jones":undefined]).map(x=>x.id)).toEqual(["c1"]);
  expect(filterQualityQueue(source,"open","window",i=>[i.summary])).toEqual([]);
  expect(normalizeQualitySearch("  a    b  ")).toBe("a b");
 });
 it("keeps status and text filter after authenticated case actions",()=>{
  expect(qualityQueueHref("review","Missed window","c2")).toBe("?queue=review&q=Missed+window&case=c2");
  expect(qualityFeedbackPrefix("review","Missed window","c2")).toBe("queue=review&q=Missed+window&case=c2&");
  expect(qualityQueueHref("all","")).toBe("?");
 });
});
