import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AiRequestBrief } from "../../src/features/operations/AiRequestBrief";
import { AiOwnerModelProbe } from "../../src/features/operations/AiOwnerModelProbe";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V4 AI panels never reuse cross-workspace or cross-request receipts", () => {
  it("hides stale request copilot states as soon as the authorized workspace or request changes", () => {
    const src = read("src/features/operations/AiRequestBrief.tsx");
    expect(src).toContain('scopeKey = workspaceSlug +');
    expect(src).toContain("requestId");
    expect(src).toContain("status?.scopeKey === scopeKey ? status : undefined");
    expect(src).toContain("setStatus({ scopeKey: submittedScope, busy: true })");
    expect(src).toContain("previous?.scopeKey === submittedScope");
    expect(src).toContain("body: JSON.stringify({ workspaceSlug, requestId })");
    expect(src).toContain("(result as Brief).requestId !== requestId");
  });

  it("rejects model-less and empty brief results without showing false AI success", () => {
    const src = read("src/features/operations/AiRequestBrief.tsx");
    for (const expected of [
      '(result as Brief).state !== "AI_DRAFT_REQUIRES_REVIEW"',
      '(result as Brief).source !== "AUTHORIZED_SAVED_REQUEST"',
      'typeof (result as Brief).model !== "string"',
      '!(result as Brief).model.trim()',
      '!(result as Brief).briefing.trim()',
      "(result as Brief).briefing.length > 900",
    ]) expect(src).toContain(expected);
    expect(src).toContain("Staff must verify facts");
  });

  it("hides obsolete model connection receipts after a workspace change", () => {
    const src = read("src/features/operations/AiOwnerModelProbe.tsx");
    expect(src).toContain("status?.workspace === workspaceSlug ? status : undefined");
    expect(src).toContain("previous?.workspace === submittedWorkspace");
    expect(src).toContain("body: JSON.stringify({ workspaceSlug })");
    expect(src).toContain('candidate.durableReceipt !== false');
    expect(src).toContain("Number.isFinite(Date.parse(candidate.checkedAt))");
    expect(src).toContain("not a durable");
  });

  it("keeps explicit human-triggered calls and disabled-state communication", () => {
    const brief = renderToStaticMarkup(createElement(AiRequestBrief, {
      workspaceSlug: "qa-cleaning", requestId: "req-a", configured: false,
    }));
    const probe = renderToStaticMarkup(createElement(AiOwnerModelProbe, {
      workspaceSlug: "qa-cleaning", configured: false,
    }));
    expect(brief).toContain("Setup required");
    expect(brief).toContain("underlying request and manual quoting remain available");
    expect(probe).toContain("Setup required");
    expect(probe).toContain("disabled");
    expect(brief).not.toContain("AI-generated draft");
    expect(probe).not.toContain("Model response confirmed");
  });
});
