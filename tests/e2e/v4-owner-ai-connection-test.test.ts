import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  testAuthorizedAiModelConnection,
  type AiConnectionTestDependencies,
} from "../../src/server/ai/owner-provider-connection-test";
import { handleAiOwnerProbePost } from "../../src/server/api-handlers/ai-owner-probe-http";

function setup(role: "OWNER" | "DISPATCHER" = "OWNER", configured = true) {
  const resolveActor = vi.fn(async () => ({
    ok: true as const,
    value: {
      actor: { workspaceId: "workspace-demo", userId: "owner-1", role },
      workspace: { id: "workspace-demo", slug: "fictional-qa" },
      service: {},
    },
  }));
  const readConfig = vi.fn(() => configured ? ({
    ok: true as const,
    value: {
      apiBaseUrl: "https://api.openai.com/v1",
      apiKey: "not-a-live-key",
      model: "diagnostic-test",
      now: () => "2026-10-12T00:00:00.000Z",
    },
  }) : { ok: false as const, code: "AI_RUNTIME_DISABLED", message: "off" });
  const callModel = vi.fn(async (_config: unknown, payload: {
    userText: string; conversationId: string; workspaceId: string;
  }) => {
    expect(payload.userText).toContain("synthetic");
    expect(payload.userText).not.toContain("Casey Sample");
    expect(payload.userText).not.toContain("private@example.com");
    expect(payload.conversationId).toBe("synthetic-connection-probe");
    expect(payload.workspaceId).toBe("workspace-demo");
    return { ok: true as const, value: {
      output: {}, replyDraft: "ServiceDesk model probe acknowledged", requestedToolCalls: [], citations: [],
    } };
  });
  return { resolveActor, readConfig, callModel,
    deps: { resolveActor, readConfig, callModel } as unknown as AiConnectionTestDependencies };
}

describe("V4 owner-only actual model connection probe", () => {
  it("proves one authorized synthetic model response without any business action or persisted receipt", async () => {
    const t = setup();
    const result = await testAuthorizedAiModelConnection("fictional-qa", t.deps);
    expect(result).toMatchObject({ ok: true, value: {
      state: "PROVIDER_RESPONDED_TO_CONTROLLED_PROBE",
      model: "diagnostic-test",
      source: "REAL_MODEL_RESPONSE_NOT_A_PROVIDER_DELIVERY",
      durableReceipt: false,
    } });
    expect(t.callModel).toHaveBeenCalledOnce();
  });

  it("rejects dispatchers before configuration lookup or model invocation", async () => {
    const t = setup("DISPATCHER");
    expect(await testAuthorizedAiModelConnection("fictional-qa", t.deps))
      .toMatchObject({ ok: false, code: "AI_DIAGNOSTIC_OWNER_REQUIRED" });
    expect(t.callModel).not.toHaveBeenCalled();
    expect(t.readConfig).not.toHaveBeenCalled();
  });

  it("fails closed on disabled AI without charging the provider", async () => {
    const t = setup("OWNER", false);
    expect(await testAuthorizedAiModelConnection("fictional-qa", t.deps))
      .toMatchObject({ ok: false, code: "AI_RUNTIME_DISABLED" });
    expect(t.callModel).not.toHaveBeenCalled();
  });

  it("refuses an unexpectedly different model answer or proposed tool call", async () => {
    const t = setup();
    const rogueModel = vi.fn(async () => ({
      ok: true as const, value: { output: {}, replyDraft: "Unexpected response",
        requestedToolCalls: [{ name: "sendWhatsapp" }], citations: [] },
    }));
    const deps: AiConnectionTestDependencies = {
      ...t.deps,
      callModel: rogueModel as unknown as NonNullable<AiConnectionTestDependencies["callModel"]>,
    };
    expect(await testAuthorizedAiModelConnection("fictional-qa", deps))
      .toMatchObject({ ok: false, code: "AI_DIAGNOSTIC_RESPONSE_UNVERIFIED" });
  });

  it("accepts only same-origin, bounded owner-triggered POSTs", async () => {
    const run = vi.fn(async () => ({ ok: false as const, code: "AI_RUNTIME_DISABLED", message: "off" }));
    const make = (data: unknown, origin: string) => new Request(
      "https://studio.example/api/internal/ai/connection-test", {
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify(data),
      },
    );
    expect((await handleAiOwnerProbePost(make({ workspaceSlug: "fictional-qa" }, "https://other.example"), run)).status).toBe(403);
    expect((await handleAiOwnerProbePost(make({ workspaceSlug: "fictional-qa", admin: true }, "https://studio.example"), run)).status).toBe(400);
    expect(run).not.toHaveBeenCalled();
    const response = await handleAiOwnerProbePost(make({ workspaceSlug: "fictional-qa" }, "https://studio.example"), run);
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(run).toHaveBeenCalledOnce();
  });

  it("exposes diagnostic only on the protected owner Automation route", () => {
    const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
    const status = read("src/features/operations/AiOperationsStatus.tsx");
    const ops = read("src/features/operations/OperationalProductRoute.tsx");
    expect(status).toContain("allowOwnerModelTest && !compact");
    expect(ops).toContain('allowOwnerModelTest={data.actor.role === "OWNER"}');
    expect(read("src/features/operations/AiOwnerModelProbe.tsx")).toContain("ephemeral connection test");
    expect(read("src/app/api/internal/ai/connection-test/route.ts")).toContain("handleAiOwnerProbePost");
  });
});
