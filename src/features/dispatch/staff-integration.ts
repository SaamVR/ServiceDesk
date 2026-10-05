import type { AttentionItemDTO, VisitDTO } from "@/contracts";
import {
  buildDispatchRecommendations,
  type DispatchCrewSnapshot,
  type DispatchSnapshot,
  type DispatchVisitRecommendation,
} from "./recommendations";
import { buildCrewDayTimeline, type DispatchCrewDayLane } from "./timeline";

export interface DispatchStaffModuleView {
  recommendations: DispatchVisitRecommendation[];
  timeline: DispatchCrewDayLane[];
  unassignedCount: number;
  eligibleRecommendationCount: number;
  scheduleConflictCount: number;
  humanApprovalRequired: true;
}

export interface DispatchStaffSourceVisit {
  id: string;
  requestId: string;
  quoteId?: string;
  crewId?: string;
  status: string;
  startAt?: string;
  endAt?: string;
  version: number;
}

export interface DispatchStaffSourceRequest {
  id: string;
  serviceCode?: string;
}

export interface DispatchStaffSourceQuote {
  id: string;
  durationMinutes?: number;
}

export interface DispatchStaffSourceAttention {
  id: string;
  type: string;
  severity: AttentionItemDTO["severity"];
  status: string;
  resourceType: string;
  resourceId: string;
  summary: string;
}

export type DispatchStaffDataQualityCode =
  | "MISSING_START_TIME"
  | "MISSING_QUOTE"
  | "MISSING_DURATION"
  | "INVALID_SCHEDULE_WINDOW"
  | "UNSUPPORTED_VISIT_STATUS";

export interface DispatchStaffDataQualityIssue {
  visitId: string;
  code: DispatchStaffDataQualityCode;
  message: string;
}

export interface BuildDispatchStaffSnapshotInput {
  workspaceId: string;
  visits: readonly DispatchStaffSourceVisit[];
  requests: readonly DispatchStaffSourceRequest[];
  quotes: readonly DispatchStaffSourceQuote[];
  crews: readonly DispatchCrewSnapshot[];
  attentionItems?: readonly DispatchStaffSourceAttention[];
}

export interface BuiltDispatchStaffSnapshot {
  snapshot: DispatchSnapshot;
  dataQualityIssues: DispatchStaffDataQualityIssue[];
}

const supportedVisitStatuses: ReadonlySet<VisitDTO["status"]> = new Set([
  "AWAITING_PAYMENT",
  "CONFIRMED",
  "ASSIGNED",
  "EN_ROUTE",
  "IN_PROGRESS",
  "PENDING_REVIEW",
  "COMPLETED",
  "CANCELLED",
  "PAYMENT_REVIEW",
]);

function issue(
  visitId: string,
  code: DispatchStaffDataQualityCode,
  message: string,
): DispatchStaffDataQualityIssue {
  return { visitId, code, message };
}

export function buildDispatchStaffSnapshot(
  input: BuildDispatchStaffSnapshotInput,
): BuiltDispatchStaffSnapshot {
  const requestById = new Map(input.requests.map((request) => [request.id, request]));
  const quoteById = new Map(input.quotes.map((quote) => [quote.id, quote]));
  const visits: DispatchSnapshot["visits"][number][] = [];
  const dataQualityIssues: DispatchStaffDataQualityIssue[] = [];

  for (const visit of input.visits) {
    if (!visit.startAt) {
      dataQualityIssues.push(issue(visit.id, "MISSING_START_TIME", "Job has no scheduled start time."));
      continue;
    }
    if (!visit.quoteId) {
      dataQualityIssues.push(issue(visit.id, "MISSING_QUOTE", "Job has no quote reference for duration."));
      continue;
    }
    if (!supportedVisitStatuses.has(visit.status as VisitDTO["status"])) {
      dataQualityIssues.push(issue(visit.id, "UNSUPPORTED_VISIT_STATUS", "Job status is not supported by dispatch suggestions."));
      continue;
    }

    const quote = quoteById.get(visit.quoteId);
    const startMs = Date.parse(visit.startAt);
    const endMs = visit.endAt ? Date.parse(visit.endAt) : Number.NaN;
    const totalMinutes = Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs
      ? Math.round((endMs - startMs) / 60_000)
      : undefined;
    const quotedServiceMinutes =
      typeof quote?.durationMinutes === "number" && quote.durationMinutes > 0
        ? quote.durationMinutes
        : undefined;
    const serviceMinutes = quotedServiceMinutes ?? totalMinutes;

    if (!serviceMinutes || serviceMinutes <= 0) {
      dataQualityIssues.push(issue(visit.id, "MISSING_DURATION", "Job duration is unavailable for dispatch scoring."));
      continue;
    }
    if (visit.endAt && totalMinutes === undefined) {
      dataQualityIssues.push(issue(visit.id, "INVALID_SCHEDULE_WINDOW", "Job end time is not after its start time."));
      continue;
    }
    if (
      totalMinutes !== undefined
      && quotedServiceMinutes !== undefined
      && quotedServiceMinutes > totalMinutes
    ) {
      dataQualityIssues.push(issue(
        visit.id,
        "INVALID_SCHEDULE_WINDOW",
        "Scheduled window is shorter than the quoted service duration.",
      ));
      continue;
    }

    const bufferMinutes = totalMinutes === undefined
      ? 0
      : totalMinutes - serviceMinutes;
    const request = requestById.get(visit.requestId);

    visits.push({
      id: visit.id,
      workspaceId: input.workspaceId,
      requestId: visit.requestId,
      quoteId: visit.quoteId,
      crewId: visit.crewId,
      status: visit.status as VisitDTO["status"],
      startAt: visit.startAt,
      serviceMinutes,
      bufferMinutes,
      version: visit.version,
      serviceCode: request?.serviceCode,
    });
  }

  const attentionItems: AttentionItemDTO[] = (input.attentionItems ?? []).map((item) => ({
    id: item.id,
    workspaceId: input.workspaceId,
    type: item.type,
    severity: item.severity,
    status: item.status as AttentionItemDTO["status"],
    resourceType: item.resourceType,
    resourceId: item.resourceId,
    summary: item.summary,
  }));

  return {
    snapshot: {
      visits,
      crews: input.crews.filter((crew) => crew.workspaceId === input.workspaceId),
      attentionItems,
    },
    dataQualityIssues,
  };
}

export function buildDispatchStaffModule(snapshot: DispatchSnapshot): DispatchStaffModuleView {
  const recommendations = buildDispatchRecommendations(snapshot);
  const timeline = buildCrewDayTimeline(snapshot);

  return {
    recommendations,
    timeline,
    unassignedCount: recommendations.length,
    eligibleRecommendationCount: recommendations.filter((recommendation) =>
      recommendation.candidates.some((candidate) => candidate.eligible),
    ).length,
    scheduleConflictCount: timeline.reduce((sum, lane) => sum + lane.conflictCount, 0),
    humanApprovalRequired: true,
  };
}

export const requiredDispatchStaffReadContract = {
  required: [
    "workspace id and IANA timezone",
    "visits with start/end/version/current crew",
    "request service code",
    "quote service duration",
    "active crews in the same workspace",
    "crew availability",
    "crew service eligibility when persisted",
    "open visit attention items",
  ],
  rule: "Do not infer active crew eligibility or routing data from capacity slots alone.",
} as const;
