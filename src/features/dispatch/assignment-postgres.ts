import type { ActorContext, Result, VisitDTO } from "@/contracts";
import type { SupabaseRpcClient } from "@/server/core/payment-application-postgres";

type RpcRow = Record<string, unknown>;

function fail<T>(code: string, message: string): Result<T> {
  return { ok: false, code, message };
}

function requiredString(row: RpcRow, key: string) {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) throw new Error("Malformed dispatch assignment payload: " + key);
  return value;
}

function optionalString(row: RpcRow, key: string) {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function requiredNumber(row: RpcRow, key: string) {
  const value = row[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Malformed dispatch assignment payload: " + key);
  return value;
}

function mapVisit(value: unknown): VisitDTO {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Malformed dispatch assignment payload: visit");
  }
  const row = value as RpcRow;
  return {
    id: requiredString(row, "id"),
    workspaceId: requiredString(row, "workspaceId"),
    requestId: requiredString(row, "requestId"),
    quoteId: requiredString(row, "quoteId"),
    crewId: optionalString(row, "crewId"),
    status: requiredString(row, "status") as VisitDTO["status"],
    startAt: requiredString(row, "startAt"),
    serviceMinutes: requiredNumber(row, "serviceMinutes"),
    bufferMinutes: requiredNumber(row, "bufferMinutes"),
    version: requiredNumber(row, "version"),
  };
}

export async function assignVisitCrewWithPostgres(
  client: SupabaseRpcClient,
  ctx: ActorContext,
  input: {
    visitId: string;
    crewId: string;
    expectedVersion: number;
    idempotencyKey: string;
    now: string;
  },
): Promise<Result<VisitDTO>> {
  const { data, error } = await client.rpc<RpcRow>("servicedesk_assign_visit_crew", {
    p_input: {
      workspaceId: ctx.workspaceId,
      actorRole: ctx.role,
      actorUserId: ctx.userId,
      visitId: input.visitId,
      crewId: input.crewId,
      expectedVersion: input.expectedVersion,
      idempotencyKey: input.idempotencyKey,
      now: input.now,
    },
  });

  if (error) return fail(error.code ?? "DISPATCH_ASSIGNMENT_RPC_ERROR", error.message);
  if (!data) return fail("DISPATCH_ASSIGNMENT_RPC_EMPTY", "Crew assignment returned no result.");
  if (data.ok === false) {
    const code = String(data.code ?? "DISPATCH_ASSIGNMENT_REJECTED");
    const message =
      code === "VERSION_CONFLICT"
        ? "This job changed before the assignment was saved. Refresh and review the recommendation again."
        : code === "CREW_SCHEDULE_CONFLICT"
          ? "That crew now has an overlapping job. Review the schedule and choose another crew."
          : code === "CREW_NOT_AVAILABLE"
            ? "That crew is no longer available."
            : code === "FORBIDDEN"
              ? "You do not have permission to assign crews."
              : "The crew assignment could not be saved.";
    return fail(code, message);
  }

  try {
    return { ok: true, value: mapVisit(data.visit) };
  } catch (err) {
    return fail(
      "DISPATCH_ASSIGNMENT_RPC_MALFORMED",
      err instanceof Error ? err.message : "Crew assignment returned an invalid result.",
    );
  }
}
