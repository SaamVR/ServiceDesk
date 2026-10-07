import { describe, expect, it, vi } from "vitest";
import { createPostgresBranchManagementPort } from "../../src/server/core/branch-management-postgres";
import type { SupabaseRpcClient } from "../../src/server/core/payment-application-postgres";

const owner = { workspaceId: "workspace-1", userId: "owner-1", role: "OWNER" as const };
const dispatcher = { workspaceId: "workspace-1", userId: "dispatcher-1", role: "DISPATCHER" as const };

describe("multi-branch Postgres boundary", () => {
  it("maps authorized branch access snapshots", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        snapshot: {
          workspaceId: "workspace-1",
          ownerGlobalAccess: false,
          branches: [{
            id: "branch-1",
            workspaceId: "workspace-1",
            code: "NORTH",
            name: "North",
            timezone: "America/New_York",
            currency: "USD",
            active: true,
            isDefault: false,
            version: 1,
          }],
          assignments: [{
            branchId: "branch-1",
            userId: "dispatcher-1",
            role: "DISPATCHER",
            active: true,
            version: 1,
          }],
        },
      },
      error: null,
    });
    const port = createPostgresBranchManagementPort({ rpc } as SupabaseRpcClient);
    await expect(port.readAccess(dispatcher)).resolves.toMatchObject({
      ok: true,
      value: {
        ownerGlobalAccess: false,
        branches: [{ id: "branch-1", code: "NORTH" }],
      },
    });
  });

  it("blocks non-owner branch management before RPC execution", async () => {
    const rpc = vi.fn();
    const port = createPostgresBranchManagementPort({ rpc } as SupabaseRpcClient);
    await expect(port.createBranch(dispatcher, {
      code: "NORTH",
      name: "North",
      timezone: "America/New_York",
      currency: "USD",
      now: "2026-10-07T00:00:00.000Z",
    })).resolves.toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("passes owner branch creation through the authoritative RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        branch: {
          id: "branch-2",
          workspaceId: "workspace-1",
          code: "SOUTH",
          name: "South",
          timezone: "America/Chicago",
          currency: "USD",
          active: true,
          isDefault: false,
          version: 1,
        },
      },
      error: null,
    });
    const port = createPostgresBranchManagementPort({ rpc } as SupabaseRpcClient);
    await expect(port.createBranch(owner, {
      code: "SOUTH",
      name: "South",
      timezone: "America/Chicago",
      currency: "USD",
      now: "2026-10-07T00:00:00.000Z",
    })).resolves.toMatchObject({ ok: true, value: { code: "SOUTH" } });
    expect(rpc).toHaveBeenCalledWith("servicedesk_create_workspace_branch", {
      p_input: expect.objectContaining({ workspaceId: "workspace-1", actorRole: "OWNER" }),
    });
  });
});
