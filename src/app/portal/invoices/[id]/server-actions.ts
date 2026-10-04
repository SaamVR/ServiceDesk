import { buildInvoiceQualityRecoverySnapshot } from "@/features/operations/workspace-snapshot-boundary";
import { buildManualPaymentAvailability } from "@/features/invoices/server-boundary";
export function createRouteLocalCustomerInvoiceBoundary() { return { loadSnapshot: buildInvoiceQualityRecoverySnapshot, manualPaymentAvailability: buildManualPaymentAvailability("CUSTOMER", true) }; }
