import type { ActorContext, ReportingSnapshotDTO } from "@/contracts";
import type { ReportingSnapshotQuery } from "@/server/core/facade";
import { productActionFailure, productActionSuccess, type ProductActionError, type ProductActionResult } from "@/features/operations/server-action-adapters";

export interface CoreResultSuccess<T> { ok: true; value: T }
export interface CoreResultFailure { ok: false; code: string; message: string; fieldErrors?: Record<string, string> }
export type CoreResult<T> = CoreResultSuccess<T> | CoreResultFailure;
export interface ReportingReadPort { readReportingSnapshot(ctx: ActorContext, query: ReportingSnapshotQuery): Promise<CoreResult<ReportingSnapshotDTO>>; }
export interface ReportingReadInput { ctx: ActorContext; from?: string; to?: string }
const fail = (e: CoreResultFailure): ProductActionError => ({ code: e.code, message: e.message, fieldErrors: e.fieldErrors });
export function createReportingReadFactory(port: ReportingReadPort) { return async function readReporting(input: ReportingReadInput): Promise<ProductActionResult<ReportingSnapshotDTO>> { const steps = ["readReportingSnapshot"]; const query: ReportingSnapshotQuery = { from: input.from, to: input.to }; const result = await port.readReportingSnapshot(input.ctx, query); if (!result.ok) return productActionFailure(fail(result), steps, "readReportingSnapshot"); if (result.value.workspaceId !== input.ctx.workspaceId) return productActionFailure({ code: "WORKSPACE_MISMATCH", message: "Reporting snapshot belongs to a different workspace." }, steps, "readReportingSnapshot"); return productActionSuccess(result.value, steps, "Reporting snapshot loaded from accepted server facade."); }; }
