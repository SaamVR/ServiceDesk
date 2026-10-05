import type {
  ActorContext,
  AttentionItemDTO,
  RequestDTO,
  Result,
  VisitChecklistItemDTO,
  VisitDTO,
  VisitEvidenceDTO,
} from "@/contracts";
import { createCrewSyncState } from "./sync-state";
import type { CrewAuthorizedContext, CrewJobDetailInput, CrewTodayJobInput } from "./v2-field-models";

export interface CrewVisitContextSnapshot extends CrewAuthorizedContext {
  visitId: string;
  authorized: true;
}

export interface CrewFieldReadSnapshot {
  workspaceId: string;
  workspaceTimeZone?: string;
  scope: "ASSIGNED_CREW_ONLY";
  requests: readonly RequestDTO[];
  visits: readonly VisitDTO[];
  visitEvidence: readonly VisitEvidenceDTO[];
  visitChecklistItems: readonly VisitChecklistItemDTO[];
  attentionItems: readonly AttentionItemDTO[];
  visitContexts: readonly CrewVisitContextSnapshot[];
}

export interface CrewFieldReadQuery {
  now: string;
  visitId?: string;
}

export interface CrewFieldReadPort {
  readCrewFieldSnapshot(ctx: ActorContext, query: CrewFieldReadQuery): Promise<Result<CrewFieldReadSnapshot>>;
}

export interface CrewTodayRouteData {
  workspaceTimeZone?: string;
  jobs: CrewTodayJobInput[];
  attentionItems: readonly AttentionItemDTO[];
}

export interface CrewJobRouteData {
  workspaceTimeZone?: string;
  job: CrewJobDetailInput;
}

function fail<T>(code: string, message: string): Result<T> {
  return { ok: false, code, message };
}

function requireCrewActor(ctx: ActorContext): Result<true> {
  if (ctx.role !== "CREW" || !ctx.userId) {
    return fail("CREW_AUTH_REQUIRED", "Signed-in crew access is required.");
  }
  return { ok: true, value: true };
}

function validateSnapshot(ctx: ActorContext, snapshot: CrewFieldReadSnapshot): Result<true> {
  if (snapshot.workspaceId !== ctx.workspaceId) {
    return fail("WORKSPACE_MISMATCH", "Crew snapshot belongs to a different workspace.");
  }
  if (snapshot.scope !== "ASSIGNED_CREW_ONLY") {
    return fail("CREW_SCOPE_INVALID", "Crew snapshot is not restricted to assigned work.");
  }

  const resources: Array<readonly { workspaceId: string }[]> = [
    snapshot.requests,
    snapshot.visits,
    snapshot.visitEvidence,
    snapshot.visitChecklistItems,
    snapshot.attentionItems,
  ];
  if (resources.some((items) => items.some((item) => item.workspaceId !== ctx.workspaceId))) {
    return fail("WORKSPACE_MISMATCH", "Crew snapshot contains data from another workspace.");
  }
  if (snapshot.visits.some((visit) => !visit.crewId)) {
    return fail("CREW_SCOPE_INVALID", "Crew snapshot contains unassigned visits.");
  }

  const visitIds = new Set(snapshot.visits.map((visit) => visit.id));
  if (snapshot.visitContexts.some((context) => !context.authorized || !visitIds.has(context.visitId))) {
    return fail("CREW_CONTEXT_SCOPE_INVALID", "Crew context is not scoped to an assigned visit.");
  }

  return { ok: true, value: true };
}

function contextFor(snapshot: CrewFieldReadSnapshot, visitId: string): CrewAuthorizedContext {
  return snapshot.visitContexts.find((context) => context.visitId === visitId)
    ?? { authorized: true };
}

function requestFor(snapshot: CrewFieldReadSnapshot, visit: VisitDTO): Result<RequestDTO> {
  const request = snapshot.requests.find((candidate) => candidate.id === visit.requestId);
  if (!request) return fail("CREW_REQUEST_CONTEXT_MISSING", "Service details are unavailable for this assigned visit.");
  if (request.workspaceId !== visit.workspaceId) {
    return fail("WORKSPACE_MISMATCH", "Visit request belongs to a different workspace.");
  }
  return { ok: true, value: request };
}

function jobInput(snapshot: CrewFieldReadSnapshot, visit: VisitDTO): Result<CrewJobDetailInput> {
  const request = requestFor(snapshot, visit);
  if (!request.ok) return request as Result<CrewJobDetailInput>;

  return {
    ok: true,
    value: {
      request: request.value,
      visit,
      context: contextFor(snapshot, visit.id),
      sync: createCrewSyncState(true),
      workspaceTimeZone: snapshot.workspaceTimeZone,
      evidence: snapshot.visitEvidence.filter((item) => item.visitId === visit.id),
      checklist: snapshot.visitChecklistItems.filter((item) => item.visitId === visit.id),
      attentionItems: snapshot.attentionItems.filter((item) => item.resourceId === visit.id),
      uploadTransportAvailable: false,
    },
  };
}

export function createCrewFieldReadFactory(port: CrewFieldReadPort) {
  return {
    async loadToday(ctx: ActorContext, now: string): Promise<Result<CrewTodayRouteData>> {
      const authorized = requireCrewActor(ctx);
      if (!authorized.ok) return authorized as Result<CrewTodayRouteData>;

      const result = await port.readCrewFieldSnapshot(ctx, { now });
      if (!result.ok) return result as Result<CrewTodayRouteData>;

      const valid = validateSnapshot(ctx, result.value);
      if (!valid.ok) return valid as Result<CrewTodayRouteData>;

      const jobs: CrewTodayJobInput[] = [];
      for (const visit of result.value.visits) {
        const request = requestFor(result.value, visit);
        if (!request.ok) return request as Result<CrewTodayRouteData>;
        jobs.push({
          request: request.value,
          visit,
          context: contextFor(result.value, visit.id),
          sync: createCrewSyncState(true),
          workspaceTimeZone: result.value.workspaceTimeZone,
          evidence: result.value.visitEvidence.filter((item) => item.visitId === visit.id),
          checklist: result.value.visitChecklistItems.filter((item) => item.visitId === visit.id),
        });
      }

      return {
        ok: true,
        value: {
          workspaceTimeZone: result.value.workspaceTimeZone,
          jobs,
          attentionItems: result.value.attentionItems,
        },
      };
    },

    async loadJob(ctx: ActorContext, visitId: string, now: string): Promise<Result<CrewJobRouteData>> {
      const authorized = requireCrewActor(ctx);
      if (!authorized.ok) return authorized as Result<CrewJobRouteData>;

      const result = await port.readCrewFieldSnapshot(ctx, { now, visitId });
      if (!result.ok) return result as Result<CrewJobRouteData>;

      const valid = validateSnapshot(ctx, result.value);
      if (!valid.ok) return valid as Result<CrewJobRouteData>;

      const visit = result.value.visits.find((candidate) => candidate.id === visitId);
      if (!visit) return fail("CREW_VISIT_NOT_FOUND", "This assigned job is no longer available.");

      const job = jobInput(result.value, visit);
      if (!job.ok) return job as Result<CrewJobRouteData>;

      return {
        ok: true,
        value: {
          workspaceTimeZone: result.value.workspaceTimeZone,
          job: job.value,
        },
      };
    },
  };
}

export const requiredCrewFieldReadContract = {
  method: "readCrewFieldSnapshot",
  scope: "ASSIGNED_CREW_ONLY",
  requiredData: [
    "workspace timezone",
    "assigned visits",
    "request/service context",
    "authorized property/customer context",
    "visit evidence",
    "visit checklist items",
    "visit attention items",
  ],
} as const;
