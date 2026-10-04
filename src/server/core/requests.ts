import type { ActorContext, CommandMeta, Result } from "../../contracts";
import { requireActiveStaffContext, requireRole, requireWorkspace } from "./auth";

export type CoreRequestStatus = "NEW" | "COLLECTING" | "READY" | "NEEDS_REVIEW" | "QUOTED" | "BOOKED" | "LOST" | "CLOSED";

export interface RequestRecord {
  id: string;
  workspaceId: string;
  customerId?: string;
  propertyId?: string;
  serviceCode?: string;
  visitorSessionId?: string;
  status: CoreRequestStatus;
  bedrooms?: number;
  bathrooms?: number;
  requestedStartAt?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRequestRecordInput {
  workspaceId: string;
  customerId?: string;
  propertyId?: string;
  serviceCode?: string;
  visitorSessionId?: string;
  bedrooms?: number;
  bathrooms?: number;
  requestedStartAt?: string;
}

export type RequestPatch = Partial<Pick<RequestRecord, "propertyId" | "serviceCode" | "bedrooms" | "bathrooms" | "requestedStartAt" | "status">>;

export interface RequestRepository {
  insert(request: RequestRecord, meta: CommandMeta): Promise<Result<RequestRecord>>;
  findById(workspaceId: string, id: string): Promise<Result<RequestRecord>>;
  update(request: RequestRecord, meta: CommandMeta): Promise<Result<RequestRecord>>;
}

function authorizeRequestMutation(ctx: ActorContext, request: Pick<RequestRecord, "workspaceId" | "visitorSessionId">): Result<true> {
  const workspace = requireWorkspace(ctx, request.workspaceId);
  if (workspace.ok === false) return { ok: false, code: workspace.code, message: workspace.message };

  if (ctx.role === "VISITOR") {
    if (ctx.visitorSessionId && request.visitorSessionId && ctx.visitorSessionId === request.visitorSessionId) {
      return { ok: true, value: true };
    }
    return { ok: false, code: "VISITOR_SCOPE_REQUIRED", message: "Visitor session cannot access this request." };
  }

  const staff = requireActiveStaffContext(ctx);
  if (staff.ok === false) return staff;
  return requireRole(ctx, ["OWNER", "DISPATCHER"]);
}

export function createRequestRecord(
  ctx: ActorContext,
  input: CreateRequestRecordInput,
  meta: CommandMeta,
  createId: () => string,
): Result<RequestRecord> {
  const workspace = requireWorkspace(ctx, input.workspaceId);
  if (workspace.ok === false) return { ok: false, code: workspace.code, message: workspace.message };

  if (ctx.role === "VISITOR") {
    if (!ctx.visitorSessionId || input.visitorSessionId !== ctx.visitorSessionId) {
      return { ok: false, code: "VISITOR_SCOPE_REQUIRED", message: "Visitor request must match the actor session." };
    }
  } else {
    const staff = requireActiveStaffContext(ctx);
    if (staff.ok === false) return { ok: false, code: staff.code, message: staff.message };
    const role = requireRole(ctx, ["OWNER", "DISPATCHER"]);
    if (role.ok === false) return { ok: false, code: role.code, message: role.message };
  }

  return {
    ok: true,
    value: {
      id: createId(),
      workspaceId: input.workspaceId,
      customerId: input.customerId,
      propertyId: input.propertyId,
      serviceCode: input.serviceCode,
      visitorSessionId: input.visitorSessionId,
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      requestedStartAt: input.requestedStartAt,
      status: "NEW",
      version: 1,
      createdAt: meta.now,
      updatedAt: meta.now,
    },
  };
}

export function updateRequestRecord(
  ctx: ActorContext,
  request: RequestRecord,
  patch: RequestPatch,
  meta: CommandMeta,
): Result<RequestRecord> {
  const authorized = authorizeRequestMutation(ctx, request);
  if (authorized.ok === false) return { ok: false, code: authorized.code, message: authorized.message };

  if (ctx.role === "VISITOR" && patch.status !== undefined) {
    return { ok: false, code: "VISITOR_STATUS_MUTATION_FORBIDDEN", message: "Visitors cannot directly change request lifecycle status." };
  }

  if (meta.expectedVersion !== undefined && meta.expectedVersion !== request.version) {
    return { ok: false, code: "VERSION_CONFLICT", message: "Request version changed before this command was applied." };
  }

  return {
    ok: true,
    value: {
      ...request,
      ...patch,
      version: request.version + 1,
      updatedAt: meta.now,
    },
  };
}

export async function createRequestWithRepository(
  ctx: ActorContext,
  input: CreateRequestRecordInput,
  meta: CommandMeta,
  repository: RequestRepository,
  createId: () => string,
): Promise<Result<RequestRecord>> {
  const created = createRequestRecord(ctx, input, meta, createId);
  if (created.ok === false) return created;
  return repository.insert(created.value, meta);
}

export async function updateRequestWithRepository(
  ctx: ActorContext,
  requestId: string,
  patch: RequestPatch,
  meta: CommandMeta,
  repository: RequestRepository,
): Promise<Result<RequestRecord>> {
  const existing = await repository.findById(ctx.workspaceId, requestId);
  if (existing.ok === false) return existing;

  const updated = updateRequestRecord(ctx, existing.value, patch, meta);
  if (updated.ok === false) return updated;

  return repository.update(updated.value, meta);
}
