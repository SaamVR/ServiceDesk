import { buildInvoiceQualityRecoverySnapshot } from "@/features/operations/workspace-snapshot-boundary";
export function createRouteLocalRecoveryBoundary() { return { loadSnapshot: buildInvoiceQualityRecoverySnapshot, recoveryCommand: null, readOnlyReason: "Recovery remains human-owned because no accepted Core recovery command exists." }; }
