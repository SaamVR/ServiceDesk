import { describe, expect, it } from "vitest";
import { callAiModel } from "../../src/server/ai/model-transport";

const config = {
  apiBaseUrl: "https://api.openai.com/v1",
  apiKey: "fictional-test-key",
  model: "synthetic-r51-model",
  now: () => "2026-10-25T00:00:00.000Z",
};
const input = {
  promptVersion: "r51-tool-citation-guard",
  conversationId: "synthetic-conversation",
  workspaceId: "synthetic-workspace",
  userText: "Synthetic merchant review, no provider send",
};
const response = (payload: unknown) =>
  callAiModel(config, input, async () => ({ status: 200, body: JSON.stringify(payload) }));

describe("R51 model-proposed tool and citation transport authority", () => {
  it("keeps correctly shaped proposals inert for downstream human and tenant approval", async () => {
    const result = await response({
      output: {}, replyDraft: "Owner must review saved source.",
      requestedToolCalls: [
        { name: "getServiceCatalog", arguments: { serviceCode: "DEEP" } },
        { name: "getOperatingHours" },
      ],
      citations: [{ documentId: "doc-1", title: "Approved catalog", version: 2, chunkId: "part-1" }],
    });
    expect(result).toMatchObject({ ok: true, value: {
      requestedToolCalls: [
        { name: "getServiceCatalog", arguments: { serviceCode: "DEEP" } },
        { name: "getOperatingHours" },
      ],
      citations: [{ documentId: "doc-1", version: 2 }],
    } });
  });

  it("does not launder malformed model action proposals into a typed response", async () => {
    for (const bad of [
      [null], [true], ["send_invoice"], [{}],
      [{ name: "" }], [{ name: "bad action" }],
      [{ name: "getServiceCatalog", arguments: [] }],
      [{ name: "getServiceCatalog", arguments: null }],
      [{ name: "getServiceCatalog", arguments: { note: "x".repeat(8_193) } }],
      [{ name: "getServiceCatalog", arguments: Object.fromEntries(
        Array.from({ length: 25 }, (_, index) => ["key" + index, index])) }],
      [{ name: "getServiceCatalog", providerConfirmed: true }],
    ]) {
      const result = await response({ output: {}, requestedToolCalls: bad });
      expect(result).toMatchObject({ ok: false, code: "AI_MODEL_INVALID_RESPONSE" });
      expect(JSON.stringify(result)).not.toContain("fictional-test-key");
    }
  });

  it("refuses unsupported citation fields and forged source identities", async () => {
    const good = { documentId: "doc-1", title: "Catalog", version: 1, chunkId: "chunk-1" };
    for (const bad of [
      [null], ["doc-1"], [{}],
      [{ ...good, documentId: "" }], [{ ...good, chunkId: "x".repeat(129) }],
      [{ ...good, title: "x".repeat(201) }],
      [{ ...good, version: 0 }], [{ ...good, version: 1.5 }],
      [{ ...good, version: Number.MAX_SAFE_INTEGER }],
      [{ ...good, approvedByOwner: true }],
      Array.from({ length: 21 }, () => good),
    ]) {
      expect(await response({ output: {}, citations: bad })).toMatchObject({
        ok: false, code: "AI_MODEL_INVALID_RESPONSE",
      });
    }
  });

  it("accepts omitted or empty proposals, preserving review-only results", async () => {
    for (const payload of [
      { output: {} },
      { output: {}, requestedToolCalls: [], citations: [] },
    ]) expect(await response(payload)).toMatchObject({ ok: true });
  });
});
