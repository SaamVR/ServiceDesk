import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { describeAiRequestBriefFailure } from "../../src/features/operations/ai-request-brief-failure";

const ui = readFileSync(join(process.cwd(),
  "src/features/operations/AiRequestBrief.tsx"), "utf8");

describe("V4 actionable, redacted AI request briefing error handling", () => {
  it("explains real configuration and provider failures without inventing delivery", () => {
    expect(describeAiRequestBriefFailure("AI_RUNTIME_DISABLED")).toContain("AI is disabled");
    expect(describeAiRequestBriefFailure("AI_RUNTIME_CONFIGURATION_INCOMPLETE")).toContain("Settings");
    expect(describeAiRequestBriefFailure("AI_MODEL_CONFIGURATION_BLOCKED")).toContain("connection");
    expect(describeAiRequestBriefFailure("AI_MODEL_RATE_LIMITED")).toContain("rate limit");
    expect(describeAiRequestBriefFailure("AI_MODEL_TIMEOUT")).toContain("time limit");
    expect(describeAiRequestBriefFailure("AI_MODEL_INVALID_RESPONSE")).toContain("safe usable brief");
  });

  it("provides scoped auth/request corrective actions", () => {
    expect(describeAiRequestBriefFailure("AI_BRIEF_AUTH_REQUIRED")).toContain("Sign in");
    expect(describeAiRequestBriefFailure("AI_BRIEF_FORBIDDEN")).toContain("workspace access");
    expect(describeAiRequestBriefFailure("AI_BRIEF_NOT_FOUND")).toContain("Refresh Requests");
    expect(describeAiRequestBriefFailure("AI_BRIEF_SERVICE_NOT_FOUND")).toContain("service");
    expect(describeAiRequestBriefFailure(undefined, 401)).toContain("Sign in");
    expect(describeAiRequestBriefFailure(undefined, 403)).toContain("workspace access");
    expect(describeAiRequestBriefFailure(undefined, 404)).toContain("Refresh Requests");
  });

  it("never reflects unknown model/server/customer text into the staff UI", () => {
    for (const malicious of [
      "401 Unauthorized: Bearer sk-do-not-print",
      "<script>alert('hello')</script>",
      "{ customerEmail: private@example.com }",
      "__proto__",
      "constructor",
      null,
      { code: "AI_MODEL_RATE_LIMITED", payload: "private customer" },
    ]) {
      const output = describeAiRequestBriefFailure(malicious);
      expect(output).toContain("Use the saved request details");
      expect(output).not.toContain("private@example.com");
      expect(output).not.toContain("sk-do-not-print");
      expect(output).not.toContain("<script>");
    }
  });

  it("reads only stable machine code and never renders raw response or error", () => {
    expect(ui).toContain("describeAiRequestBriefFailure(failureCode, response.status)");
    expect(ui).toContain('typeof failure === "object"');
    expect(ui).toContain("Object.keys(failure).length <= 3");
    expect(ui).toContain("if (!response.ok)");
    expect(ui).toContain("const parsed = parseSavedAiRequestBrief(result, requestId)");
    expect(ui).not.toContain("message = failure.message");
    expect(ui).not.toContain("message = response.statusText");
    expect(ui).not.toContain("message = await response.text()");
    expect(ui).toContain("No prices, bookings, messages or payments are changed.");
  });
});
