import { describe, expect, it } from "vitest";
import {
 aiCanApprove, aiDecisionLabel, aiReviewScenarios, aiScenarioFor,
} from "@/features/product/ai-review-model";

describe("portfolio AI-review evidence and human gate", () => {
 it("offers three distinct, labelled fictional scenarios with explicitly sourced facts", () => {
  expect(aiReviewScenarios).toHaveLength(3);
  expect(new Set(aiReviewScenarios.map(item=>item.id)).size).toBe(3);
  expect(aiReviewScenarios.every(item=>item.customerMessage&&item.draft&&item.reviewNote)).toBe(true);
  expect(aiReviewScenarios.every(item=>item.facts.some(f=>f.source==="missing"))).toBe(true);
 });
 it("permits ordinary editable sample drafts only within local safety bounds", () => {
  expect(aiCanApprove(aiScenarioFor("move-out"),"Reviewed example")).toBe(true);
  expect(aiCanApprove(aiScenarioFor("recurring-office"),"   ")).toBe(false);
  expect(aiCanApprove(aiScenarioFor("move-out"),"a".repeat(521))).toBe(false);
 });
 it("blocks approval for an unknown chemical spill and requires an escalation decision", () => {
  const unsafe=aiScenarioFor("unsafe-cleanup");
  expect(unsafe.requiresEscalation).toBe(true);
  expect(aiCanApprove(unsafe,unsafe.draft)).toBe(false);
  expect(unsafe.reviewNote).toContain("No routine cleaning quote");
  expect(aiDecisionLabel("escalated")).toContain("No job was dispatched");
 });
 it("never represents human draft approval as an outbound provider receipt", () => {
  expect(aiDecisionLabel("approved")).toContain("No message was sent");
  expect(aiDecisionLabel("rejected")).toContain("No external action");
 });
});
