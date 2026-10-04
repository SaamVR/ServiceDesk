import { createInvoiceServerActionFactory, type InvoiceCommandPort } from "@/features/invoices/server-boundary";
import { buildInvoiceQualityRecoverySnapshot } from "@/features/operations/workspace-snapshot-boundary";
export function createRouteLocalStaffInvoiceBoundary(commands: InvoiceCommandPort) { const actions = createInvoiceServerActionFactory(commands); return { loadSnapshot: buildInvoiceQualityRecoverySnapshot, applyManualPayment: actions.applyManualPayment }; }
