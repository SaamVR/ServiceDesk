import type { ActorContext, CommandMeta, RecurrenceRuleDTO, Result } from "../../contracts";
import type { CreateRecurrenceRuleInput, RecurrenceRuleAction, ServiceDeskFacade } from "./facade";
import type { SupabaseRpcClient } from "./payment-application-postgres";

type RpcRow = Record<string, unknown>;

export interface RecurrenceMaterializationOutcome {
  materializedCount: number;
  materialized: Array<{ ruleId: string; occurrenceId: string; requestId: string; sequence: number; occurrenceOn: string; requestedStartAt: string }>;
}

function fail<T>(code: string, message: string): Result<T> {
  return { ok: false, code, message };
}

function isRow(value: unknown): value is RpcRow {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function requireString(row: RpcRow, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`Malformed recurrence RPC payload: ${key}`);
  return value;
}

function optionalString(row: RpcRow, key: string): string | undefined {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function requireNumber(row: RpcRow, key: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Malformed recurrence RPC payload: ${key}`);
  return value;
}

function optionalNumber(row: RpcRow, key: string): number | undefined {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asRule(value: unknown): RecurrenceRuleDTO {
  if (!isRow(value)) throw new Error("Malformed recurrence RPC payload: rule");
  const status = requireString(value, "status");
  if (status !== "ACTIVE" && status !== "PAUSED" && status !== "COMPLETED") {
    throw new Error(`Malformed recurrence RPC payload: status=${status}`);
  }
  const frequency = requireString(value, "frequency");
  if (frequency !== "WEEKLY" && frequency !== "FORTNIGHTLY" && frequency !== "MONTHLY") {
    throw new Error(`Malformed recurrence RPC payload: frequency=${frequency}`);
  }
  return {
    id: requireString(value, "id"),
    workspaceId: requireString(value, "workspaceId"),
    requestId: requireString(value, "requestId"),
    propertyId: requireString(value, "propertyId"),
    frequency,
    timezone: requireString(value, "timezone"),
    localStartTime: requireString(value, "localStartTime"),
    startsOn: requireString(value, "startsOn"),
    endsOn: optionalString(value, "endsOn"),
    maxOccurrences: optionalNumber(value, "maxOccurrences"),
    generatedOccurrences: requireNumber(value, "generatedOccurrences"),
    status,
    nextOccurrenceOn: optionalString(value, "nextOccurrenceOn"),
    version: requireNumber(value, "version"),
    createdAt: requireString(value, "createdAt"),
    updatedAt: requireString(value, "updatedAt"),
  };
}

function inputFrom(ctx: ActorContext, extra: RpcRow, meta?: CommandMeta): RpcRow {
  return {
    workspaceId: ctx.workspaceId,
    actorRole: ctx.role,
    actorUserId: ctx.userId,
    expectedVersion: meta?.expectedVersion,
    idempotencyKey: meta?.idempotencyKey,
    now: meta?.now,
    ...extra,
  };
}

function fromRuleRpc(data: RpcRow | null, error: { message: string; code?: string } | null, fallbackCode: string): Result<RecurrenceRuleDTO> {
  if (error) return fail(error.code ?? fallbackCode, error.message);
  if (!data) return fail(`${fallbackCode}_EMPTY`, "Recurrence RPC returned no payload.");
  if (data.ok === false) return fail(String(data.code ?? fallbackCode), "Recurrence RPC rejected the command.");
  try {
    return { ok: true, value: asRule(data.rule) };
  } catch (err) {
    return fail(`${fallbackCode}_MALFORMED`, err instanceof Error ? err.message : "Malformed recurrence RPC payload.");
  }
}

export function createPostgresRecurrenceFacadeMethods(client: SupabaseRpcClient): Pick<ServiceDeskFacade, "createRecurrenceRule" | "applyRecurrenceRuleAction"> {
  return {
    async createRecurrenceRule(ctx: ActorContext, input: CreateRecurrenceRuleInput, meta: CommandMeta): Promise<Result<RecurrenceRuleDTO>> {
      const { data, error } = await client.rpc<RpcRow>("servicedesk_create_recurrence_rule", {
        p_input: inputFrom(ctx, input as unknown as RpcRow, meta),
      });
      return fromRuleRpc(data, error, "RECURRENCE_CREATE_RPC_ERROR");
    },

    async applyRecurrenceRuleAction(ctx: ActorContext, id: string, action: RecurrenceRuleAction, meta: CommandMeta): Promise<Result<RecurrenceRuleDTO>> {
      const { data, error } = await client.rpc<RpcRow>("servicedesk_apply_recurrence_rule_action", {
        p_input: inputFrom(ctx, { ruleId: id, action }, meta),
      });
      return fromRuleRpc(data, error, "RECURRENCE_ACTION_RPC_ERROR");
    },
  };
}

export async function materializeDueRecurrences(
  client: SupabaseRpcClient,
  input: { workspaceId?: string; dueOn?: string; limit?: number; now?: string },
): Promise<Result<RecurrenceMaterializationOutcome>> {
  const { data, error } = await client.rpc<RpcRow>("servicedesk_materialize_due_recurrences", { p_input: input });
  if (error) return fail(error.code ?? "RECURRENCE_MATERIALIZE_RPC_ERROR", error.message);
  if (!data) return fail("RECURRENCE_MATERIALIZE_EMPTY", "Recurrence materializer returned no payload.");
  if (data.ok === false) return fail(String(data.code ?? "RECURRENCE_MATERIALIZE_REJECTED"), "Recurrence materializer rejected the command.");

  const materialized = Array.isArray(data.materialized)
    ? data.materialized.flatMap((item) => {
        if (!isRow(item)) return [];
        return [{
          ruleId: requireString(item, "ruleId"),
          occurrenceId: requireString(item, "occurrenceId"),
          requestId: requireString(item, "requestId"),
          sequence: requireNumber(item, "sequence"),
          occurrenceOn: requireString(item, "occurrenceOn"),
          requestedStartAt: requireString(item, "requestedStartAt"),
        }];
      })
    : [];

  return { ok: true, value: { materializedCount: requireNumber(data, "materializedCount"), materialized } };
}
