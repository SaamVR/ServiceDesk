import { describe, expect, it } from "vitest";
import { createServerCommandEntrypoints } from "../../src/server/core/server-entrypoints";

describe("server command entrypoints", () => {
  it("exposes only accepted E02 command boundaries", () => {
    const commands = createServerCommandEntrypoints({} as never);
    expect(Object.keys(commands).sort()).toEqual([
      "calculateQuoteCommand",
      "createRequestCommand",
      "findSlotsCommand",
      "holdSlotCommand",
      "readPropertySnapshotCommand",
      "sendQuoteCommand",
      "updateRequestCommand",
    ].sort());
    expect("applyVerifiedPayment" in commands).toBe(false);
    expect("transitionVisit" in commands).toBe(false);
    expect("readWorkspaceSnapshot" in commands).toBe(false);
  });
});
