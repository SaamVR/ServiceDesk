import type { ActorContext, ActorRole, Result } from "../../contracts";

const STAFF_ROLES: ReadonlySet<ActorRole> = new Set(["OWNER","DISPATCHER","CREW"]);

export function requireWorkspace(ctx: ActorContext, workspaceId: string): Result<true> {
  if (ctx.workspaceId !== workspaceId) {
    return { ok:false, code:"WORKSPACE_MISMATCH", message:"Actor is not scoped to this workspace." };
  }
  return { ok:true, value:true };
}

export function requireRole(ctx: ActorContext, allowed: readonly ActorRole[]): Result<true> {
  if (!allowed.includes(ctx.role)) {
    return { ok:false, code:"FORBIDDEN", message:"Role is not authorized for this action." };
  }
  return { ok:true, value:true };
}

export function requireActiveStaffContext(ctx: ActorContext): Result<true> {
  if (!ctx.userId || !STAFF_ROLES.has(ctx.role)) {
    return { ok:false, code:"STAFF_AUTH_REQUIRED", message:"Verified staff membership is required." };
  }
  return { ok:true, value:true };
}

export function canSeePrivateAccessNotes(ctx: ActorContext, assignedCrewUserIds: readonly string[]): boolean {
  if (ctx.role === "OWNER" || ctx.role === "DISPATCHER") return Boolean(ctx.userId);
  return ctx.role === "CREW" && Boolean(ctx.userId) && assignedCrewUserIds.includes(ctx.userId!);
}
