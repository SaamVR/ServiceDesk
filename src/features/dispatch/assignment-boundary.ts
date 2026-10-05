import type { ActorContext, CommandMeta, Result, VisitDTO } from "@/contracts";
import {
  buildDispatchRecommendations,
  type DispatchSnapshot,
  type DispatchVisitRecommendation,
} from "./recommendations";

export interface AssignCrewInput {
  crewId: string;
}

export interface AuthoritativeCrewAssignmentCommandPort {
  assignCrew(
    ctx: ActorContext,
    visitId: string,
    input: AssignCrewInput,
    meta: CommandMeta,
  ): Promise<Result<VisitDTO>>;
}

export interface DispatchAssignmentAvailability {
  enabled: boolean;
  label: string;
  disabledReason?: string;
}

export type DispatchAssignmentErrorCode =
  | "DISPATCH_ASSIGNMENT_COMMAND_UNAVAILABLE"
  | "DISPATCH_APPROVAL_FORBIDDEN"
  | "DISPATCH_WORKSPACE_MISMATCH"
  | "DISPATCH_RECOMMENDATION_STALE"
  | "DISPATCH_CANDIDATE_CONFLICT"
  | "DISPATCH_ASSIGNMENT_RESULT_INVALID"
  | string;

export type DispatchAssignmentResult =
  | { ok: true; value: VisitDTO; recommendation: DispatchVisitRecommendation }
  | { ok: false; code: DispatchAssignmentErrorCode; message: string; rebuildRecommendation: boolean };

export interface DispatchAssignmentRequest {
  ctx: ActorContext;
  recommendation: DispatchVisitRecommendation;
  candidateCrewId: string;
  freshSnapshot: DispatchSnapshot;
  idempotencyKey: string;
  now: string;
}

export const requiredCoreAssignmentContract = {
  method: "assignCrew",
  signature: "assignCrew(ctx, visitId, { crewId }, { idempotencyKey, expectedVersion, now })",
  protections: [
    "workspace scope",
    "OWNER/DISPATCHER role",
    "active target crew in same workspace",
    "expected visit version",
    "schedule conflict recheck",
    "idempotency",
  ],
} as const;

export function buildDispatchAssignmentAvailability(
  command?: AuthoritativeCrewAssignmentCommandPort,
): DispatchAssignmentAvailability {
  return command
    ? { enabled: true, label: "Assignment available" }
    : {
        enabled: false,
        label: "Assignment unavailable",
        disabledReason: "Crew changes are not available from this screen yet.",
      };
}

function reject(
  code: DispatchAssignmentErrorCode,
  message: string,
  rebuildRecommendation = false,
): DispatchAssignmentResult {
  return { ok: false, code, message, rebuildRecommendation };
}

export function createDispatcherAssignmentApprovalFactory(
  command?: AuthoritativeCrewAssignmentCommandPort,
) {
  const availability = buildDispatchAssignmentAvailability(command);

  return {
    availability,

    async approve(input: DispatchAssignmentRequest): Promise<DispatchAssignmentResult> {
      if (
        !input.ctx.userId
        || (input.ctx.role !== "OWNER" && input.ctx.role !== "DISPATCHER")
      ) {
        return reject("DISPATCH_APPROVAL_FORBIDDEN", "Dispatcher access is required.");
      }

      if (input.recommendation.workspaceId !== input.ctx.workspaceId) {
        return reject("DISPATCH_WORKSPACE_MISMATCH", "This recommendation belongs to another workspace.");
      }

      const currentVisit = input.freshSnapshot.visits.find(
        (visit) => visit.id === input.recommendation.visitId,
      );
      if (!currentVisit || currentVisit.workspaceId !== input.ctx.workspaceId) {
        return reject("DISPATCH_RECOMMENDATION_STALE", "This job is no longer available for assignment.", true);
      }

      if (currentVisit.version !== input.recommendation.visitVersion || currentVisit.crewId) {
        return reject("DISPATCH_RECOMMENDATION_STALE", "This job changed. Rebuild suggestions before assigning.", true);
      }

      const freshRecommendation = buildDispatchRecommendations(input.freshSnapshot)
        .find((recommendation) => recommendation.visitId === input.recommendation.visitId);

      if (!freshRecommendation || freshRecommendation.visitVersion !== currentVisit.version) {
        return reject("DISPATCH_RECOMMENDATION_STALE", "This job changed. Rebuild suggestions before assigning.", true);
      }

      const candidate = freshRecommendation.candidates.find(
        (item) => item.candidateCrewId === input.candidateCrewId,
      );
      if (!candidate || !candidate.eligible) {
        return reject("DISPATCH_CANDIDATE_CONFLICT", "That crew is no longer eligible for this job.", true);
      }

      const targetCrew = input.freshSnapshot.crews.find((crew) => crew.id === input.candidateCrewId);
      if (!targetCrew || targetCrew.workspaceId !== input.ctx.workspaceId || !targetCrew.active) {
        return reject("DISPATCH_CANDIDATE_CONFLICT", "That crew is no longer available for assignment.", true);
      }

      if (!command) {
        return reject(
          "DISPATCH_ASSIGNMENT_COMMAND_UNAVAILABLE",
          "Crew changes are not available from this screen yet.",
        );
      }

      const result = await command.assignCrew(
        input.ctx,
        currentVisit.id,
        { crewId: input.candidateCrewId },
        {
          idempotencyKey: input.idempotencyKey,
          expectedVersion: currentVisit.version,
          now: input.now,
        },
      );

      if (!result.ok) {
        const rebuildRecommendation = [
          "VERSION_CONFLICT",
          "STALE_VERSION",
          "SCHEDULE_CONFLICT",
          "CREW_UNAVAILABLE",
          "CREW_NOT_ELIGIBLE",
        ].includes(result.code);
        return reject(result.code, result.message, rebuildRecommendation);
      }

      if (
        result.value.workspaceId !== input.ctx.workspaceId
        || result.value.id !== currentVisit.id
        || result.value.crewId !== input.candidateCrewId
      ) {
        return reject(
          "DISPATCH_ASSIGNMENT_RESULT_INVALID",
          "The assignment result did not match the approved job and crew.",
          true,
        );
      }

      return { ok: true, value: result.value, recommendation: freshRecommendation };
    },
  };
}
