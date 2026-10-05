import type { Result, VisitChecklistItemDTO, VisitDTO, VisitEvidenceDTO } from "../../contracts";
import type { AddVisitEvidenceInput, AssignCrewInput, ServiceDeskFacade, SetVisitChecklistItemInput, VisitAction } from "./facade";
import type { SupabaseRpcClient } from "./payment-application-postgres";
import type { ActorContext, CommandMeta } from "../../contracts";

type RpcRow = Record<string, unknown>;

const dbVisitStatusToDto: Record<string, VisitDTO["status"]> = {
  SCHEDULED: "CONFIRMED",
  CONFIRMED: "CONFIRMED",
  ASSIGNED: "ASSIGNED",
  EN_ROUTE: "EN_ROUTE",
  IN_PROGRESS: "IN_PROGRESS",
  NEEDS_REVIEW: "PENDING_REVIEW",
  PENDING_REVIEW: "PENDING_REVIEW",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  PAYMENT_REVIEW: "PAYMENT_REVIEW",
  AWAITING_PAYMENT: "AWAITING_PAYMENT",
};

function fail<T>(code: string, message: string): Result<T> {
  return { ok: false, code, message };
}

function requireString(row: RpcRow, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`Malformed RPC payload: ${key}`);
  return value;
}

function optionalString(row: RpcRow, key: string): string | undefined {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function requireNumber(row: RpcRow, key: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Malformed RPC payload: ${key}`);
  return value;
}

function requireBool(row: RpcRow, key: string): boolean {
  const value = row[key];
  if (typeof value !== "boolean") throw new Error(`Malformed RPC payload: ${key}`);
  return value;
}

function asVisit(value: unknown): VisitDTO {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Malformed RPC payload: visit");
  const row = value as RpcRow;
  const rawStatus = requireString(row, "status");
  const status = dbVisitStatusToDto[rawStatus];
  if (!status) throw new Error(`Malformed RPC payload: visit.status=${rawStatus}`);
  return {
    id: requireString(row, "id"),
    workspaceId: requireString(row, "workspaceId"),
    requestId: requireString(row, "requestId"),
    quoteId: requireString(row, "quoteId"),
    crewId: optionalString(row, "crewId"),
    status,
    startAt: requireString(row, "startAt"),
    serviceMinutes: requireNumber(row, "serviceMinutes"),
    bufferMinutes: requireNumber(row, "bufferMinutes"),
    version: requireNumber(row, "version"),
  };
}

function asEvidence(value: unknown): VisitEvidenceDTO {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Malformed RPC payload: evidence");
  const row = value as RpcRow;
  return {
    id: requireString(row, "id"),
    workspaceId: requireString(row, "workspaceId"),
    visitId: requireString(row, "visitId"),
    kind: requireString(row, "kind") as VisitEvidenceDTO["kind"],
    mediaReference: row.mediaReference as VisitEvidenceDTO["mediaReference"],
    text: optionalString(row, "text"),
    capturedAt: requireString(row, "capturedAt"),
    submittedByUserId: requireString(row, "submittedByUserId"),
    createdAt: requireString(row, "createdAt"),
  };
}

function asChecklistItem(value: unknown): VisitChecklistItemDTO {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Malformed RPC payload: item");
  const row = value as RpcRow;
  return {
    id: requireString(row, "id"),
    workspaceId: requireString(row, "workspaceId"),
    visitId: requireString(row, "visitId"),
    itemKey: requireString(row, "itemKey"),
    completed: requireBool(row, "completed"),
    note: optionalString(row, "note"),
    updatedByUserId: requireString(row, "updatedByUserId"),
    updatedAt: requireString(row, "updatedAt"),
    version: requireNumber(row, "version"),
  };
}

function rpcInput(ctx: ActorContext, extra: RpcRow, meta?: CommandMeta): RpcRow {
  return {
    workspaceId: ctx.workspaceId,
    actorRole: ctx.role,
    actorUserId: ctx.userId,
    now: meta?.now,
    expectedVersion: meta?.expectedVersion,
    idempotencyKey: meta?.idempotencyKey,
    ...extra,
  };
}

function fromRpc<T>(data: RpcRow | null, error: { message: string; code?: string } | null, fallbackCode: string, key: string, mapper: (value: unknown) => T): Result<T> {
  if (error) return fail(error.code ?? fallbackCode, error.message);
  if (!data) return fail(`${fallbackCode}_EMPTY`, "Visit RPC returned no payload.");
  if (data.ok === false) return fail(String(data.code ?? fallbackCode), "Visit RPC rejected the command.");
  try {
    return { ok: true, value: mapper(data[key]) };
  } catch (err) {
    return fail(`${fallbackCode}_MALFORMED`, err instanceof Error ? err.message : "Malformed visit RPC payload.");
  }
}

export function createPostgresVisitFieldRuntimeFacadeMethods(client: SupabaseRpcClient): Pick<ServiceDeskFacade, "transitionVisit" | "assignCrew" | "addVisitEvidence" | "setVisitChecklistItem"> {
  return {
    async transitionVisit(ctx: ActorContext, id: string, action: VisitAction, meta: CommandMeta): Promise<Result<VisitDTO>> {
      const { data, error } = await client.rpc<RpcRow>("servicedesk_transition_visit", {
        p_input: rpcInput(ctx, { visitId: id, action }, meta),
      });
      return fromRpc(data, error, "VISIT_TRANSITION_RPC_ERROR", "visit", asVisit);
    },

    async assignCrew(ctx: ActorContext, id: string, input: AssignCrewInput, meta: CommandMeta): Promise<Result<VisitDTO>> {
      const { data, error } = await client.rpc<RpcRow>("servicedesk_assign_visit_crew", {
        p_input: rpcInput(ctx, { visitId: id, crewId: input.crewId }, meta),
      });
      return fromRpc(data, error, "VISIT_ASSIGN_CREW_RPC_ERROR", "visit", asVisit);
    },

    async addVisitEvidence(ctx: ActorContext, visitId: string, input: AddVisitEvidenceInput, meta: CommandMeta): Promise<Result<VisitEvidenceDTO>> {
      const { data, error } = await client.rpc<RpcRow>("servicedesk_add_visit_evidence", {
        p_input: rpcInput(ctx, { visitId, ...input }, meta),
      });
      return fromRpc(data, error, "VISIT_EVIDENCE_RPC_ERROR", "evidence", asEvidence);
    },

    async setVisitChecklistItem(ctx: ActorContext, visitId: string, input: SetVisitChecklistItemInput, meta: CommandMeta): Promise<Result<VisitChecklistItemDTO>> {
      const { data, error } = await client.rpc<RpcRow>("servicedesk_set_visit_checklist_item", {
        p_input: rpcInput(ctx, { visitId, ...input }, meta),
      });
      return fromRpc(data, error, "VISIT_CHECKLIST_RPC_ERROR", "item", asChecklistItem);
    },
  };
}
