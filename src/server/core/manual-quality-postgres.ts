import type { ActorContext, CommandMeta, InvoiceDTO, QualityCaseDTO, Result } from "../../contracts";
import type { ManualPaymentInput, QualityCaseAction, QualityCaseActionInput, ServiceDeskFacade } from "./facade";
import type { SupabaseRpcClient } from "./payment-application-postgres";

type RpcRow = Record<string, unknown>;

function fail<T>(code: string, message: string): Result<T> {
  return { ok: false, code, message };
}

function asRow(value: unknown): RpcRow | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RpcRow) : undefined;
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

function optionalNumber(row: RpcRow, key: string): number | undefined {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function requireNumber(row: RpcRow, key: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Malformed RPC payload: ${key}`);
  return value;
}

function invoiceFromRpc(value: unknown): InvoiceDTO {
  const row = asRow(value);
  if (!row) throw new Error("Malformed RPC payload: invoice");
  const status = requireString(row, "status") as InvoiceDTO["status"];
  if (!["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "VOID"].includes(status)) {
    throw new Error(`Malformed RPC payload: invoice.status=${status}`);
  }
  return {
    id: requireString(row, "id"),
    workspaceId: requireString(row, "workspaceId"),
    visitId: optionalString(row, "visitId"),
    status,
    currency: requireString(row, "currency") as InvoiceDTO["currency"],
    totalMinor: requireNumber(row, "totalMinor"),
    allocatedMinor: requireNumber(row, "allocatedMinor"),
    refundedMinor: requireNumber(row, "refundedMinor"),
    balanceMinor: requireNumber(row, "balanceMinor"),
  };
}

function qualityCaseFromRpc(value: unknown): QualityCaseDTO {
  const row = asRow(value);
  if (!row) throw new Error("Malformed RPC payload: qualityCase");
  return {
    id: requireString(row, "id"),
    workspaceId: requireString(row, "workspaceId"),
    visitId: requireString(row, "visitId"),
    state: requireString(row, "state") as QualityCaseDTO["state"],
    feedbackScore: optionalNumber(row, "feedbackScore"),
    summary: requireString(row, "summary"),
    ownerUserId: optionalString(row, "ownerUserId"),
    dueAt: optionalString(row, "dueAt"),
    resolutionNote: optionalString(row, "resolutionNote"),
    reviewRequestState: requireString(row, "reviewRequestState") as QualityCaseDTO["reviewRequestState"],
    version: requireNumber(row, "version"),
    createdAt: requireString(row, "createdAt"),
    updatedAt: requireString(row, "updatedAt"),
  };
}

function rpcInput(ctx: ActorContext, extra: RpcRow, meta: CommandMeta): RpcRow {
  return {
    workspaceId: ctx.workspaceId,
    actorRole: ctx.role,
    actorUserId: ctx.userId,
    expectedVersion: meta.expectedVersion,
    idempotencyKey: meta.idempotencyKey,
    now: meta.now,
    ...extra,
  };
}

function fromRpc<T>(
  data: RpcRow | null,
  error: { message: string; code?: string } | null,
  fallbackCode: string,
  key: string,
  mapper: (value: unknown) => T,
): Result<T> {
  if (error) return fail(error.code ?? fallbackCode, error.message);
  if (!data) return fail(`${fallbackCode}_EMPTY`, "RPC returned no payload.");
  if (data.ok === false) return fail(String(data.code ?? fallbackCode), "RPC rejected the command.");
  try {
    return { ok: true, value: mapper(data[key]) };
  } catch (err) {
    return fail(`${fallbackCode}_MALFORMED`, err instanceof Error ? err.message : "Malformed RPC payload.");
  }
}

export function createPostgresManualPaymentQualityFacadeMethods(
  client: SupabaseRpcClient,
): Pick<ServiceDeskFacade, "applyManualPayment" | "applyQualityCaseAction"> {
  return {
    async applyManualPayment(ctx: ActorContext, invoiceId: string, input: ManualPaymentInput, meta: CommandMeta): Promise<Result<InvoiceDTO>> {
      const { data, error } = await client.rpc<RpcRow>("servicedesk_apply_manual_payment", {
        p_input: rpcInput(ctx, { invoiceId, ...input }, meta),
      });
      return fromRpc(data, error, "MANUAL_PAYMENT_RPC_ERROR", "invoice", invoiceFromRpc);
    },

    async applyQualityCaseAction(
      ctx: ActorContext,
      id: string,
      action: QualityCaseAction,
      input: QualityCaseActionInput,
      meta: CommandMeta,
    ): Promise<Result<QualityCaseDTO>> {
      const { data, error } = await client.rpc<RpcRow>("servicedesk_apply_quality_case_action", {
        p_input: rpcInput(ctx, { qualityCaseId: id, action, ...input }, meta),
      });
      return fromRpc(data, error, "QUALITY_CASE_RPC_ERROR", "qualityCase", qualityCaseFromRpc);
    },
  };
}
