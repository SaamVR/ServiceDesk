import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {requestF17SavedVisitQualityReview} from "../../src/features/operations/f17-visit-quality-action";
describe("F17 real saved job quality workbench",()=>{
 it("fails before backend read for malformed visit/tenant inputs",async()=>{
  expect(await requestF17SavedVisitQualityReview("bad/slug","bad")).toEqual({ok:false,state:"VISIT_QUALITY_UNAVAILABLE"});
  expect(await requestF17SavedVisitQualityReview("valid-tenant","bad/id")).toEqual({ok:false,state:"VISIT_QUALITY_UNAVAILABLE"});
 });
 it("wires double-read F02 visit engine but never mutates",()=>{
  const action=readFileSync("src/features/operations/f17-visit-quality-action.ts","utf8");
  expect(action).toContain("proposeSavedVisitReworkReview(slug,visitId)");
  expect(action).toContain("photoMediaVerified:false");
  expect(action).toContain("statusMutated:false");
  expect(action).toContain("reworkScheduled:false");
  for(const forbidden of ["fetch(", ".rpc(", "sendEmail(", "process.env."]) expect(action).not.toContain(forbidden);
 });
 it("renders from current authorized saved Jobs route and refuses unverifiable media",()=>{
  const panel=readFileSync("src/features/operations/JobsSavedQualityPanel.tsx","utf8");
  expect(panel).toContain("loadOperationalStaffSnapshot(workspaceSlug)");
  expect(panel).toContain('["PENDING_REVIEW","COMPLETED"]');
  expect(panel).toContain('scope.selectedBranchId===v.branchId');
  expect(panel).toContain("<AiSavedVisitQualityReview workspaceSlug={workspaceSlug} visitId={selected.id}/>");
  const client=readFileSync("src/features/operations/AiSavedVisitQualityReview.tsx","utf8");
  expect(client).toContain("key={workspaceSlug");
  expect(client).toContain("seq!==serial.current");
  expect(client).toContain("Actual photo objects are");
 });
});
