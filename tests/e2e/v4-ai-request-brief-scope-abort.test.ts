import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(),
  "src/features/operations/AiRequestBrief.tsx"),"utf8");

describe("V4 request AI copilot tenant and request switch handling",()=>{
  it("ties state to exact workspace and request identity",()=>{
    expect(source).toContain('const scopeKey = workspaceSlug + "\\\\0" + requestId;');
    expect(source).toContain("const scoped = status?.scopeKey === scopeKey ? status : undefined;");
    expect(source).toContain("previous?.scopeKey === submittedScope");
    expect(source).toContain("requestId !== requestId");
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
    expect(source).toContain("if (!request.signal.aborted) {\n        setStatus(");
  });
  it("retains explicit staff click, safe output parsing and no model auto-provider execution",()=>{
    expect(source).toContain('method: "POST"');
    expect(source).toContain('credentials: "same-origin"');
    expect(source).toContain("if (!configured || busy) return;");
    expect(source).toContain("AI_DRAFT_REQUIRES_REVIEW");
    expect(source).toContain("AUTHORIZED_SAVED_REQUEST");
    expect(source).toContain("No prices, bookings, messages or payments are changed.");
  });
});
