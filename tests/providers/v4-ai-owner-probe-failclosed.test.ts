import { describe, expect, it, vi } from "vitest";
import { testAuthorizedAiModelConnection, type AiConnectionTestDependencies } from
  "../../src/server/ai/owner-provider-connection-test";

const workspaceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const checkedAt = "2026-10-13T00:00:00.000Z";
const configuration = {
  apiBaseUrl: "https://api.openai.com/v1",
  apiKey: "synthetic-key-never-used",
  model: "synthetic-model-id",
  now: () => checkedAt,
};

function fixture(overrides: {
  role?: string;
  otherTenant?: boolean;
  throwAuth?: boolean;
  throwConfig?: boolean;
  throwProvider?: boolean;
  replyDraft?: string;
  output?: Record<string, unknown>;
  tools?: Array<{ name: string }>;
  citations?: Array<{ documentId: string }>;
} = {}) {
  const resolveActor = vi.fn(async () => {
    if (overrides.throwAuth) throw Error("secret-session-unavailable");
    return { ok: true, value: {
      workspace: { id: workspaceId, slug: "sample-owner" },
      actor: {
        userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        workspaceId: overrides.otherTenant ? "other" : workspaceId,
        role: overrides.role ?? "OWNER",
      },
    } };
  });
  const readConfig = vi.fn(() => {
    if (overrides.throwConfig) throw Error("private-provider-api-key");
    return { ok: true, value: configuration };
  });
  const callModel = vi.fn(async () => {
    if (overrides.throwProvider) throw Error("provider payload with secret-token");
    return { ok: true, value: {
      output: overrides.output ?? {},
      replyDraft: overrides.replyDraft ?? "ServiceDesk model probe acknowledged",
      requestedToolCalls: overrides.tools ?? [],
      citations: overrides.citations ?? [],
    } };
  });
  const deps = { resolveActor, readConfig, callModel } as unknown as AiConnectionTestDependencies;
  return { deps, resolveActor, readConfig, callModel };
}

describe("real owner-only AI model probe safe failure boundary", () => {
  it("only a verified owner may invoke the probe", async () => {
    for (const condition of [{role:"DISPATCHER"}, {otherTenant:true}, {throwAuth:true}]) {
      const f = fixture(condition);
      const result = await testAuthorizedAiModelConnection("sample-owner",f.deps);
      expect(result.ok).toBe(false);
      expect(f.callModel).not.toHaveBeenCalled();
      expect(f.readConfig).not.toHaveBeenCalled();
    }
  });
  it("normalizes thrown configuration errors without leaking secret values", async () => {
    const f = fixture({throwConfig:true});
    const result = await testAuthorizedAiModelConnection("sample-owner",f.deps);
    expect(result).toMatchObject({ok:false,code:"AI_DIAGNOSTIC_CONFIGURATION_UNAVAILABLE"});
    expect(f.callModel).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("private-provider-api-key");
  });
  it("normalizes transport exceptions without echoing provider content", async () => {
    const f = fixture({throwProvider:true});
    const result = await testAuthorizedAiModelConnection("sample-owner",f.deps);
    expect(result).toMatchObject({ok:false,code:"AI_DIAGNOSTIC_PROVIDER_FAILED"});
    expect(JSON.stringify(result)).not.toContain("secret-token");
    expect(f.callModel).toHaveBeenCalledTimes(1);
  });
  it.each([
    {output:{customerName:"fictional"}},
    {tools:[{name:"sendWhatsApp"}]},
    {citations:[{documentId:"private"}]},
    {replyDraft:"Unexpected response to synthetic probe"},
  ])("rejects a response containing non-probe content or requested action (%j)", async condition => {
    const f = fixture(condition);
    const result = await testAuthorizedAiModelConnection("sample-owner",f.deps);
    expect(result).toMatchObject({ok:false,code:"AI_DIAGNOSTIC_RESPONSE_UNVERIFIED"});
  });
  it("accepts only the exact action-free synthetic response and labels it as ephemeral", async () => {
    const f = fixture();
    const result = await testAuthorizedAiModelConnection("sample-owner",f.deps);
    expect(result).toMatchObject({ok:true,value:{
      state:"PROVIDER_RESPONDED_TO_CONTROLLED_PROBE",
      durableReceipt:false,
      source:"REAL_MODEL_RESPONSE_NOT_A_PROVIDER_DELIVERY",
      checkedAt,
    }});
    expect(f.callModel).toHaveBeenCalledTimes(1);
    const call = f.callModel.mock.calls[0];
    expect(JSON.stringify(call)).not.toContain("synthetic-key-never-used");
  });
});
