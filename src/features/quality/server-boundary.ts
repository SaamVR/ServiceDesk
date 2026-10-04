import type { ActorContext, CommandMeta, QualityCaseDTO } from "@/contracts";
import type { QualityCaseAction, QualityCaseActionInput } from "@/server/core/facade";
import {
  productActionFailure,
  productActionSuccess,
  type ProductActionError,
  type ProductActionResult,
} from "@/features/operations/server-action-adapters";

export interface CoreResultSuccess<T> { ok: true; value: T }
export interface CoreResultFailure { ok: false; code: string; message: string; fieldErrors?: Record<string, string> }
export type CoreResult<T> = CoreResultSuccess<T> | CoreResultFailure;

export interface QualityCommandPort {
  applyQualityCaseAction(ctx: ActorContext, id: string, action: QualityCaseAction, input: QualityCaseActionInput, meta: CommandMeta): Promise<CoreResult<QualityCaseDTO>>;
}

export interface QualityCaseActionRequest {
  ctx: ActorContext;
  qualityCase: QualityCaseDTO;
  action: QualityCaseAction;
  input: QualityCaseActionInput;
  idempotencyKey: string;
  now: string;
}

function coreFailure(error: CoreResultFailure): ProductActionError {
  return { code: error.code, message: error.message, fieldErrors: error.fieldErrors };
}

export function createQualityServerActionFactory(commands: QualityCommandPort) {
  return {
    async applyQualityCaseAction(input: QualityCaseActionRequest): Promise<ProductActionResult<QualityCaseDTO>> {
      const steps = ["applyQualityCaseAction"];
      if (input.qualityCase.workspaceId !== input.ctx.workspaceId) {
        return productActionFailure({ code: "WORKSPACE_MISMATCH", message: "Quality case belongs to a different workspace." }, steps, "applyQualityCaseAction");
      }
      const result = await commands.applyQualityCaseAction(input.ctx, input.qualityCase.id, input.action, input.input, {
        idempotencyKey: input.idempotencyKey,
        expectedVersion: input.qualityCase.version,
        now: input.now,
      });
      return result.ok
        ? productActionSuccess(result.value, steps, "Quality case action accepted by the server command.")
        : productActionFailure(coreFailure(result), steps, "applyQualityCaseAction");
    },
  };
}
