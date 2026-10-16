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
  if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new Error(`Malformed RPC payload: ${key}`);
  return value;
}

function invoiceFromRpc(value: unknown): InvoiceDTO {
  const row = asRow(value);
  if (!row) throw new Error("Malformed RPC payload: invoice");
  const status = requireString(row, "status") as InvoiceDTO["status"];
  if (!["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "VOID"].includes(status)) {
    throw new Error(`Malformed RPC payload: invoice.status=${status}`);
  }
  const currency = requireString(row, "currency");
  const totalMinor = requireNumber(row, "totalMinor");
  const allocatedMinor = requireNumber(row, "allocatedMinor");
  const refundedMinor = requireNumber(row, "refundedMinor");
  const balanceMinor = requireNumber(row, "balanceMinor");
  const net = allocatedMinor - refundedMinor;
  if (!/^[A-Z]{3}$/.test(currency) ||
      [totalMinor,allocatedMinor,refundedMinor,balanceMinor].some(v => v < 0) ||
      !Number.isSafeInteger(net) || allocatedMinor < refundedMinor ||
      !Number.isSafeInteger(net + balanceMinor) ||
      net + balanceMinor !== totalMinor ||
      (status === "PAID" && balanceMinor !== 0)) {
    throw new Error("Malformed RPC payload: invoice financial ledger");
  }
  return {
    id: requireString(row, "id"),
    workspaceId: requireString(row, "workspaceId"),
    visitId: optionalString(row, "visitId"),
    status,
    currency: currency as InvoiceDTO["currency"],
    totalMinor, allocatedMinor, refundedMinor, balanceMinor,
  };
}

function qualityCaseFromRpc(value: unknown): QualityCaseDTO {
  const row = asRow(value);
  if (!row) throw new Error("Malformed RPC payload: qualityCase");
  const state = requireString(row, "state");
  const reviewRequestState = requireString(row, "reviewRequestState");
  const version = requireNumber(row, "version");
  const feedbackScore = optionalNumber(row, "feedbackScore");
  if (!["OPEN","IN_REVIEW","RESOLVED"].includes(state) ||
      !["NOT_ELIGIBLE","ELIGIBLE","REQUESTED"].includes(reviewRequestState) ||
      version < 0 || (feedbackScore !== undefined &&
      (!Number.isSafeInteger(feedbackScore) || feedbackScore < 1 || feedbackScore > 5))) {
    throw new Error("Malformed RPC payload: quality state");
  }
  return {
    id: requireString(row, "id"),
    workspaceId: requireString(row, "workspaceId"),
    visitId: requireString(row, "visitId"),
    state: state as QualityCaseDTO["state"],
    feedbackScore,
    summary: requireString(row, "summary"),
    ownerUserId: optionalString(row, "ownerUserId"),
    dueAt: optionalString(row, "dueAt"),
    resolutionNote: optionalString(row, "resolutionNote"),
    reviewRequestState: reviewRequestState as QualityCaseDTO["reviewRequestState"],
    version,
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
  // Database messages and arbitrary codes can contain SQL, access tokens or
  // customer information. Never propagate them to a staff-visible command.
  const safeCode = (value: unknown) =>
    typeof value === "string" && /^[A-Z][A-Z0-9_]{0,79}$/.test(value)
      ? value : fallbackCode;
  if (error) return fail(safeCode(error.code), "Database command could not be completed.");
  if (!data) return fail(`${fallbackCode}_EMPTY`, "RPC returned no payload.");
  if (data.ok === false) return fail(safeCode(data.code), "Database rejected the command.");
  try {
    return { ok: true, value: mapper(data[key]) };
  } catch {
    return fail(`${fallbackCode}_MALFORMED`, "Database returned invalid command evidence.");
  }
}

export function createPostgresManualPaymentQualityFacadeMethods(
  client: SupabaseRpcClient,
): Pick<ServiceDeskFacade, "applyManualPayment" | "applyQualityCaseAction"> {
  return {
    async applyManualPayment(ctx: ActorContext, invoiceId: string, input: ManualPaymentInput, meta: CommandMeta): Promise<Result<InvoiceDTO>> {
      const response = await client.rpc<RpcRow>("servicedesk_apply_manual_payment", {
        p_input: rpcInput(ctx, { invoiceId, ...input }, meta),
      }).catch(() => null);
      if (!response) return fail("MANUAL_PAYMENT_RPC_UNAVAILABLE", "Database command is temporarily unavailable.");
      return fromRpc(response.data, response.error, "MANUAL_PAYMENT_RPC_ERROR", "invoice",
        (payload) => {
          const invoice = invoiceFromRpc(payload);
          if (invoice.id !== invoiceId || invoice.workspaceId !== ctx.workspaceId)
            throw new Error("Invoice identity mismatch");
          return invoice;
        });
    },

    async applyQualityCaseAction(
      ctx: ActorContext,
      id: string,
      action: QualityCaseAction,
      input: QualityCaseActionInput,
      meta: CommandMeta,
    ): Promise<Result<QualityCaseDTO>> {
      const response = await client.rpc<RpcRow>("servicedesk_apply_quality_case_action", {
        p_input: rpcInput(ctx, { qualityCaseId: id, action, ...input }, meta),
      }).catch(() => null);
      if (!response) return fail("QUALITY_CASE_RPC_UNAVAILABLE", "Database command is temporarily unavailable.");
      return fromRpc(response.data, response.error, "QUALITY_CASE_RPC_ERROR", "qualityCase",
        (payload) => {
          const quality = qualityCaseFromRpc(payload);
          if (quality.id !== id || quality.workspaceId !== ctx.workspaceId)
            throw new Error("Quality case identity mismatch");
          return quality;
        });
    },
  };
}
