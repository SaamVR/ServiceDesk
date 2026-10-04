import { describe, expect, it } from "vitest";
import { createServerCommandEntrypoints } from "../../src/server/core/server-entrypoints";

describe("server command entrypoints", () => {
  it("exposes the accepted integrated command/read boundaries", () => {
    const commands = createServerCommandEntrypoints({} as never);
    expect(Object.keys(commands).sort()).toEqual([
      "applyInboundMessageCommand",
      "applyVerifiedPaymentCommand",
      "calculateQuoteCommand",
      "createRequestCommand",
      "enqueueConversationReplyCommand",
      "findSlotsCommand",
      "holdSlotCommand",
      "readPropertySnapshotCommand",
      "readWorkspaceSnapshotCommand",
      "sendQuoteCommand",
      "setConversationHandoverCommand",
      "updateRequestCommand",
    ].sort());
    expect("transitionVisit" in commands).toBe(false);
  });
});
