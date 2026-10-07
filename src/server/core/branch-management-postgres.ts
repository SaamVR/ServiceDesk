import type {
  ActorContext,
  BranchAccessSnapshotDTO,
  BranchAssignmentDTO,
  Result,
  WorkspaceBranchDTO,
} from "../../contracts";
import type { SupabaseRpcClient } from "./payment-application-postgres";

type Row = Record<string, unknown>;

function fail<T>(code: string, message: string): Result<T> {
  return { ok: false, code, message };
}
function obj(value: unknown): Row | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Row : undefined;
}
function text(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || !value) throw new Error(`Malformed branch response: ${key}`);
  return value;
}
function number(row: Row, key: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Malformed branch response: ${key}`);
  return value;
}
function mapBranch(value: unknown): WorkspaceBranchDTO {
  const row = obj(value);
  if (!row) throw new Error("Malformed branch response");
  return {
    id: text(row, "id"),
    workspaceId: text(row, "workspaceId"),
    code: text(row, "code"),
    name: text(row, "name"),
    timezone: text(row, "timezone"),
    currency: text(row, "currency"),
    active: row.active === true,
    isDefault: row.isDefault === true,
    version: number(row, "version"),
  };
}
function mapAssignment(value: unknown): BranchAssignmentDTO {
  const row = obj(value);
  if (!row) throw new Error("Malformed branch assignment");
  const role = text(row, "role");
  if (role !== "OWNER" && role !== "DISPATCHER" && role !== "CREW") {
    throw new Error("Malformed branch assignment: role");
  }
  return {
    branchId: text(row, "branchId"),
    userId: text(row, "userId"),
    role,
    active: row.active === true,
    version: number(row, "version"),
  };
}

export interface BranchManagementPort {
  readAccess(ctx: ActorContext): Promise<Result<BranchAccessSnapshotDTO>>;
  createBranch(
    ctx: ActorContext,
    input: { code: string; name: string; timezone: string; currency: string; now: string },
  ): Promise<Result<WorkspaceBranchDTO>>;
  updateBranch(
    ctx: ActorContext,
    input: { branchId: string; name: string; timezone: string; currency: string; active: boolean; expectedVersion: number; now: string },
  ): Promise<Result<WorkspaceBranchDTO>>;
  setAssignment(
    ctx: ActorContext,
    input: { branchId: string; targetUserId: string; active: boolean; now: string },
  ): Promise<Result<{ branchId: string; userId: string; active: boolean; ownerGlobalAccess: boolean }>>;
}

export function createPostgresBranchManagementPort(client: SupabaseRpcClient): BranchManagementPort {
  return {
    async readAccess(ctx) {
      if (!ctx.userId || !["OWNER", "DISPATCHER", "CREW"].includes(ctx.role)) {
        return fail("FORBIDDEN", "Active staff access is required.");
      }
      const { data, error } = await client.rpc<Row>("servicedesk_read_branch_access_snapshot", {
        p_input: {
          workspaceId: ctx.workspaceId,
          actorUserId: ctx.userId,
          actorRole: ctx.role,
        },
      });
      if (error) return fail(error.code ?? "BRANCH_READ_RPC_ERROR", error.message);
      if (!data || data.ok !== true || !obj(data.snapshot)) {
        return fail(String(data?.code ?? "BRANCH_READ_RPC_REJECTED"), "Branch access could not be loaded.");
      }
      try {
        const snapshot = obj(data.snapshot)!;
        return {
          ok: true,
          value: {
            workspaceId: text(snapshot, "workspaceId"),
            ownerGlobalAccess: snapshot.ownerGlobalAccess === true,
            branches: Array.isArray(snapshot.branches) ? snapshot.branches.map(mapBranch) : [],
            assignments: Array.isArray(snapshot.assignments) ? snapshot.assignments.map(mapAssignment) : [],
          },
        };
      } catch (error) {
        return fail("BRANCH_READ_RPC_MALFORMED", error instanceof Error ? error.message : "Malformed branch access.");
      }
    },

    async createBranch(ctx, input) {
      if (!ctx.userId || ctx.role !== "OWNER") return fail("FORBIDDEN", "Only an owner can create branches.");
      const { data, error } = await client.rpc<Row>("servicedesk_create_workspace_branch", {
        p_input: {
          workspaceId: ctx.workspaceId,
          actorUserId: ctx.userId,
          actorRole: ctx.role,
          ...input,
        },
      });
      if (error) return fail(error.code ?? "BRANCH_CREATE_RPC_ERROR", error.message);
      if (!data || data.ok !== true) return fail(String(data?.code ?? "BRANCH_CREATE_RPC_REJECTED"), "Branch could not be created.");
      try {
        return { ok: true, value: mapBranch(data.branch) };
      } catch (error) {
        return fail("BRANCH_CREATE_RPC_MALFORMED", error instanceof Error ? error.message : "Malformed branch response.");
      }
    },

    async updateBranch(ctx, input) {
      if (!ctx.userId || ctx.role !== "OWNER") return fail("FORBIDDEN", "Only an owner can update branches.");
      const { data, error } = await client.rpc<Row>("servicedesk_update_workspace_branch", {
        p_input: {
          workspaceId: ctx.workspaceId,
          actorUserId: ctx.userId,
          actorRole: ctx.role,
          ...input,
        },
      });
      if (error) return fail(error.code ?? "BRANCH_UPDATE_RPC_ERROR", error.message);
      if (!data || data.ok !== true) return fail(String(data?.code ?? "BRANCH_UPDATE_RPC_REJECTED"), "Branch could not be updated.");
      try {
        return { ok: true, value: mapBranch(data.branch) };
      } catch (error) {
        return fail("BRANCH_UPDATE_RPC_MALFORMED", error instanceof Error ? error.message : "Malformed branch response.");
      }
    },

    async setAssignment(ctx, input) {
      if (!ctx.userId || ctx.role !== "OWNER") return fail("FORBIDDEN", "Only an owner can manage branch assignments.");
      const { data, error } = await client.rpc<Row>("servicedesk_set_branch_membership", {
        p_input: {
          workspaceId: ctx.workspaceId,
          actorUserId: ctx.userId,
          actorRole: ctx.role,
          ...input,
        },
      });
      if (error) return fail(error.code ?? "BRANCH_ASSIGN_RPC_ERROR", error.message);
      if (!data || data.ok !== true) return fail(String(data?.code ?? "BRANCH_ASSIGN_RPC_REJECTED"), "Branch assignment could not be changed.");
      return {
        ok: true,
        value: {
          branchId: String(data.branchId),
          userId: String(data.userId),
          active: data.active === true,
          ownerGlobalAccess: data.ownerGlobalAccess === true,
        },
      };
    },
  };
}
