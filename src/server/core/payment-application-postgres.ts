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
  if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new Error(`Malformed RPC payload: ${key}`);
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
  const currency = requireString(row, "currency");
  const totalMinor = requireNumber(row, "totalMinor");
  const allocatedMinor = requireNumber(row, "allocatedMinor");
  const refundedMinor = requireNumber(row, "refundedMinor");
  const balanceMinor = requireNumber(row, "balanceMinor");
  const net = allocatedMinor - refundedMinor;
  if (!/^[A-Z]{3}$/.test(currency) ||
      [totalMinor,allocatedMinor,refundedMinor,balanceMinor].some(n => n < 0) ||
      allocatedMinor < refundedMinor || !Number.isSafeInteger(net) ||
      !Number.isSafeInteger(net + balanceMinor) ||
      net + balanceMinor !== totalMinor ||
      (status === "PAID" && balanceMinor !== 0)) {
    throw new Error("Malformed RPC payload: invoice monetary ledger");
  }
  return {
    id: requireString(row, "id"),
    workspaceId: requireString(row, "workspaceId"),
    visitId: optionalString(row, "visitId"),
    status, currency: currency as InvoiceDTO["currency"],
    totalMinor, allocatedMinor, refundedMinor, balanceMinor,
  };
}

function visitFromRpc(value: unknown): VisitDTO | undefined {
  if (value == null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("Malformed RPC payload: visit");
  const row = value as RpcRow;
  const rawStatus = requireString(row, "status");
  const status = dbVisitStatusToDto[rawStatus];
  if (!status) throw new Error(`Malformed RPC payload: visit.status=${rawStatus}`);
  const startAt = requireString(row, "startAt");
  const serviceMinutes = requireNumber(row, "serviceMinutes");
  const bufferMinutes = requireNumber(row, "bufferMinutes");
  const version = requireNumber(row, "version");
  if (!Number.isFinite(Date.parse(startAt)) || serviceMinutes < 0 ||
      bufferMinutes < 0 || version < 0) throw new Error("Malformed RPC payload: visit schedule");
  return {
    id: requireString(row, "id"),
    workspaceId: requireString(row, "workspaceId"),
    requestId: requireString(row, "requestId"),
    quoteId: requireString(row, "quoteId"),
    crewId: optionalString(row, "crewId"),
    status, startAt, serviceMinutes, bufferMinutes, version,
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
      const result = await client.rpc<RpcRow>("servicedesk_apply_verified_payment", { p_event: event })
        .catch(() => null);
      if (!result) return fail("PAYMENT_RPC_UNAVAILABLE", "Payment evidence database is temporarily unavailable.");
      const { data, error } = result;
      const safeCode = (raw: unknown, fallback: string) =>
        typeof raw === "string" && /^[A-Z][A-Z0-9_]{0,79}$/.test(raw) ? raw : fallback;
      // Provider and SQL errors may embed tokens, customer identities and raw
      // responses. Never expose those diagnostics as public failure messages.
      if (error) return fail(safeCode(error.code, "PAYMENT_RPC_ERROR"), "Payment evidence could not be applied.");
      if (!data) return fail("PAYMENT_RPC_EMPTY", "Verified payment RPC returned no payload.");
      if (data.ok !== true) return fail(safeCode(data.code, "PAYMENT_RPC_REJECTED"), "Verified payment was rejected by the database RPC.");

      try {
        const state = stateFromRpc(data);
        const invoice = invoiceFromRpc(data.invoice);
        const visit = visitFromRpc(data.visit);
        // Installed SQL always persists and returns an invoice for a customer
        // APPLIED/DUPLICATE receipt. A DEPOSIT also creates a visit linked
        // to that invoice; BALANCE must be tied to its named invoice. Do not
        // interpret a bare RPC success envelope as a completed transaction.
        const appliedCustomerPayment = state === "APPLIED" || state === "DUPLICATE";
        const missingBusinessProof = appliedCustomerPayment && (
          event.purpose === "PLATFORM_SUBSCRIPTION" ||
          !invoice ||
          (event.purpose === "DEPOSIT" &&
            (!event.quoteId || !event.holdId || !visit || invoice?.visitId !== visit.id)) ||
          (event.purpose === "BALANCE" &&
            (!event.invoiceId || invoice?.id !== event.invoiceId)) ||
          (state === "APPLIED" && event.purpose === "DEPOSIT" &&
            invoice?.allocatedMinor !== event.amountMinor) ||
          (state === "APPLIED" && event.purpose === "BALANCE" &&
            (invoice?.status !== "PAID" || invoice?.balanceMinor !== 0))
        );
        if (missingBusinessProof) {
          return fail("PAYMENT_RPC_RECEIPT_UNVERIFIED",
            "The persisted invoice or visit for this payment could not be verified.");
        }
        // A real payment must never acknowledge an invoice or visit from a
        // different workspace, or a visit unrelated to its persisted invoice.
        if ((invoice && invoice.workspaceId !== event.workspaceId) ||
            (visit && visit.workspaceId !== event.workspaceId) ||
            (invoice?.visitId && visit && invoice.visitId !== visit.id) ||
            // The provider callback names its source quote/invoice. A valid
            // workspace alone cannot authorize an unrelated saved business
            // object (particularly across concurrent invoice payments).
            (event.invoiceId && invoice && invoice.id !== event.invoiceId) ||
            (event.quoteId && visit && visit.quoteId !== event.quoteId) ||
            ((state === "APPLIED" || state === "DUPLICATE") &&
              invoice && invoice.currency !== event.currency)) {
          return fail("PAYMENT_RPC_SCOPE_MISMATCH", "Payment application identity could not be verified.");
        }
        return { ok: true, value: {
          state, invoice, visit, attentionItemId: optionalString(data, "attentionItemId"),
        } };
      } catch {
        return fail("PAYMENT_RPC_MALFORMED", "Database returned invalid payment evidence.");
      }
    },
  };
}
