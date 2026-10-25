import { describe, expect, it } from "vitest";
import { callAiModel } from "../../src/server/ai/model-transport";

const config = {
  apiBaseUrl: "https://api.openai.com/v1", apiKey: "fictional-unit-test-key",
  model: "synthetic-r52-inert-review", now: () => "2026-10-25T00:00:00.000Z",
};
const input = {
  promptVersion: "r52-reserved-argument-guard",
  conversationId: "synthetic-conversation",
  workspaceId: "synthetic-tenant",
  userText: "Review only; do not invoke any tools",
};
const accept = (requestedToolCalls: unknown) =>
  callAiModel(config, input, async () => ({
    status: 200, body: JSON.stringify({ output: {}, requestedToolCalls }),
  }));

describe("R52 AI inert proposed-tool nested key safety", () => {
  it("preserves genuine flat and bounded nested reviewed proposals without executing them", async () => {
    expect(await accept([{ name: "getServiceCatalog", arguments: {
      serviceCode: "DEEP", region: { code: "BD", tags: ["clean", "safe"] },
    } }])).toMatchObject({ ok: true, value: {
      requestedToolCalls: [{ name: "getServiceCatalog",
        arguments: { region: { code: "BD" } } }],
    } });
  });

  it("rejects JavaScript prototype and method names as model tool identifiers", async () => {
    for (const name of ["constructor", "prototype", "toString", "valueOf",
      "hasOwnProperty", "propertyIsEnumerable", "isPrototypeOf", "toLocaleString"]) {
      expect(await accept([{ name, arguments: {} }])).toMatchObject({
        ok: false, code: "AI_MODEL_INVALID_RESPONSE",
      });
    }
  });

  it("rejects pollution-bearing keys at all nesting depths, including arrays", async () => {
    for (const key of ["__proto__", "constructor", "prototype"]) {
      for (const args of [
        { [key]: { polluted: true } },
        { safe: { [key]: "pollute" } },
        { array: [{ safe: true }, { nested: { [key]: "pollute" } }] },
      ]) {
        const result = await accept([{ name: "getServiceCatalog", arguments: args }]);
        expect(result).toMatchObject({ ok: false, code: "AI_MODEL_INVALID_RESPONSE" });
        expect(JSON.stringify(result)).not.toContain("fictional-unit-test-key");
      }
    }
  });

  it("bounds deeply nested and massive fanout argument graphs before acceptance", async () => {
    let nested: unknown = "leaf";
    for (let depth = 0; depth < 10; depth++) nested = { child: nested };
    expect(await accept([{ name: "getServiceCatalog", arguments: { nested } }]))
      .toMatchObject({ ok: false, code: "AI_MODEL_INVALID_RESPONSE" });
    expect(await accept([{ name: "getServiceCatalog",
      arguments: { records: Array.from({ length: 65 }, (_, i) => i) },
    }])).toMatchObject({ ok: false, code: "AI_MODEL_INVALID_RESPONSE" });
  });
});
