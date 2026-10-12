import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSavedAiRequestBrief } from
  "../../src/features/operations/ai-request-brief-contract";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const good = {
  state: "AI_DRAFT_REQUIRES_REVIEW", requestId: id,
  source: "AUTHORIZED_SAVED_REQUEST", model: "gpt-restricted",
  briefing: "Confirm the type of cleaning before preparing a quote.",
};

describe("saved AI request copilot browser evidence", () => {
  it("accepts only a verified staff-review draft for the exact saved request", () => {
    expect(parseSavedAiRequestBrief(good,id)).toEqual(good);
  });
  it.each([
    null, false, [], "string", {},
    {...good,state:"SENT_TO_CUSTOMER"},
    {...good,source:"UNTRUSTED_FIXTURE"},
    {...good,requestId:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"},
    {...good,model:""},
    {...good,model:"x".repeat(101)},
    {...good,model:"gpt\u0000fake"},
    {...good,briefing:""},
    {...good,briefing:"a".repeat(901)},
    {...good,briefing:{unexpected:"object"}},
  ])("rejects missing, oversized, untrusted or cross-request responses",bad=>{
    expect(parseSavedAiRequestBrief(bad,id)).toBeNull();
  });
  it("client request is abortable, time bounded and refuses non-JSON success", () => {
    const source=readFileSync(join(process.cwd(),
      "src/features/operations/AiRequestBrief.tsx"),"utf8");
    expect(source).toContain("const pending = new AbortController()");
    expect(source).toContain("pending.abort()");
    expect(source).toContain("20_000");
    expect(source).toContain("signal: pending.signal");
    expect(source).toContain('response.headers.get("content-type")');
    expect(source).toContain("parseSavedAiRequestBrief(result, requestId)");
    expect(source).toContain("previous?.scopeKey === submittedScope");
  });
});
