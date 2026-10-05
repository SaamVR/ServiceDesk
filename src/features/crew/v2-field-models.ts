import type { RequestDTO, VisitChecklistItemDTO, VisitDTO, VisitEvidenceDTO } from "@/contracts";
import { getCrewOperableTransitionAction } from "./server-boundary";
import type { CrewSyncState } from "./sync-state";
import { syncStatusLabel } from "./sync-state";

export interface CrewAuthorizedContext {
  authorized: boolean;
  locationLabel?: string;
  customerLabel?: string;
  serviceNotes?: string;
  accessNotes?: string;
  highPriorityNotes?: readonly string[];
}

export interface CrewTodayJobInput {
  request: RequestDTO;
  visit: VisitDTO;
  context: CrewAuthorizedContext;
  sync: CrewSyncState;
}

export interface CrewTodayJobView {
  visitId: string;
  serviceLabel: string;
  timeWindowLabel: string;
  statusLabel: string;
  locationLabel: string;
  customerLabel?: string;
  highPriorityNotes: readonly string[];
  progressPercent: number;
  nextActionLabel: string;
  syncLabel: string;
  operationalException?: "LATE_UNSTARTED" | "SYNC_CONFLICT";
}

const progressByStatus: Record<VisitDTO["status"], number> = {
  AWAITING_PAYMENT: 0,
  PAYMENT_REVIEW: 0,
  CONFIRMED: 10,
  ASSIGNED: 20,
  EN_ROUTE: 40,
  IN_PROGRESS: 65,
  PENDING_REVIEW: 85,
  COMPLETED: 100,
  CANCELLED: 100,
};

function endAt(visit: VisitDTO) {
  return new Date(new Date(visit.startAt).getTime() + (visit.serviceMinutes + visit.bufferMinutes) * 60_000);
}

function formatWindow(visit: VisitDTO, timeZone = "UTC") {
  const start = new Date(visit.startAt);
  const end = endAt(visit);
  const format = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone });
  return `${format.format(start)}–${format.format(end)}`;
}

function statusLabel(status: VisitDTO["status"]) {
  return status.replaceAll("_", " ").toLowerCase();
}

function nextActionLabel(visit: VisitDTO) {
  const action = getCrewOperableTransitionAction(visit);
  if (action === "EN_ROUTE") return "Mark en route";
  if (action === "START") return "Start job";
  if (action === "SUBMIT_REVIEW") return "Submit review";
  if (visit.status === "PENDING_REVIEW") return "Await dispatcher review";
  if (visit.status === "COMPLETED") return "Completed";
  if (visit.status === "CANCELLED") return "No action · cancelled";
  return "Dispatcher action required";
}

function exceptionFor(visit: VisitDTO, sync: CrewSyncState, now: string): CrewTodayJobView["operationalException"] {
  if (sync.status === "VERSION_CONFLICT" || sync.status === "ACTION_NO_LONGER_VALID") return "SYNC_CONFLICT";
  const late = new Date(visit.startAt).getTime() < new Date(now).getTime()
    && ["CONFIRMED", "ASSIGNED"].includes(visit.status);
  return late ? "LATE_UNSTARTED" : undefined;
}

export function buildCrewTodayJobs(
  jobs: readonly CrewTodayJobInput[],
  now: string,
  timeZone = "UTC",
): CrewTodayJobView[] {
  return [...jobs]
    .sort((a, b) => a.visit.startAt.localeCompare(b.visit.startAt) || a.visit.id.localeCompare(b.visit.id))
    .map(({ request, visit, context, sync }) => ({
      visitId: visit.id,
      serviceLabel: request.serviceCode ?? "Service visit",
      timeWindowLabel: formatWindow(visit, timeZone),
      statusLabel: statusLabel(visit.status),
      locationLabel: context.authorized ? context.locationLabel ?? "Address unavailable" : "Address hidden",
      customerLabel: context.authorized ? context.customerLabel : undefined,
      highPriorityNotes: context.authorized ? context.highPriorityNotes ?? [] : [],
      progressPercent: progressByStatus[visit.status],
      nextActionLabel: nextActionLabel(visit),
      syncLabel: syncStatusLabel(sync),
      operationalException: exceptionFor(visit, sync, now),
    }));
}

export interface CrewJobDetailInput extends CrewTodayJobInput {
  evidence: readonly VisitEvidenceDTO[];
  checklist: readonly VisitChecklistItemDTO[];
  uploadTransportAvailable: boolean;
}

export interface CrewEvidenceGate {
  beforeEvidencePresent: boolean;
  afterEvidencePresent: boolean;
  requiredEvidenceComplete: boolean;
  canSubmitReview: boolean;
  crewCanComplete: false;
  blocker?: string;
}

export function buildCrewEvidenceGate(
  visit: VisitDTO,
  evidence: readonly VisitEvidenceDTO[],
): CrewEvidenceGate {
  const beforeEvidencePresent = evidence.some((item) => item.kind === "BEFORE_PHOTO");
  const afterEvidencePresent = evidence.some((item) => item.kind === "AFTER_PHOTO");
  const requiredEvidenceComplete = beforeEvidencePresent && afterEvidencePresent;
  const canSubmitReview = visit.status === "IN_PROGRESS" && requiredEvidenceComplete;
  let blocker: string | undefined;
  if (visit.status !== "IN_PROGRESS") blocker = "Review submission is available only while the job is in progress.";
  else if (!beforeEvidencePresent || !afterEvidencePresent) blocker = "Before and after evidence are required before review.";

  return {
    beforeEvidencePresent,
    afterEvidencePresent,
    requiredEvidenceComplete,
    canSubmitReview,
    crewCanComplete: false,
    blocker,
  };
}

export function buildCrewJobDetailView(input: CrewJobDetailInput, timeZone = "UTC") {
  const gate = buildCrewEvidenceGate(input.visit, input.evidence);
  const transition = getCrewOperableTransitionAction(input.visit);
  const completedChecklist = input.checklist.filter((item) => item.completed).length;
  return {
    visitId: input.visit.id,
    version: input.visit.version,
    serviceLabel: input.request.serviceCode ?? "Service visit",
    statusLabel: statusLabel(input.visit.status),
    timeWindowLabel: formatWindow(input.visit, timeZone),
    locationLabel: input.context.authorized ? input.context.locationLabel ?? "Address unavailable" : "Address hidden",
    customerLabel: input.context.authorized ? input.context.customerLabel : undefined,
    serviceNotes: input.context.authorized ? input.context.serviceNotes : undefined,
    accessNotes: input.context.authorized ? input.context.accessNotes : undefined,
    highPriorityNotes: input.context.authorized ? input.context.highPriorityNotes ?? [] : [],
    checklist: input.checklist,
    checklistProgressLabel: `${completedChecklist}/${input.checklist.length} checklist items complete`,
    evidence: input.evidence,
    evidenceGate: gate,
    transitionAction: transition,
    nextActionLabel: nextActionLabel(input.visit),
    syncLabel: syncStatusLabel(input.sync),
    syncState: input.sync.status,
    uploadState: input.uploadTransportAvailable
      ? "Photo evidence can be added from this device."
      : "Photo upload is not available yet. Existing evidence is still shown.",
    authorizationLabel: input.context.authorized ? "Assigned to your crew" : "Job details are restricted.",
  };
}
