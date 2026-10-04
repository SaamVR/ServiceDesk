import type { InvoiceDTO, Result, VisitDTO } from "../../contracts";
import type { ServiceDeskFacade, VerifiedPaymentEvent, VerifiedPaymentApplicationOutcome, VerifiedPaymentApplicationState } from "./facade";

export interface SupabaseRpcClient {
  rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<{ data: T | null; error: { message: string; code?: string } | null }>;
}

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

function invoiceFromRpc(value: unknown): InvoiceDTO | undefined {
  if (value == null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("Malformed RPC payload: invoice");
  const row = value as RpcRow;
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

function visitFromRpc(value: unknown): VisitDTO | undefined {
  if (value == null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("Malformed RPC payload: visit");
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

function stateFromRpc(data: RpcRow): VerifiedPaymentApplicationState {
  const state = requireString(data, "state");
  if (state !== "APPLIED" && state !== "DUPLICATE" && state !== "PAYMENT_REVIEW") {
    throw new Error(`Malformed RPC payload: state=${state}`);
  }
  return state;
}

export function createPostgresPaymentApplicationFacadeMethods(client: SupabaseRpcClient): Pick<ServiceDeskFacade, "applyVerifiedPayment"> {
  return {
    async applyVerifiedPayment(event: VerifiedPaymentEvent): Promise<Result<VerifiedPaymentApplicationOutcome>> {
      const { data, error } = await client.rpc<RpcRow>("servicedesk_apply_verified_payment", { p_event: event });
      if (error) return fail(error.code ?? "PAYMENT_RPC_ERROR", error.message);
      if (!data) return fail("PAYMENT_RPC_EMPTY", "Verified payment RPC returned no payload.");
      if (data.ok === false) return fail(String(data.code ?? "PAYMENT_RPC_REJECTED"), "Verified payment was rejected by the database RPC.");

      try {
        return {
          ok: true,
          value: {
            state: stateFromRpc(data),
            invoice: invoiceFromRpc(data.invoice),
            visit: visitFromRpc(data.visit),
            attentionItemId: optionalString(data, "attentionItemId"),
          },
        };
      } catch (err) {
        return fail("PAYMENT_RPC_MALFORMED", err instanceof Error ? err.message : "Malformed verified payment RPC payload.");
      }
    },
  };
}
