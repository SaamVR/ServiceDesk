import {
  buildDispatchRecommendations,
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
