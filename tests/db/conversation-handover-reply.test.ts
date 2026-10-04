import { describe, expect, it } from "vitest";
import { createConversationFacadeMethods } from "../../src/server/core/inbound-message";

describe("conversation handover and reply guards", () => {
  it("requires staff auth before handover repository access", async () => {
    const facade = createConversationFacadeMethods({ conversationRepository: { transaction: async () => { throw new Error("should not run"); } } });
    await expect(facade.setConversationHandover({ workspaceId: "ws_1", role: "VISITOR", visitorSessionId: "v1" }, "conv_1", { active: true }, { idempotencyKey: "h1", now: "2026-10-04T06:00:00.000Z", expectedVersion: 1 })).resolves.toEqual({ ok: false, code: "STAFF_AUTH_REQUIRED", message: "Verified staff membership is required." });
  });

  it("requires expectedVersion for staff replies", async () => {
    const facade = createConversationFacadeMethods({ conversationRepository: { transaction: async () => { throw new Error("should not run"); } } });
    await expect(facade.enqueueConversationReply({ workspaceId: "ws_1", role: "OWNER", userId: "owner_1" }, "conv_1", { body: "hello", channel: "WHATSAPP" }, { idempotencyKey: "r1", now: "2026-10-04T06:00:00.000Z" })).resolves.toEqual({ ok: false, code: "EXPECTED_VERSION_REQUIRED", message: "Conversation reply requires an expected version." });
  });
});
