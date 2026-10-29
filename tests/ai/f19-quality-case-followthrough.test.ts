import {describe,expect,it} from "vitest";
import {guideF19SavedQualityCase} from "../../src/features/operations/f19-quality-case-guidance";
import type {OperationalQualityCase,OperationalVisit} from "../../src/features/operations/operational-product-runtime";
import {readFileSync} from "node:fs";
const q:OperationalQualityCase={id:"case",visitId:"visit",state:"IN_REVIEW",summary:"Issue",
 reviewRequestState:"NONE",version:2};
const v:OperationalVisit={id:"visit",workspaceId:"tenant",branchId:"branch",
 requestId:"req",quoteId:"quote",status:"COMPLETED",startAt:"2026-10-30T01:00:00Z",
 serviceMinutes:60,bufferMinutes:0,version:4};
describe("F19 actual quality case follow-through",()=>{
 it("distinguishes missing field evidence from completed review without auto-resolve",()=>{
  expect(guideF19SavedQualityCase(q,v,0,0,0)).toMatchObject({
   code:"EVIDENCE_NOT_CERTIFIED",next:"VERIFY_FIELD_PROOF",canResolveAutomatically:false});
  expect(guideF19SavedQualityCase(q,v,2,3,3)).toMatchObject({
   code:"STAFF_RESOLUTION_REQUIRED",photoObjectsVerified:false,customerContactSent:false});
 });
 it("keeps OPEN and RESOLVED case statuses as human-only commands",()=>{
  expect(guideF19SavedQualityCase({...q,state:"OPEN"},v,2,3,3).next).toBe("START_CASE_REVIEW");
  expect(guideF19SavedQualityCase({...q,state:"RESOLVED"},v,2,3,3).next).toBe("REVIEW_COMPLETED_CASE");
  expect(guideF19SavedQualityCase(q,undefined,2,3,3).code).toBe("VISIT_NOT_FOUND");
  expect(guideF19SavedQualityCase(q,v,2,2,3).code).toBe("SOURCE_UNVERIFIED");
 });
 it("is server-scoped, explicit selected-case only, and reuses F02 saved visit review",()=>{
  const x=readFileSync("src/features/operations/QualityCaseFollowthroughPanel.tsx","utf8");
  expect(x).toContain('["OWNER","DISPATCHER"].includes(source.value.actor.role)');
  expect(x).toContain('scope.mode==="ALL"||v.branchId===scope.selectedBranchId');
  expect(x).toContain("selectedCaseId?cases.find(q=>q.id===selectedCaseId):undefined");
  expect(x).toContain("<AiSavedVisitQualityReview");
  expect(x).not.toContain("applyOperationalQualityAction(");
 });
});
