import { createQualityServerActionFactory, type QualityCommandPort } from "@/features/quality/server-boundary";
import { buildInvoiceQualityRecoverySnapshot } from "@/features/operations/workspace-snapshot-boundary";
export function createRouteLocalQualityBoundary(commands: QualityCommandPort) { const actions = createQualityServerActionFactory(commands); return { loadSnapshot: buildInvoiceQualityRecoverySnapshot, applyQualityCaseAction: actions.applyQualityCaseAction }; }
