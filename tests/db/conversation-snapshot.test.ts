import { describe, expect, it } from "vitest";
import { createConversationFacadeMethods } from "../../src/server/core/inbound-message";

describe("conversation snapshot authorization", () => {
  it("denies visitor inbox snapshots before repository access", async () => {
    const facade = createConversationFacadeMethods({ conversationRepository: { transaction: async () => { throw new Error("should not run"); } } });
    await expect(facade.readWorkspaceSnapshot({ workspaceId: "ws_1", role: "VISITOR", visitorSessionId: "v1" }, {})).resolves.toEqual({ ok: false, code: "FORBIDDEN", message: "Role is not authorized for workspace inbox snapshots." });
  });
});
