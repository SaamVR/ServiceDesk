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

const recurrenceUuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
function exactRecurrenceDate(value:unknown):value is string {
 if(typeof value!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const parts=value.split("-").map(Number);
 const date=new Date(Date.UTC(parts[0],parts[1]-1,parts[2]));
 return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10)===value;
}
function recurrenceInstant(value:unknown):boolean {
 if(typeof value!=="string")return false;
 const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
 if(!match || !exactRecurrenceDate(`${match[1]}-${match[2]}-${match[3]}`) ||
    Number(match[4])>23 || Number(match[5])>59 || Number(match[6])>59)return false;
 if(match[8]!=="Z"){
   const hours=Number(match[10]),minutes=Number(match[11]);
   if(hours>14 || minutes>59 || (hours===14&&minutes!==0))return false;
 }
 return Number.isFinite(Date.parse(value));
}
function parseMaterializedReceipt(value:unknown):RecurrenceMaterializationOutcome["materialized"][number]|null {
 if(!isRow(value) || Object.getPrototypeOf(value)!==Object.prototype ||
    Reflect.ownKeys(value).length!==6 ||
    !["ruleId","occurrenceId","requestId","sequence","occurrenceOn","requestedStartAt"]
      .every(k=>Object.hasOwn(value,k)) ||
    Object.values(Object.getOwnPropertyDescriptors(value))
      .some(d=>!Object.hasOwn(d,"value")))return null;
 if(![value.ruleId,value.occurrenceId,value.requestId].every(v=>
      typeof v==="string"&&recurrenceUuid.test(v)) ||
    typeof value.sequence!=="number" || !Number.isSafeInteger(value.sequence) ||
    value.sequence<1 || !exactRecurrenceDate(value.occurrenceOn) ||
    !recurrenceInstant(value.requestedStartAt))return null;
 return {
   ruleId:value.ruleId as string,
   occurrenceId:value.occurrenceId as string,
   requestId:value.requestId as string,
   sequence:value.sequence as number,
   occurrenceOn:value.occurrenceOn as string,
   requestedStartAt:value.requestedStartAt as string,
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

  // A successful RPC is not proof that a partial/invalid readback matched
  // every durable generated occurrence. Never silently drop malformed rows.
  if(typeof data.materializedCount!=="number" ||
     !Number.isSafeInteger(data.materializedCount) || data.materializedCount<0 ||
     data.materializedCount>100 ||
     !Array.isArray(data.materialized) ||
     data.materialized.length!==data.materializedCount ||
     Reflect.ownKeys(data.materialized).length!==data.materialized.length+1) {
    return fail("RECURRENCE_MATERIALIZE_RECEIPT_INVALID",
      "Generated recurring visits require complete matching saved occurrence receipts.");
  }
  const materialized:RecurrenceMaterializationOutcome["materialized"]=[];
  const occurrenceIds=new Set<string>();
  const requestIds=new Set<string>();
  for(const raw of data.materialized){
    const row=parseMaterializedReceipt(raw);
    if(!row || occurrenceIds.has(row.occurrenceId) ||
       requestIds.has(row.requestId)) {
      return fail("RECURRENCE_MATERIALIZE_RECEIPT_INVALID",
        "Recurring visit receipt contains inconsistent source evidence.");
    }
    occurrenceIds.add(row.occurrenceId);
    requestIds.add(row.requestId);
    materialized.push(row);
  }
  return {ok:true,value:{materializedCount:data.materializedCount,materialized}};
}
