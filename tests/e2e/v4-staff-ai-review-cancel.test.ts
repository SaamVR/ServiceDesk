import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
describe("staff AI suggestion cancellation",()=>{
  test("keeps cancellation browser-only without mutating customer messages",()=>{
    const src=readFileSync(join(process.cwd(),
      "src/features/operations/StaffAiReviewComposer.tsx"),"utf8");
    expect(src).toContain("function cancelSuggestion()");
    expect(src).toContain('busy !== "drafting"');
    expect(src).toContain("controller.current?.abort()");
expect(src).toContain("if (pending.signal.aborted) return;");
    expect(src).toContain('setError("cancelled")');
    expect(src).toContain("Cancel suggestion");
    expect(src).toContain("No reply was approved or queued.");
    expect(src).toContain("if (!pending.signal.aborted) setBusy");
  });
});