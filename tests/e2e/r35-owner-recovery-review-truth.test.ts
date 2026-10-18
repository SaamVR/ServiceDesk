import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { summarizeOwnerRecoveryReview } from "../../src/features/operations/owner-quote-recovery-guide";

const available=(counts={PENDING:0,PROCESSING:0,RETRY_PENDING:0,DEAD_LETTER:0,SUCCEEDED:0,SKIPPED:0},
  health={dueNow:0,expiredLeases:0}) => ({
  state:"AVAILABLE" as const,counts,health,
});
describe("R35 L21 owner recovery inspector uses genuine source counts only",()=>{
  it("prioritizes expired leases then dead letters then due without starting worker",()=>{
    const result=summarizeOwnerRecoveryReview(available({
      PENDING:4,PROCESSING:6,RETRY_PENDING:3,DEAD_LETTER:2,SUCCEEDED:20,SKIPPED:1,
    },{dueNow:7,expiredLeases:1}));
    expect(result.map(item=>item.id)).toEqual([
      "EXPIRED_LEASES","DEAD_LETTERS","DUE_EVENTS"]);
    expect(result.map(item=>item.count)).toEqual([1,2,7]);
    expect(result.every(item=>item.description.includes("Review") ||
      item.description.includes("no automatic") ||
      item.description.includes("does not prove"))).toBe(true);
  });
  it("does not portray a missing migration or an empty aggregate as healthy processing",()=>{
    expect(summarizeOwnerRecoveryReview({state:"UNAVAILABLE"})).toEqual([]);
    expect(summarizeOwnerRecoveryReview({state:"OWNER_REQUIRED"})).toEqual([]);
    expect(summarizeOwnerRecoveryReview(available())).toEqual([]);
  });
  it("does not leak customer contact or invent a retry action from the server component",()=>{
    const src=readFileSync(join(process.cwd(),
      "src/features/operations/OwnerQuoteRecoveryQueue.tsx"),"utf8");
    const css=readFileSync(join(process.cwd(),
      "src/features/operations/OwnerQuoteRecoveryQueue.module.css"),"utf8");
    expect(src).toContain("readOwnerQuoteRecoverySummary(workspaceSlug)");
    expect(src).toContain('if (proof.state === "OWNER_REQUIRED") return null');
    expect(src).toContain("Inspect authorized workflow evidence");
    expect(src).toContain("not evidence of an empty queue");
    expect(src).toContain("point-in-time read without a persisted timestamp");
    expect(src).not.toContain("runOwnerSavedOperationalAutomation(");
    expect(src).not.toContain("retryOperationalWorkflowAction(");
    expect(src).not.toContain("fetch(");
    expect(css).toContain("focus-visible");
    expect(css).toContain("@media(max-width:610px)");
    expect(css).toContain("prefers-reduced-motion");
  });
});
