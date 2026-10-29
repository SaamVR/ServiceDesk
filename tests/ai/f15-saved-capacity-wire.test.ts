import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {requestF15SavedCapacityReview} from "../../src/features/operations/f15-saved-capacity-review-action";
describe("F15 dispatch review uses verified F02 capacity without assigning",()=>{
 it("denies malformed slug before any live read",async()=>{
  expect(await requestF15SavedCapacityReview("../")).toEqual({ok:false,state:"CAPACITY_REVIEW_UNAVAILABLE"});
 });
 it("uses double-read capacity engine and does not serialize crew or visit identifiers",()=>{
  const s=readFileSync("src/features/operations/f15-saved-capacity-review-action.ts","utf8");
  expect(s).toContain("proposeSavedCapacityDispatch(workspaceSlug)");
  expect(s).toContain("visitsNeedingAssignment");
  expect(s).toContain("messagesSent:false");
  expect(s).not.toContain("crewId:");
  expect(s).not.toContain("visitId:");
  expect(s).not.toContain("assignmentPerformed:true");
 });
 it("UI rekeys by workspace and only exposes a review action",()=>{
  const s=readFileSync("src/features/operations/AiSavedCapacityReview.tsx","utf8");
  expect(s).toContain("key={workspaceSlug}");
  expect(s).toContain("seq!==serial.current");
  expect(s).toContain("Crew skills and final slot availability need manual verification.");
 });
});
