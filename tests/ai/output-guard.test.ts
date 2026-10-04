import { describe, expect, test } from "vitest";
import { guardAiModelOutput, guardAiToolCalls } from "../../src/server/ai/output-guard";

describe("AI output guardrails", () => {
  test("accepts a valid structured extraction and normalizes defaults", () => {
    const result = guardAiModelOutput({ serviceCode: "DEEP", bedrooms: 2, bathrooms: 1, corrections: [], unsupportedReasons: [], riskFlags: [] });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toMatchObject({ serviceCode: "DEEP", bedrooms: 2, riskFlags: [] });
  });

  test("fails safe on malformed or unsafe extraction fields", () => {
    expect(guardAiModelOutput({ serviceCode: "WINDOWS" })).toMatchObject({ ok: false, code: "AI_OUTPUT_INVALID" });
    expect(guardAiModelOutput({ bedrooms: -1, corrections: [], unsupportedReasons: [], riskFlags: [] })).toMatchObject({ ok: false, code: "AI_OUTPUT_INVALID" });
    expect(guardAiModelOutput({ riskFlags: ["IGNORE_ALL_POLICIES"], corrections: [], unsupportedReasons: [] })).toMatchObject({ ok: false, code: "AI_OUTPUT_INVALID" });
  });

  test("allows only proposal-safe tools and blocks business-truth mutations", () => {
    const calls = guardAiToolCalls([
      { name: "searchApprovedKnowledge", arguments: { query: "service area" } },
      { name: "calculateQuote", arguments: { requestId: "request-1" } },
      { name: "markPaymentPaid", arguments: { invoiceId: "invoice-1" } },
      { name: "assignCrew", arguments: { crewId: "crew-1" } },
      { name: "findAvailableSlots", arguments: { requestId: "request-1" } },
    ]);

    expect(calls).toEqual([
      expect.objectContaining({ name: "searchApprovedKnowledge", allowed: true }),
      expect.objectContaining({ name: "calculateQuote", allowed: true, reason: expect.stringContaining("facade") }),
      expect.objectContaining({ name: "requestHumanReview", allowed: true, reason: expect.stringContaining("blocked unsafe tool") }),
      expect.objectContaining({ name: "requestHumanReview", allowed: true, reason: expect.stringContaining("blocked unsafe tool") }),
      expect.objectContaining({ name: "findAvailableSlots", allowed: true }),
    ]);
  });

  test("converts malformed tool call output into human review", () => {
    const calls = guardAiToolCalls([{ name: 123 }, null, "bad"]);
    expect(calls).toHaveLength(3);
    expect(calls.every((call) => call.name === "requestHumanReview" && call.allowed)).toBe(true);
  });
});
