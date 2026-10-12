import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllEnvs());
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AssistantTurn } from "../../src/server/ai/types";
import { handleStaffAiHttpPost } from "../../src/server/api-handlers/ai-staff-http";

const entry = { workspaceSlug: "service-desk", conversationId: "conv-1", messageId: "msg-1" };
const turn: AssistantTurn = {
  workspaceId: "ws-1", conversationId: "conv-1", savedHumanMessageId: "msg-1",
  extraction: { corrections: [], unsupportedReasons: [], riskFlags: [] },
  replyDraft: "Staff can prepare your estimate.",
  citations: [], toolCalls: [{
    name: "getServiceCatalog", arguments: { internal: "not-for-browser" },
    allowed: true, reason: "Safe proposal only",
  }],
  missingQuestions: [], handoverRequired: false, model: "synthetic-model",
  promptVersion: "test-v3", privateReasoningStored: false,
};
function makeRequest(body: string, headers: Record<string, string> = {}) {
  return new Request("https://desk.example.test/api/internal/ai/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://desk.example.test", ...headers },
    body,
  });
}
describe("same-origin operational AI draft HTTP boundary", () => {
  it("accepts only a valid command and returns a staff-review proposal with no executed tool arguments", async () => {
    let calls = 0;
    const r = await handleStaffAiHttpPost(makeRequest(JSON.stringify(entry)), async input => {
      calls++;
      expect(input).toEqual(entry);
      return { ok: true, value: turn };
    });
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("vary")).toBe("Cookie");
    expect(await r.json()).toEqual({
      state: "DRAFT_FOR_STAFF_REVIEW", conversationId: "conv-1",
      savedHumanMessageId: "msg-1", replyDraft: "Staff can prepare your estimate.",
      missingQuestions: [], citations: [], handoverRequired: false,
      toolProposals: [{ name: "getServiceCatalog", allowed: true, reason: "Safe proposal only" }],
    });
    expect(calls).toBe(1);
  });

  it("allows only a precisely configured public HTTPS origin behind a private Render proxy", async () => {
    vi.stubEnv("SERVICEDESK_AI_ALLOWED_ORIGIN", "https://servicedesk-review.example.test");
    const makeProxy = (origin: string, extraHeaders: Record<string, string> = {}) =>
      new Request("http://127.0.0.1:3000/api/internal/ai/draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "origin": origin,
          "sec-fetch-site": "same-origin",
          ...extraHeaders,
        },
        body: JSON.stringify(entry),
      });
    let calls = 0;
    const valid = await handleStaffAiHttpPost(
      makeProxy("https://servicedesk-review.example.test"),
      async () => { calls++; return { ok: true, value: turn }; },
    );
    expect(valid.status).toBe(200);
    expect(calls).toBe(1);
    for (const [origin,headers] of [
      ["https://evil.example.test", {}],
      ["https://servicedesk-review.example.test.evil.test", {}],
      ["https://evil.example.test", { "x-forwarded-host": "servicedesk-review.example.test" }],
      ["https://servicedesk-review.example.test", { "sec-fetch-site": "cross-site" }],
    ] as const) {
      const result=await handleStaffAiHttpPost(makeProxy(origin,headers),
        async () => {calls++; return {ok:true,value:turn};});
      expect(result.status).toBe(403);
    }
    expect(calls).toBe(1);
  });

  it("rejects invalid public-origin configurations without relying on forwarded request headers", async () => {
    for (const bad of [
      "http://servicedesk-review.example.test",
      "https://servicedesk-review.example.test:8443",
      "https://someone@servicedesk-review.example.test",
      "https://servicedesk-review.example.test/studio",
      "https://servicedesk-review.example.test?x=1",
    ]) {
      vi.stubEnv("SERVICEDESK_AI_ALLOWED_ORIGIN", bad);
      const response=await handleStaffAiHttpPost(
        new Request("http://internal:3000/api/internal/ai/draft", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "origin": "https://servicedesk-review.example.test",
            "x-forwarded-host": "servicedesk-review.example.test",
          },
          body: JSON.stringify(entry),
        }),
        async () => {throw Error("Unauthorized provider call");},
      );
      expect(response.status).toBe(403);
    }
  });

  it("rejects cross-origin browser requests before invoking the staff actor resolver", async () => {
    let calls = 0;
    const invalidHeaders: Array<Record<string, string>> = [
      { Origin: "https://untrusted.example.test" },
      { Origin: "" },
      { "sec-fetch-site": "cross-site" },
    ];
    for (const headers of invalidHeaders) {
      const r = await handleStaffAiHttpPost(makeRequest(JSON.stringify(entry), headers), async () => {
        calls++; return { ok: true, value: turn };
      });
      expect(r.status).toBe(403);
    }
    expect(calls).toBe(0);
  });

  it("rejects forged authority fields, bad IDs, non-object JSON and huge bodies without model calls", async () => {
    let calls = 0;
    for (const body of [
      JSON.stringify({ ...entry, role: "OWNER" }),
      JSON.stringify({ ...entry, workspaceSlug: "../other" }),
      JSON.stringify({ ...entry, messageId: "bad/id" }),
      "[]", "null", "not-json", "X".repeat(17000),
    ]) {
      const r = await handleStaffAiHttpPost(makeRequest(body), async () => {
        calls++; return { ok: true, value: turn };
      });
      expect(r.status).toBeGreaterThanOrEqual(400);
    }
    expect(calls).toBe(0);
  });

  it("does not leak backend errors and assigns conservative auth/feature status codes", async () => {
    for (const [code, status] of [
      ["AI_STAFF_UNAUTHORIZED", 401],
      ["AI_BRANCH_SCOPE_REQUIRED", 403],
      ["AI_MESSAGE_NOT_AUTHORIZED", 404],
      ["AI_RUNTIME_DISABLED", 503],
    ] as const) {
      const r = await handleStaffAiHttpPost(makeRequest(JSON.stringify(entry)), async () => ({
        ok: false, code, message: "private staff workspace record",
      }));
      expect(r.status).toBe(status);
      expect(await r.json()).toEqual({ code });
    }
  });

  it("does not reflect thrown provider errors and never returns success for thrown commands", async () => {
    const r = await handleStaffAiHttpPost(makeRequest(JSON.stringify(entry)), async () => {
      throw new Error("untrusted private network detail");
    });
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ code: "AI_STAFF_UNAVAILABLE" });
  });

  it("requires JSON content type", async () => {
    let called = false;
    const r = await handleStaffAiHttpPost(makeRequest(JSON.stringify(entry), {
      "Content-Type": "text/plain",
    }), async () => {
      called = true;
      return { ok: true, value: turn };
    });
    expect(r.status).toBe(415);
    expect(called).toBe(false);
  });
});

describe("integrated AI draft route handoff", () => {
  it("binds the staff-authenticated HTTP handler without separate frontend permission logic", () => {
    const source = readFileSync(join(process.cwd(), "src/app/api/internal/ai/draft/route.ts"), "utf8");
    expect(source).toContain('import { handleStaffAiHttpPost } from "@/server/api-handlers/ai-staff-http"');
    expect(source).toContain("return handleStaffAiHttpPost(request)");
    expect(source).toContain('export const dynamic = "force-dynamic"');
    expect(source).toContain('export const runtime = "nodejs"');
  });
});
