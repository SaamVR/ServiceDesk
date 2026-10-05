import type { AttentionItemDTO, VisitDTO } from "@/contracts";
import { buildDispatchRecommendations, type DispatchSnapshot } from "@/features/dispatch/recommendations";
import { buildCrewDayTimeline } from "@/features/dispatch/timeline";
import type { OperationalStaffSnapshot } from "./operational-product-runtime";

function visitStatus(value: string): VisitDTO["status"] {
  const supported: VisitDTO["status"][] = [
    "AWAITING_PAYMENT",
    "CONFIRMED",
    "ASSIGNED",
    "EN_ROUTE",
    "IN_PROGRESS",
    "PENDING_REVIEW",
    "COMPLETED",
    "CANCELLED",
    "PAYMENT_REVIEW",
  ];
  return supported.includes(value as VisitDTO["status"])
    ? (value as VisitDTO["status"])
    : "CONFIRMED";
}

export function buildOperationalDispatchIntelligence(data: OperationalStaffSnapshot) {
  const requestById = new Map(data.requests.map((request) => [request.id, request]));
  const snapshot: DispatchSnapshot = {
    crews: data.crews.map((crew) => ({
      id: crew.id,
      workspaceId: data.workspace.id,
      active: crew.active,
    })),
    visits: data.visits.map((visit) => ({
      id: visit.id,
      workspaceId: data.workspace.id,
      requestId: visit.requestId,
      quoteId: visit.quoteId,
      crewId: visit.crewId,
      status: visitStatus(visit.status),
      startAt: visit.startAt,
      serviceMinutes: visit.serviceMinutes,
      bufferMinutes: visit.bufferMinutes,
      version: visit.version,
      serviceCode: requestById.get(visit.requestId)?.serviceCode,
    })),
    attentionItems: data.attentionItems.map((item): AttentionItemDTO => ({
      id: item.id,
      workspaceId: data.workspace.id,
      type: item.type,
      severity: item.severity,
      status:
        item.status === "ACKNOWLEDGED" || item.status === "RESOLVED"
          ? item.status
          : "OPEN",
      resourceType: item.resourceType,
      resourceId: item.resourceId,
      ownerUserId: item.ownerUserId,
      dueAt: item.dueAt,
      summary: item.summary,
    })),
  };

  return {
    recommendations: buildDispatchRecommendations(snapshot),
    timeline: buildCrewDayTimeline(snapshot),
  };
}
