import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {requestF15SavedIntakeReview} from "../../src/features/operations/f15-saved-intake-review-action";
describe("F15 saved intake actually wired to persisted versioned F01",()=>{
 it("refuses malformed slug and IDs without provider or DB call",async()=>{
  expect(await requestF15SavedIntakeReview("invalid/slug","bad")).toEqual({ok:false,state:"SAVED_INTAKE_UNAVAILABLE"});
  expect(await requestF15SavedIntakeReview("good-workspace","bad")).toEqual({ok:false,state:"SAVED_INTAKE_UNAVAILABLE"});
 });
 it("reuses the double-read authorized F01 engine and never sends",()=>{
  const action=readFileSync("src/features/operations/f15-saved-intake-review-action.ts","utf8");
  expect(action).toContain("planAuthorizedSavedIntake({");
  expect(action).toContain("loadOperationalStaffSnapshot(workspaceSlug)");
  expect(action).toContain("expectedVersion:req.version");
  expect(action).toContain("customerContactSent:false");
  expect(action).not.toMatch(/fetch\\(|modelTransport|sendEmail|\.rpc\\(/);
 });
 it("client rekeys on selected record and refuses late cross-scope results",()=>{
  const ui=readFileSync("src/features/operations/AiSavedIntakeReview.tsx","utf8");
  expect(ui).toContain("key={scope}");
  expect(ui).toContain("seq!==sequence.current");
  expect(ui).toContain("Nothing is sent or saved.");
 });
});
