import type { ActorContext, CommandMeta, VisitChecklistItemDTO, VisitDTO, VisitEvidenceDTO } from "@/contracts";
import type { AddVisitEvidenceInput, ServiceDeskFacade, SetVisitChecklistItemInput } from "@/server/core/facade";
import {
  productActionFailure,
  productActionSuccess,
  type ProductActionError,
  type ProductActionResult,
} from "@/features/operations/server-action-adapters";

export interface CrewFieldCommandPort {
  addVisitEvidence: ServiceDeskFacade["addVisitEvidence"];
  setVisitChecklistItem: ServiceDeskFacade["setVisitChecklistItem"];
}

export interface CrewEvidenceCommandInput {
  ctx: ActorContext;
  visit: VisitDTO;
  evidence: AddVisitEvidenceInput;
  idempotencyKey: string;
  now: string;
}

export interface CrewChecklistCommandInput {
  ctx: ActorContext;
  visit: VisitDTO;
  item: SetVisitChecklistItemInput;
  idempotencyKey: string;
  now: string;
}

function coreFailure(result: { ok: false; code: string; message: string }): ProductActionError {
  return { code: result.code, message: result.message };
}

function metaFor(visit: VisitDTO, idempotencyKey: string, now: string): CommandMeta {
  return { idempotencyKey, expectedVersion: visit.version, now };
}

export function createCrewFieldServerActionFactory(commands: CrewFieldCommandPort) {
  return {
    async addEvidence(input: CrewEvidenceCommandInput): Promise<ProductActionResult<VisitEvidenceDTO>> {
      const steps = ["addVisitEvidence"];
      if (input.visit.workspaceId !== input.ctx.workspaceId) {
        return productActionFailure(
          { code: "VISIT_WORKSPACE_MISMATCH", message: "Visit belongs to a different workspace." },
          steps,
          "addVisitEvidence",
        );
      }
      const result = await commands.addVisitEvidence(
        input.ctx,
        input.visit.id,
        input.evidence,
        metaFor(input.visit, input.idempotencyKey, input.now),
      );
      return result.ok
        ? productActionSuccess(result.value, steps, "Field evidence accepted by the authoritative visit command.")
        : productActionFailure(coreFailure(result), steps, "addVisitEvidence");
    },

    async setChecklistItem(input: CrewChecklistCommandInput): Promise<ProductActionResult<VisitChecklistItemDTO>> {
      const steps = ["setVisitChecklistItem"];
      if (input.visit.workspaceId !== input.ctx.workspaceId) {
        return productActionFailure(
          { code: "VISIT_WORKSPACE_MISMATCH", message: "Visit belongs to a different workspace." },
          steps,
          "setVisitChecklistItem",
        );
      }
      const result = await commands.setVisitChecklistItem(
        input.ctx,
        input.visit.id,
        input.item,
        metaFor(input.visit, input.idempotencyKey, input.now),
      );
      return result.ok
        ? productActionSuccess(result.value, steps, "Checklist update accepted by the authoritative visit command.")
        : productActionFailure(coreFailure(result), steps, "setVisitChecklistItem");
    },
  };
}
