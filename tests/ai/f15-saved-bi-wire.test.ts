import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {requestF15SavedBusinessReview} from "../../src/features/operations/f15-saved-business-review-action";
describe("F15 evidence-only owner daily/weekly operations",()=>{
 it("rejects invalid slug before accessing saved counts",async()=>{
  expect(await requestF15SavedBusinessReview("bad/slug")).toEqual({ok:false,state:"SAVED_BI_UNAVAILABLE"});
 });
 it("preserves F03 double-read owner scope and refuses invented revenue",()=>{
  const a=readFileSync("src/features/operations/f15-saved-business-review-action.ts","utf8");
  expect(a).toContain("loadF03SavedDailyWeeklyIntelligence(workspaceSlug)");
  expect(a).toContain("completeHistoryVerified:false");
  expect(a).toContain("revenueVerified:false");
  expect(a).toContain("financialChanges:false");
 });
 it("renders only saved UTC counts, scope-safe and with explicit absence of financial proof",()=>{
  const ui=readFileSync("src/features/operations/AiSavedBusinessReview.tsx","utf8");
  expect(ui).toContain("key={workspaceSlug}");
  expect(ui).toContain("seq!==serial.current");
  expect(ui).toContain("do not verify revenue, payments");
 });
});
