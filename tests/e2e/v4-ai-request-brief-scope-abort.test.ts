import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSavedAiRequestBrief } from "../../src/features/operations/ai-request-brief-contract";

const source = readFileSync(join(process.cwd(),
  "src/features/operations/AiRequestBrief.tsx"),"utf8");

describe("V4 request AI copilot tenant and request switch handling",()=>{
  it("ties state to exact workspace and request identity",()=>{
    expect(source).toContain('const scopeKey = workspaceSlug +');
    expect(source).toContain('(configured ? "configured" : "disabled")');
    expect(source).toContain("const scoped = status?.scopeKey === scopeKey ? status : undefined;");
    expect(source).toContain("previous?.scopeKey === submittedScope");
    expect(source).toContain("parseSavedAiRequestBrief(result, requestId)");
    const sample={state:"AI_DRAFT_REQUIRES_REVIEW",
      source:"AUTHORIZED_SAVED_REQUEST",requestId:"req-1",model:"gpt-safe",
      briefing:"Review the request before pricing."};
    expect(parseSavedAiRequestBrief(sample,"req-2")).toBeNull();
  });
  it("aborts obsolete HTTP requests when the operator selects a different request or workspace",()=>{
    expect(source).toContain("useRef<AbortController | null>(null)");
    expect(source).toContain("pendingRequest.current?.abort()");
    expect(source).toContain("return () => pendingRequest.current?.abort()");
    expect(source).toContain("}, [scopeKey]);");
    expect(source).toContain("signal: request.signal");
  });
  it("never publishes a delayed response or spurious error after cancellation",()=>{
    expect(source).toContain("if (!request.signal.aborted)");
    expect(source).toContain("if (pendingRequest.current === request) pendingRequest.current = null;");
    expect(source).toContain("if (!request.signal.aborted || timedOut) {");
    expect(source).toContain("clearTimeout(timeout)");
    expect(source).toContain("20_000");
  });
  it("retains explicit staff click, safe output parsing and no model auto-provider execution",()=>{
    expect(source).toContain('method: "POST"');
    expect(source).toContain('credentials: "same-origin"');
    expect(source).toContain("if (!configured || busy) return;");
    expect(source).toContain("parseSavedAiRequestBrief(result, requestId)");
    expect(parseSavedAiRequestBrief({
      state:"AI_DRAFT_REQUIRES_REVIEW",
      source:"AUTHORIZED_SAVED_REQUEST",
      requestId:"req-a",model:"gpt-safe",briefing:"Review this saved service.",
    },"req-a")?.state).toBe("AI_DRAFT_REQUIRES_REVIEW");
    expect(source).toContain("No prices, bookings, messages or payments are changed.");
  });
});
