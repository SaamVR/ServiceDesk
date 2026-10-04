import type { ActorContext, CommandMeta, Result, VisitDTO } from "@/contracts";
import type { ServiceDeskFacade, VisitAction } from "@/server/core/facade";
import {
  productActionFailure,
  productActionSuccess,
  type ProductActionError,
  type ProductActionResult,
} from "@/features/operations/server-action-adapters";

export type CrewOperableVisitAction = Extract<VisitAction, "EN_ROUTE" | "START" | "SUBMIT_REVIEW">;

export interface CrewTransitionCommandPort {
  transitionVisit: ServiceDeskFacade["transitionVisit"];
}

export interface CrewTransitionActionInput {
  ctx: ActorContext;
  visit: VisitDTO;
  idempotencyKey: string;
  now: string;
  requestedAction?: VisitAction;
}

export interface CrewTransitionPresentation {
  action?: CrewOperableVisitAction;
  enabled: boolean;
  label: string;
  pending?: boolean;
  stateLabel?: string;
  disabledReason?: string;
}

const crewActionByVisitStatus: Partial<Record<VisitDTO["status"], CrewOperableVisitAction>> = {
  ASSIGNED: "EN_ROUTE",
  EN_ROUTE: "START",
  IN_PROGRESS: "SUBMIT_REVIEW",
};

const crewActionLabel: Record<CrewOperableVisitAction, string> = {
  EN_ROUTE: "Mark en route",
  START: "Start job",
  SUBMIT_REVIEW: "Submit for dispatcher review",
};

function error(code: string, message: string): ProductActionError {
  return { code, message };
}

function coreFailure(result: Extract<Result<VisitDTO>, { ok: false }>): ProductActionError {
  return { code: result.code, message: result.message };
}

export function getCrewOperableTransitionAction(visit: VisitDTO): CrewOperableVisitAction | undefined {
  return crewActionByVisitStatus[visit.status];
}

export function buildCrewTransitionPresentation(visit: VisitDTO, supplied = false): CrewTransitionPresentation {
  const action = getCrewOperableTransitionAction(visit);
  if (!action) {
    return {
      enabled: false,
      label: "No crew transition available",
      stateLabel: "Server-authorized transition unavailable",
      disabledReason: "Product exposes only ASSIGNED→EN_ROUTE, EN_ROUTE→START and IN_PROGRESS→SUBMIT_REVIEW to crew users.",
    };
  }

  return {
    action,
    enabled: supplied,
    label: supplied ? crewActionLabel[action] : `${crewActionLabel[action]} · fixture preview`,
    stateLabel: supplied ? "Ready for server transitionVisit command" : "FIXTURE_UI_ONLY / NOT_MUTATED",
    disabledReason: supplied ? undefined : "Fixture/demo route does not execute crew mutations.",
  };
}

export function createCrewTransitionServerActionFactory(commands: CrewTransitionCommandPort) {
  return async function transitionCrewVisit(input: CrewTransitionActionInput): Promise<ProductActionResult<VisitDTO>> {
    const steps = ["transitionVisit"];
    const action = getCrewOperableTransitionAction(input.visit);

    if (!action) {
      return productActionFailure(
        error("INVALID_CREW_TRANSITION", "This visit status does not expose a crew-operable transition."),
        steps,
        "transitionVisit",
      );
    }

    if (input.requestedAction && input.requestedAction !== action) {
      return productActionFailure(
        error("INVALID_CREW_TRANSITION", "Requested crew transition does not match the current visit status."),
        steps,
        "transitionVisit",
      );
    }

    const meta: CommandMeta = {
      idempotencyKey: input.idempotencyKey,
      expectedVersion: input.visit.version,
      now: input.now,
    };

    const result = await commands.transitionVisit(input.ctx, input.visit.id, action, meta);
    return result.ok
      ? productActionSuccess(result.value, steps, "Crew visit transition accepted by the server.")
      : productActionFailure(coreFailure(result), steps, "transitionVisit");
  };
}
