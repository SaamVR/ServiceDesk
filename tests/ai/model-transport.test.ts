import { describe, expect, test } from "vitest";
import { callAiModel, redactedAiModelRequestSummary, type AiModelHttpTransport } from "../../src/server/ai/model-transport";

const config = {
  apiBaseUrl: "https://models.example.test/v1",
  apiKey: "sk-ai-secret",
  model: "gpt-service-desk",
  timeoutMs: 1000,
  now: () => "2026-10-04T10:00:00.000Z",
};

describe("AI model transport boundary", () => {
  test("calls injected model transport with structured JSON expectations and redacted evidence", async () => {
    let captured: Parameters<AiModelHttpTransport>[0] | undefined;
    const result = await callAiModel(
      config,
      {
        promptVersion: "servicedesk-ai-v1-intake-2026-10-04",
        conversationId: "conv-1",
        workspaceId: "ws-clearnest",
        userText: "Need a deep clean in Camden tomorrow",
        approvedKnowledgeRefs: ["faq-clearnest-areas:areas-1"],
      },
      async (request) => {
        captured = request;
        return { status: 200, body: JSON.stringify({ output: { serviceCode: "DEEP", requestedDateText: "tomorrow", riskFlags: [], corrections: [], unsupportedReasons: [] } }) };
      },
    );

    expect(result.ok).toBe(true);
    expect(captured?.method).toBe("POST");
    expect(captured?.url).toBe("https://models.example.test/v1/responses");
    expect(captured?.headers.authorization).toBe("Bearer sk-ai-secret");
    const body = JSON.parse(captured?.body ?? "{}");
    expect(body.model).toBe("gpt-service-desk");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(JSON.stringify(result)).not.toContain("sk-ai-secret");
    expect(JSON.stringify(result)).not.toContain("Need a deep clean");
  });

  test("normalizes provider failures without leaking prompt or key", async () => {
    const rate = await callAiModel(config, { promptVersion: "v1", conversationId: "conv", workspaceId: "ws", userText: "private customer text" }, async () => ({ status: 429, body: "rate" }));
    const server = await callAiModel(config, { promptVersion: "v1", conversationId: "conv", workspaceId: "ws", userText: "private customer text" }, async () => ({ status: 503, body: "down" }));

    expect(rate).toMatchObject({ ok: false, code: "AI_MODEL_RATE_LIMITED" });
    expect(server).toMatchObject({ ok: false, code: "AI_MODEL_TRANSIENT_FAILURE" });
    expect(JSON.stringify([rate, server])).not.toContain("private customer text");
    expect(JSON.stringify([rate, server])).not.toContain("sk-ai-secret");
  });

  test("summarizes model requests without prompt text or credentials", async () => {
    const summary = redactedAiModelRequestSummary({
      url: "https://models.example.test/v1/responses",
      method: "POST",
      headers: { authorization: "Bearer sk-ai-secret", "content-type": "application/json" },
      body: JSON.stringify({ model: "gpt-service-desk", input: [{ role: "user", content: "secret prompt" }], response_format: { type: "json_object" } }),
      signal: new AbortController().signal,
    });

    expect(summary).toEqual({ method: "POST", host: "models.example.test", endpoint: "/v1/responses", hasBearerAuthorization: true, bodyKeys: ["input", "model", "response_format"] });
    expect(JSON.stringify(summary)).not.toContain("secret prompt");
    expect(JSON.stringify(summary)).not.toContain("sk-ai-secret");
  });
});
