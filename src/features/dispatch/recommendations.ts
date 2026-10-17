import type { ActorRole, AttentionItemDTO, VisitDTO } from "@/contracts";

export interface DispatchVisitSnapshot extends VisitDTO {
  serviceCode?: string;
}

export interface DispatchCrewSnapshot {
  id: string;
  workspaceId: string;
  active: boolean;
  availableFrom?: string;
  availableTo?: string;
  serviceCodes?: readonly string[];
}

export interface DispatchSnapshot {
  visits: readonly DispatchVisitSnapshot[];
  crews: readonly DispatchCrewSnapshot[];
  attentionItems?: readonly AttentionItemDTO[];
}

export type DispatchConflictCode =
  | "CREW_WORKSPACE_MISMATCH"
  | "CREW_INACTIVE"
  | "OUTSIDE_AVAILABILITY"
  | "SERVICE_CONSTRAINT_MISMATCH"
  | "SCHEDULE_OVERLAP"
  | "SCHEDULE_UNVERIFIED";

export interface DispatchCandidateRecommendation {
  visitId: string;
  candidateCrewId: string;
  score: number;
  rank: number;
  eligible: boolean;
  reasons: string[];
  conflicts: DispatchConflictCode[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
  humanApprovalRequired: true;
  routeEfficiency: "NOT_SCORED_NO_GEOGRAPHY";
  currentWorkloadMinutes: number;
}

export interface DispatchVisitRecommendation {
  workspaceId: string;
  visitId: string;
  visitVersion: number;
  candidates: DispatchCandidateRecommendation[];
  attentionReasons: string[];
  humanApprovalRequired: true;
}

/** Times and durations are source facts, not inferred availability. Invalid
 * recovered appointment data must never score as "no schedule overlap". */
function verifiedZonedInstant(input: unknown): number | null {
  if (typeof input !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(input);
  if (!match) return null;
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
  const hour=Number(match[4]),minute=Number(match[5]),second=Number(match[6]);
  if (year<1000 || month<1 || month>12 || day<1 || day>31 ||
      hour>23 || minute>59 || second>59) return null;
  const civil=new Date(Date.UTC(year,month-1,day));
  if (civil.getUTCFullYear()!==year || civil.getUTCMonth()+1!==month || civil.getUTCDate()!==day) return null;
  if (match[8]!=="Z") {
    const tzHours=Number(match[10]),tzMinutes=Number(match[11]);
    if (tzHours>14 || tzMinutes>59 || (tzHours===14&&tzMinutes!==0)) return null;
  }
  const ms=Date.parse(input);
  return Number.isFinite(ms)?ms:null;
}
function validVisitInterval(visit: DispatchVisitSnapshot): boolean {
  const start=verifiedZonedInstant(visit.startAt);
  return start!==null &&
    Number.isSafeInteger(visit.serviceMinutes) && visit.serviceMinutes>0 &&
    Number.isSafeInteger(visit.bufferMinutes) && visit.bufferMinutes>=0 &&
    visit.serviceMinutes+visit.bufferMinutes<=24*60;
}

function interval(visit: DispatchVisitSnapshot) {
  const start = new Date(visit.startAt).getTime();
  return { start, end: start + (visit.serviceMinutes + visit.bufferMinutes) * 60_000 };
}

function overlaps(a: DispatchVisitSnapshot, b: DispatchVisitSnapshot) {
  const left = interval(a);
  const right = interval(b);
  return left.start < right.end && right.start < left.end;
}

function scheduledForCrew(snapshot: DispatchSnapshot, crewId: string, excludingVisitId: string) {
  return snapshot.visits.filter((visit) =>
    visit.id !== excludingVisitId
    && visit.crewId === crewId
    && visit.status !== "CANCELLED",
  );
}

function workloadMinutes(visits: readonly DispatchVisitSnapshot[]) {
  return visits.reduce((sum, visit) => sum + visit.serviceMinutes + visit.bufferMinutes, 0);
}

function confidence(crew: DispatchCrewSnapshot, visit: DispatchVisitSnapshot): DispatchCandidateRecommendation["confidence"] {
  const availabilityKnown = Boolean(crew.availableFrom && crew.availableTo);
  const skillKnown = Boolean(visit.serviceCode && crew.serviceCodes && crew.serviceCodes.length > 0);
  if (availabilityKnown && skillKnown) return "HIGH";
  if (availabilityKnown || skillKnown) return "MEDIUM";
  return "LOW";
}

function candidateFor(snapshot: DispatchSnapshot, visit: DispatchVisitSnapshot, crew: DispatchCrewSnapshot): DispatchCandidateRecommendation {
  const existing = scheduledForCrew(snapshot, crew.id, visit.id);
  const conflicts: DispatchConflictCode[] = [];
  const reasons: string[] = [];

  if (crew.workspaceId !== visit.workspaceId) conflicts.push("CREW_WORKSPACE_MISMATCH");
  if (!crew.active) conflicts.push("CREW_INACTIVE");
  const sourceSafe=validVisitInterval(visit) &&
    existing.every(item=>validVisitInterval(item) && item.workspaceId===visit.workspaceId);
  if (!sourceSafe) conflicts.push("SCHEDULE_UNVERIFIED");

  // A missing availability pair is unknown (not confirmed). A partial or
  // malformed pair is contradictory stored evidence and cannot authorize crew.
  if (crew.availableFrom !== undefined || crew.availableTo !== undefined) {
    const from=verifiedZonedInstant(crew.availableFrom);
    const to=verifiedZonedInstant(crew.availableTo);
    if (from===null || to===null || from>=to) {
      if (!conflicts.includes("SCHEDULE_UNVERIFIED")) conflicts.push("SCHEDULE_UNVERIFIED");
    } else if (validVisitInterval(visit)) {
      const visitRange=interval(visit);
      if (visitRange.start<from || visitRange.end>to) conflicts.push("OUTSIDE_AVAILABILITY");
      else reasons.push("Within crew availability");
    }
  }

  if (visit.serviceCode && crew.serviceCodes && crew.serviceCodes.length > 0) {
    if (!crew.serviceCodes.includes(visit.serviceCode)) conflicts.push("SERVICE_CONSTRAINT_MISMATCH");
    else reasons.push("Service match");
  }

  if (sourceSafe) {
    if (existing.some((assigned) => overlaps(visit, assigned))) conflicts.push("SCHEDULE_OVERLAP");
    else reasons.push("No schedule overlap");
  } else {
    reasons.push("Stored visit timing requires review");
  }

  const workload = workloadMinutes(existing);
  reasons.push("Scheduled workload " + workload + " minutes");

  const eligible = conflicts.length === 0;
  const score = eligible ? 100_000 - workload * 10 - existing.length * 1_000 : -100_000 - conflicts.length * 1_000;

  return {
    visitId: visit.id,
    candidateCrewId: crew.id,
    score,
    rank: 0,
    eligible,
    reasons,
    conflicts,
    confidence: confidence(crew, visit),
    humanApprovalRequired: true,
    routeEfficiency: "NOT_SCORED_NO_GEOGRAPHY",
    currentWorkloadMinutes: workload,
  };
}

export function buildDispatchRecommendations(snapshot: DispatchSnapshot): DispatchVisitRecommendation[] {
  const unassigned = snapshot.visits
    .filter((visit) => !visit.crewId && !["CANCELLED", "COMPLETED"].includes(visit.status))
    .sort((a, b) => a.startAt.localeCompare(b.startAt) || a.id.localeCompare(b.id));

  return unassigned.map((visit) => {
    const candidates = snapshot.crews
      .map((crew) => candidateFor(snapshot, visit, crew))
      .sort((a, b) =>
        Number(b.eligible) - Number(a.eligible)
        || b.score - a.score
        || a.candidateCrewId.localeCompare(b.candidateCrewId),
      )
      .map((candidate, index) => ({ ...candidate, rank: index + 1 }));

    const attentionReasons = (snapshot.attentionItems ?? [])
      .filter((item) => item.workspaceId === visit.workspaceId && item.resourceId === visit.id && item.status !== "RESOLVED")
      .map((item) => item.summary)
      .sort();

    return {
      workspaceId: visit.workspaceId,
      visitId: visit.id,
      visitVersion: visit.version,
      candidates,
      attentionReasons,
      humanApprovalRequired: true as const,
    };
  });
}

export interface DispatchApprovalIntent {
  status: "APPROVAL_READY_FOR_COMMAND";
  visitId: string;
  candidateCrewId: string;
  expectedVersion: number;
  approvedByRole: Extract<ActorRole, "OWNER" | "DISPATCHER">;
  humanApprovalRequired: true;
  mutationReady: true;
}

export type DispatchApprovalResult =
  | { ok: true; value: DispatchApprovalIntent }
  | { ok: false; code: "DISPATCH_APPROVAL_FORBIDDEN" | "DISPATCH_CANDIDATE_CONFLICT"; message: string };

export function approveDispatchRecommendation(input: {
  recommendation: DispatchVisitRecommendation;
  candidateCrewId: string;
  actorRole: ActorRole;
}): DispatchApprovalResult {
  if (input.actorRole !== "OWNER" && input.actorRole !== "DISPATCHER") {
    return { ok: false, code: "DISPATCH_APPROVAL_FORBIDDEN", message: "Only owner or dispatcher roles may approve assignment advice." };
  }

  const candidate = input.recommendation.candidates.find((item) => item.candidateCrewId === input.candidateCrewId);
  if (!candidate || !candidate.eligible) {
    return { ok: false, code: "DISPATCH_CANDIDATE_CONFLICT", message: "Conflicted or missing recommendations cannot be approved." };
  }

  return {
    ok: true,
    value: {
      status: "APPROVAL_READY_FOR_COMMAND",
      visitId: input.recommendation.visitId,
      candidateCrewId: candidate.candidateCrewId,
      expectedVersion: input.recommendation.visitVersion,
      approvedByRole: input.actorRole,
      humanApprovalRequired: true,
      mutationReady: true,
    },
  };
}
