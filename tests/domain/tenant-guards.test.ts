import { describe, expect, it } from "vitest";
import { canSeePrivateAccessNotes, requireRole, requireWorkspace } from "../../src/server/core/auth";

describe("tenant authorization guards", () => {
  it("denies an actor scoped to another workspace", () => {
    expect(requireWorkspace({workspaceId:"ws_a",userId:"u1",role:"OWNER"},"ws_b")).toEqual({
      ok:false, code:"WORKSPACE_MISMATCH", message:"Actor is not scoped to this workspace."
    });
  });

  it("denies an unauthorized role", () => {
    const result = requireRole({workspaceId:"ws_a",userId:"crew1",role:"CREW"},["OWNER","DISPATCHER"]);
    expect(result.ok).toBe(false);
  });

  it("does not reveal property access notes to unassigned crew", () => {
    expect(canSeePrivateAccessNotes({workspaceId:"ws_a",userId:"crew1",role:"CREW"},["crew2"])).toBe(false);
    expect(canSeePrivateAccessNotes({workspaceId:"ws_a",userId:"crew1",role:"CREW"},["crew1"])).toBe(true);
  });
});
