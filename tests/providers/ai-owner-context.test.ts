import { describe, expect, test } from "vitest";
import { buildOwnerAssistantContext } from "../../src/server/ai/owner-context";

describe("owner assistant safe context", () => {
  test("creates a read-only owner context from explicit source snapshots only", () => {
    const context = buildOwnerAssistantContext({
      actor: { workspaceId: "ws-clearnest", role: "OWNER", userId: "owner-1" },
      now: "2026-10-04T08:00:00.000Z",
      metrics: {
        workspaceId: "ws-clearnest",
        from: "2026-10-01T00:00:00.000Z",
        to: "2026-10-04T08:00:00.000Z",
        source: "CORE_METRICS",
        metrics: { OPEN_REQUESTS: 4, UNANSWERED_CONVERSATIONS: 2 },
      },
      providerSummaries: [
        { provider: "WHATSAPP", evidenceVerification: "CONTRACT_TESTED", summary: "2 retryable status callbacks" },
      ],
    });

    expect(context).toMatchObject({
      ok: true,
      value: {
        workspaceId: "ws-clearnest",
        actorRole: "OWNER",
        readOnly: true,
        aiAuthoritative: false,
        canMutateBusinessTruth: false,
        generatedAt: "2026-10-04T08:00:00.000Z",
      },
    });
    if (context.ok) {
      expect(context.value.sources).toEqual(["CORE_METRICS", "PROVIDER_SUMMARY"]);
      expect(JSON.stringify(context.value)).not.toContain("secret");
    }
  });

  test("rejects non-owner and cross-workspace contexts", () => {
    const metrics = {
      workspaceId: "ws-clearnest",
      from: "2026-10-01T00:00:00.000Z",
      to: "2026-10-04T08:00:00.000Z",
      source: "CORE_METRICS" as const,
      metrics: { OPEN_REQUESTS: 4 },
    };

    expect(buildOwnerAssistantContext({ actor: { workspaceId: "ws-clearnest", role: "DISPATCHER", userId: "user-1" }, now: "2026-10-04T08:00:00.000Z", metrics })).toMatchObject({ ok: false, code: "OWNER_ROLE_REQUIRED" });
    expect(buildOwnerAssistantContext({ actor: { workspaceId: "ws-other", role: "OWNER", userId: "owner-1" }, now: "2026-10-04T08:00:00.000Z", metrics })).toMatchObject({ ok: false, code: "WORKSPACE_MISMATCH" });
  });
});
