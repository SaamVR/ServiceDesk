import type { ActorContext, CommandMeta, InvoiceDTO } from "@/contracts";
import type { ManualPaymentInput, WorkspaceSnapshot, WorkspaceSnapshotQuery } from "@/server/core/facade";
import {
  productActionFailure,
  productActionSuccess,
  type ProductActionError,
  type ProductActionResult,
} from "@/features/operations/server-action-adapters";

export interface CoreResultSuccess<T> { ok: true; value: T }
export interface CoreResultFailure { ok: false; code: string; message: string; fieldErrors?: Record<string, string> }
export type CoreResult<T> = CoreResultSuccess<T> | CoreResultFailure;

export interface InvoiceCommandPort {
  readWorkspaceSnapshot(ctx: ActorContext, query: WorkspaceSnapshotQuery): Promise<CoreResult<WorkspaceSnapshot>>;
  applyManualPayment(ctx: ActorContext, invoiceId: string, input: ManualPaymentInput, meta: CommandMeta): Promise<CoreResult<InvoiceDTO>>;
}

export interface ManualPaymentActionInput {
  ctx: ActorContext;
  invoice: InvoiceDTO;
  payment: ManualPaymentInput;
  idempotencyKey: string;
  now: string;
}

export interface ManualPaymentAvailability {
  role: "STAFF" | "CUSTOMER";
  enabled: boolean;
  label: string;
  disabledReason?: string;
  actionState?: ProductActionResult<InvoiceDTO>["state"];
}

function coreFailure(error: CoreResultFailure): ProductActionError {
  return { code: error.code, message: error.message, fieldErrors: error.fieldErrors };
}

function assertWorkspace(invoice: InvoiceDTO, workspaceId: string): ProductActionError | null {
  return invoice.workspaceId === workspaceId ? null : { code: "WORKSPACE_MISMATCH", message: "Invoice belongs to a different workspace." };
}

export function buildManualPaymentAvailability(role: "STAFF" | "CUSTOMER", adapterInjected: boolean): ManualPaymentAvailability {
  if (role === "CUSTOMER") {
    return {
      role,
      enabled: false,
      label: "Manual payment unavailable to customers",
      disabledReason: "Customer manual payment remains disabled until Core explicitly authorizes that role.",
    };
  }
  return adapterInjected
    ? { role, enabled: true, label: "Record manual payment through accepted server command" }
    : { role, enabled: false, label: "Manual payment server adapter required", disabledReason: "No accepted injected manual-payment command is bound to this route." };
}

export function createInvoiceServerActionFactory(commands: InvoiceCommandPort) {
  return {
    async applyManualPayment(input: ManualPaymentActionInput): Promise<ProductActionResult<InvoiceDTO>> {
      const steps = ["applyManualPayment"];
      const workspaceError = assertWorkspace(input.invoice, input.ctx.workspaceId);
      if (workspaceError) return productActionFailure(workspaceError, steps, "applyManualPayment");
      const result = await commands.applyManualPayment(input.ctx, input.invoice.id, input.payment, {
        idempotencyKey: input.idempotencyKey,
        now: input.now,
      });
      return result.ok
        ? productActionSuccess(result.value, steps, "Manual payment accepted by the server command.")
        : productActionFailure(coreFailure(result), steps, "applyManualPayment");
    },
  };
}
