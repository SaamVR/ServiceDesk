import type { InvoiceDTO, Result, VisitDTO } from "../../contracts";
import type { ServiceDeskFacade, VerifiedPaymentEvent, VerifiedPaymentApplicationOutcome } from "./facade";

export interface SupabaseRpcClient {
  rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<{ data: T | null; error: { message: string; code?: string } | null }>;
}

function invoiceFromRpc(row: Record<string, unknown> | undefined): InvoiceDTO | undefined {
  if (!row) return undefined;
  return {
    id: String(row.id),
    workspaceId: String(row.workspaceId),
    visitId: row.visitId ? String(row.visitId) : undefined,
    status: String(row.status) as InvoiceDTO["status"],
    currency: String(row.currency),
    totalMinor: Number(row.totalMinor),
    allocatedMinor: Number(row.allocatedMinor),
    refundedMinor: Number(row.refundedMinor ?? 0),
    balanceMinor: Number(row.balanceMinor),
  };
}

function visitFromRpc(row: Record<string, unknown> | undefined): VisitDTO | undefined {
  if (!row) return undefined;
  return {
    id: String(row.id),
    workspaceId: String(row.workspaceId),
    requestId: String(row.requestId),
    quoteId: String(row.quoteId),
    crewId: row.crewId ? String(row.crewId) : undefined,
    status: String(row.status) as VisitDTO["status"],
    startAt: String(row.startAt),
    serviceMinutes: Number(row.serviceMinutes),
    bufferMinutes: Number(row.bufferMinutes),
    version: Number(row.version),
  };
}

export function createPostgresPaymentApplicationFacadeMethods(client: SupabaseRpcClient): Pick<ServiceDeskFacade, "applyVerifiedPayment"> {
  return {
    async applyVerifiedPayment(event: VerifiedPaymentEvent): Promise<Result<VerifiedPaymentApplicationOutcome>> {
      const { data, error } = await client.rpc<Record<string, unknown>>("servicedesk_apply_verified_payment", { p_event: event });
      if (error) return { ok: false, code: error.code ?? "PAYMENT_RPC_ERROR", message: error.message };
      if (!data || data.ok === false) return { ok: false, code: String(data?.code ?? "PAYMENT_RPC_REJECTED"), message: "Verified payment was rejected by the database RPC." };
      const state = String(data.state) as VerifiedPaymentApplicationOutcome["state"];
      return {
        ok: true,
        value: {
          state,
          invoice: invoiceFromRpc(data.invoice as Record<string, unknown> | undefined),
          visit: visitFromRpc(data.visit as Record<string, unknown> | undefined),
          attentionItemId: data.attentionItemId ? String(data.attentionItemId) : undefined,
        },
      };
    },
  };
}
