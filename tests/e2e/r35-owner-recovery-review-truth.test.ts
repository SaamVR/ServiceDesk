import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isConsistentOwnerRecoveryAggregate, summarizeOwnerRecoveryReview } from "../../src/features/operations/owner-quote-recovery-guide";

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
  it("fails closed when non-atomic recovery count queries return impossible health aggregates",()=>{
    const valid=available({PENDING:4,PROCESSING:3,RETRY_PENDING:2,
      DEAD_LETTER:1,SUCCEEDED:2,SKIPPED:0},{dueNow:5,expiredLeases:2});
    expect(isConsistentOwnerRecoveryAggregate(valid)).toBe(true);
    const impossible=[
      available({PENDING:1,PROCESSING:3,RETRY_PENDING:2,
        DEAD_LETTER:0,SUCCEEDED:0,SKIPPED:0},{dueNow:4,expiredLeases:1}),
      available({PENDING:1,PROCESSING:3,RETRY_PENDING:2,
        DEAD_LETTER:0,SUCCEEDED:0,SKIPPED:0},{dueNow:1,expiredLeases:4}),
      available({PENDING:1,PROCESSING:-1,RETRY_PENDING:2,
        DEAD_LETTER:0,SUCCEEDED:0,SKIPPED:0},{dueNow:1,expiredLeases:0}),
      available({PENDING:1,PROCESSING:2,RETRY_PENDING:2,
        DEAD_LETTER:NaN,SUCCEEDED:0,SKIPPED:0},{dueNow:1,expiredLeases:0}),
    ];
    for(const source of impossible){
      expect(isConsistentOwnerRecoveryAggregate(source)).toBe(false);
      expect(summarizeOwnerRecoveryReview(source)).toEqual([]);
    }
  });
  it("does not leak customer contact or invent a retry action from the server component",()=>{
    const src=readFileSync(join(process.cwd(),
      "src/features/operations/OwnerQuoteRecoveryQueue.tsx"),"utf8");
    const css=readFileSync(join(process.cwd(),
      "src/features/operations/OwnerQuoteRecoveryQueue.module.css"),"utf8");
    expect(src).toContain("readOwnerQuoteRecoverySummary(workspaceSlug)");
    expect(src).toContain('if (proof.state === "OWNER_REQUIRED") return null');
    expect(src).toContain("Inspect authorized workflow evidence");
    expect(src).toContain("evidence of an empty queue");
    expect(src).toContain("This is <strong>not</strong>");
    expect(src).toContain("point-in-time read without a persisted timestamp");
    expect(src).toContain("isConsistentOwnerRecoveryAggregate(proof)");
    expect(src).toContain("Independent queue counts conflict");
    expect(src).not.toContain("runOwnerSavedOperationalAutomation(");
    expect(src).not.toContain("retryOperationalWorkflowAction(");
    expect(src).not.toContain("fetch(");
    expect(css).toContain("focus-visible");
    expect(css).toContain("@media(max-width:610px)");
    expect(css).toContain("prefers-reduced-motion");
  });
});
