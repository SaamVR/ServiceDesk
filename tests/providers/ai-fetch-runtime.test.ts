import { describe, expect, it } from "vitest";
import { createFetchAiModelTransport, AiModelResponseTooLargeError,
  MAX_AI_HTTP_RESPONSE_BYTES } from "../../src/server/ai/fetch-transport";
import { readConfiguredAiRuntimeConfig } from "../../src/server/ai/runtime-config";
import { callAiModel, type AiModelHttpRequest } from "../../src/server/ai/model-transport";

const input = {
  promptVersion: "v3", conversationId: "conv-1", workspaceId: "ws-1",
  userText: "Please prepare a reviewed quote.",
};
const server = {
  apiBaseUrl: "https://api.openai.com/v1",
  apiKey: "synthetic-not-production",
  model: "synthetic-model",
  now: () => "2026-10-11T03:00:00.000Z",
};
const sampleOutput = JSON.stringify({ output: {
  corrections: [], unsupportedReasons: [], riskFlags: [], serviceCode: "DEEP",
} });

describe("server-only AI model fetch", () => {
  it("sends an HTTPS no-store POST with redirect prevention and returns bounded JSON", async () => {
    let called = 0;
    const transport = createFetchAiModelTransport(async (url, init) => {
      called++;
      expect(url).toBe("https://api.openai.com/v1/responses");
      expect(init).toMatchObject({ method: "POST", cache: "no-store", redirect: "error" });
      expect((init.headers as Record<string, string>).authorization).toBe("Bearer synthetic-not-production");
      return new Response(sampleOutput, { status: 200, headers: { "content-type": "application/json" } });
    });
    expect(await callAiModel(server, input, transport)).toMatchObject({
      ok: true, value: { output: { serviceCode: "DEEP" } },
    });
    expect(called).toBe(1);
  });

  it("rejects HTTP downgrade, credentialed URL and query origin before sending", async () => {
    let calls = 0;
    const transport = createFetchAiModelTransport(async () => {
      calls++; return new Response(sampleOutput);
    });
    const request: AiModelHttpRequest = {
      url: "https://api.openai.com/v1/responses",
      method: "POST",
      headers: { authorization: "Bearer synthetic" },
      body: "{}", signal: new AbortController().signal,
    };
    for (const url of ["http://api.openai.com/v1/responses", "https://user:pass@api.openai.com/v1/responses",
      "https://api.openai.com/v1/responses?token=secret",
      "https://api.openai.com:8443/v1/responses",
      "https://api.openai.com/v1/other",
      "https://evil.example/v1/responses",
      "https://api.openai.com.attacker.org/v1/responses",
      "https://169.254.169.254/v1/responses",
      "https://api.openai.com/v1/responses#fragment", "not-a-url"]) {
      await expect(transport({ ...request, url })).rejects.toThrow("AI_MODEL_HTTP_URL_INVALID");
    }
    expect(calls).toBe(0);
  });

  it("ignores provider error payload content and honors normalized status only", async () => {
    const transport = createFetchAiModelTransport(async () =>
      new Response("Bearer provider-secret private@example.test", { status: 429 }));
    const result = await callAiModel(server, input, transport);
    expect(result).toMatchObject({ ok: false, code: "AI_MODEL_RATE_LIMITED" });
    expect(JSON.stringify(result)).not.toMatch(/provider-secret|private@example.test/);
  });

  it("classifies oversized streaming HTTP replies as invalid model output", async () => {
    const transport = createFetchAiModelTransport(async () =>
      new Response("X".repeat(MAX_AI_HTTP_RESPONSE_BYTES + 5), { status: 200 }));
    const result = await callAiModel(server, input, transport);
    expect(result).toMatchObject({ ok: false, code: "AI_MODEL_INVALID_RESPONSE" });
    expect(JSON.stringify(result)).not.toContain("X".repeat(50));
  });

  it("explicitly reports the bounded-response error when called directly", async () => {
    const transport = createFetchAiModelTransport(async () =>
      new Response("x", { status: 200, headers: { "content-length": String(MAX_AI_HTTP_RESPONSE_BYTES + 1) } }));
    await expect(transport({
      url: "https://api.openai.com/v1/responses", method: "POST", headers: {},
      body: "{}", signal: new AbortController().signal,
    })).rejects.toBeInstanceOf(AiModelResponseTooLargeError);
  });
});

describe("operational AI runtime enablement", () => {
  const configured = {
    SERVICEDESK_AI_ENABLED: "true", OPENAI_API_KEY: "synthetic-private-key",
    SERVICEDESK_AI_MODEL: "gpt-6",
  };
  it("defaults off even when credentials exist and never returns keys in errors", () => {
    const result = readConfiguredAiRuntimeConfig({ ...configured, SERVICEDESK_AI_ENABLED: "false" });
    expect(result).toMatchObject({ ok: false, code: "AI_RUNTIME_DISABLED" });
    expect(JSON.stringify(result)).not.toContain("synthetic-private-key");
  });

  it("accepts explicitly enabled exact official origin and bounded timeout", () => {
    const result = readConfiguredAiRuntimeConfig({
      ...configured, SERVICEDESK_AI_TIMEOUT_MS: "30000",
    });
    expect(result).toMatchObject({ ok: true, value: {
      apiBaseUrl: "https://api.openai.com/v1", model: "gpt-6", timeoutMs: 30_000,
    } });
  });

  it("rejects invalid or credential-bearing origins, malformed models and invalid budgets", () => {
    const mutations = [
      { SERVICEDESK_AI_API_BASE_URL: "http://api.openai.com/v1" },
      { SERVICEDESK_AI_API_BASE_URL: "https://api.openai.com/v1?unsafe=1" },
      { SERVICEDESK_AI_API_BASE_URL: "https://user:password@api.openai.com/v1" },
      { SERVICEDESK_AI_API_BASE_URL: "https://not-openai.example/v1" },
      { SERVICEDESK_AI_MODEL: "" },
      { SERVICEDESK_AI_TIMEOUT_MS: "Infinity" },
      { SERVICEDESK_AI_TIMEOUT_MS: "50" },
    ];
    for (const mutation of mutations) {
      expect(readConfiguredAiRuntimeConfig({ ...configured, ...mutation }).ok).toBe(false);
    }
  });
});
