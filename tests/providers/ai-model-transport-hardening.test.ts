import { describe, expect, it } from "vitest";
import {
  callAiModel,
  redactedAiModelRequestSummary,
  type AiModelHttpRequest,
} from "../../src/server/ai/model-transport";

const config = {
  apiBaseUrl: "https://model-provider.example.test/v1",
  apiKey: "synthetic-ai-transport-key",
  model: "controlled-model",
  now: () => "2026-10-11T02:00:00Z",
};
const input = {
  promptVersion: "controlled-prompt",
  conversationId: "synthetic-conversation",
  workspaceId: "synthetic-workspace",
  userText: "Please quote my studio cleaning.",
};

const sendBody = (body: string) => callAiModel(config, input, async () =>
  ({ status: 200, body }));

describe("bounded configured AI model transport", () => {
  it("accepts a structured model response as a proposal only", async () => {
    let captured: AiModelHttpRequest | undefined;
    const result = await callAiModel(config, input, async request => {
      captured = request;
      return { status: 200, body: JSON.stringify({
        output: { serviceCode: "STANDARD", bedrooms: 1 },
        replyDraft: "A team member can prepare a reviewed quote.",
        requestedToolCalls: [{ name: "getServiceCatalog", arguments: {} }],
        citations: [],
      }) };
    });
    expect(result).toMatchObject({ ok: true, value: {
      output: { serviceCode: "STANDARD", bedrooms: 1 },
      replyDraft: "A team member can prepare a reviewed quote.",
    } });
    expect(captured?.url).toBe("https://model-provider.example.test/v1/responses");
    expect(redactedAiModelRequestSummary(captured!)).toMatchObject({
      hasBearerAuthorization: true, bodyKeys: ["input", "metadata", "model", "response_format"],
    });
    expect(JSON.stringify(result)).not.toContain("synthetic-ai-transport-key");
  });

  it("treats primitive JSON, null and arrays as model contract failures, not network failures", async () => {
    for (const raw of ["null", "1", "true", '"hi"', "[]", "{}", '{"output":null}', "not-json"]) {
      const result = await sendBody(raw);
      expect(result).toMatchObject({ ok: false, code: "AI_MODEL_INVALID_RESPONSE" });
      expect(JSON.stringify(result)).not.toContain(input.userText);
    }
  });

  it("rejects oversized model payloads, tool call lists and assistant copy", async () => {
    const payloads = [
      "x".repeat(262_145),
      JSON.stringify({ output: {}, requestedToolCalls: Array.from({ length: 9 }, () => ({ name: "getServiceCatalog" })) }),
      JSON.stringify({ output: {}, replyDraft: "x".repeat(6_001) }),
      JSON.stringify({ output: {}, replyDraft: ["unsafe"] }),
    ];
    for (const raw of payloads) {
      expect(await sendBody(raw)).toMatchObject({ ok: false, code: "AI_MODEL_INVALID_RESPONSE" });
    }
    expect(await sendBody(JSON.stringify({ output: {}, replyDraft: "x".repeat(6_000) })))
      .toMatchObject({ ok: true });
  });

  it("normalizes configuration and failure classifications without leaking credentials", async () => {
    const authFailure = await callAiModel(config, input, async () => ({ status: 401, body: "unauthorized" }));
    expect(authFailure).toMatchObject({ ok: false, code: "AI_MODEL_CONFIGURATION_BLOCKED" });
    const timeoutFailure = await callAiModel(config, input, async () => { throw Object.assign(new Error("secret-token"), { name: "AbortError" }); });
    expect(timeoutFailure).toMatchObject({ ok: false, code: "AI_MODEL_TIMEOUT" });
    const normalized = await callAiModel({ ...config, timeoutMs: Number.NaN }, input, async () =>
      ({ status: 200, body: JSON.stringify({ output: {} }) }));
    expect(normalized).toMatchObject({ ok: true });
    expect(JSON.stringify(authFailure)).not.toContain(config.apiKey);
    expect(JSON.stringify(timeoutFailure)).not.toContain("secret-token");
  });

  it("uses the official OpenAI Responses request shape without provider-side storage", async () => {
    let request: AiModelHttpRequest | undefined;
    const official = { ...config, apiBaseUrl: "https://api.openai.com/v1" };
    const responseText = JSON.stringify({
      output: { serviceCode: "DEEP", bedrooms: 2 },
      replyDraft: "A staff member can review the request.",
      requestedToolCalls: [], citations: [],
    });
    const result = await callAiModel(official, input, async captured => {
      request = captured;
      return { status: 200, body: JSON.stringify({
        object: "response", status: "completed",
        output: [
          { type: "reasoning", summary: [] },
          { type: "message", content: [{ type: "output_text", text: responseText }] },
        ],
      }) };
    });

    expect(result).toMatchObject({ ok: true, value: {
      output: { serviceCode: "DEEP", bedrooms: 2 },
      replyDraft: "A staff member can review the request.",
    } });
    expect(request?.url).toBe("https://api.openai.com/v1/responses");
    const body = JSON.parse(request!.body);
    expect(body.model).toBe(config.model);
    expect(body.text.format).toEqual({ type: "json_object" });
    expect(body.store).toBe(false);
    expect(body).not.toHaveProperty("response_format");
    expect(body.metadata).toEqual({
      prompt_version: input.promptVersion,
      conversation_id: input.conversationId,
      workspace_id: input.workspaceId,
      knowledge_refs: "",
    });
    expect(Object.values(body.metadata).every(value => typeof value === "string")).toBe(true);
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).not.toContain(config.apiKey);
  });

  it("refuses incomplete, malformed and explicit refusal Responses envelopes", async () => {
    const official = { ...config, apiBaseUrl: "https://api.openai.com/v1" };
    const bodies = [
      { object: "response", status: "incomplete", output: [] },
      { object: "response", status: "failed", output: [] },
      { object: "response", status: "completed", output: [] },
      { object: "response", status: "completed", output: [
        { type: "message", content: [{ type: "refusal", refusal: "Cannot comply" }] },
      ] },
      { object: "response", status: "completed", output: [
        { type: "message", content: [{ type: "output_text", text: "not-json" }] },
      ] },
    ];
    for (const response of bodies) {
      const result = await callAiModel(official, input, async () => ({
        status: 200, body: JSON.stringify(response),
      }));
      expect(result).toMatchObject({ ok: false, code: "AI_MODEL_INVALID_RESPONSE" });
      expect(JSON.stringify(result)).not.toContain("Cannot comply");
    }
  });

  it("blocks malformed official API origins before any credential-bearing call", async () => {
    let attempts = 0;
    for (const apiBaseUrl of [
      "http://api.openai.com/v1",
      "https://api.openai.com/v1?unsafe=1",
      "https://api.openai.com/v1/responses",
      "https://user:pass@api.openai.com/v1",
    ]) {
      const result = await callAiModel({ ...config, apiBaseUrl }, input, async () => {
        attempts += 1;
        return { status: 200, body: JSON.stringify({ output: {} }) };
      });
      expect(result).toMatchObject({ ok: false, code: "AI_MODEL_CONFIGURATION_BLOCKED" });
    }
    expect(attempts).toBe(0);
  });

});
