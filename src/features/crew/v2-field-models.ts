import type { AttentionItemDTO, RequestDTO, VisitChecklistItemDTO, VisitDTO, VisitEvidenceDTO } from "@/contracts";
import { getCrewOperableTransitionAction } from "./server-boundary";
import type { CrewSyncState } from "./sync-state";
import { buildCrewSyncPresentation } from "./sync-state";
import { formatVisitWindow, isVisitOnOperationalDay } from "./time-format";

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
  workspaceTimeZone?: string;
  evidence?: readonly VisitEvidenceDTO[];
  checklist?: readonly VisitChecklistItemDTO[];
}

export interface CrewTodayJobView {
  visitId: string;
  serviceLabel: string;
  dateLabel: string;
  timeWindowLabel: string;
  timeZoneLabel: string;
  statusLabel: string;
  locationLabel: string;
  customerLabel?: string;
  accessNote?: string;
  serviceNote?: string;
  highPriorityNotes: readonly string[];
  progressPercent: number;
  nextActionLabel: string;
  checklistProgressLabel: string;
  evidenceProgressLabel: string;
  sync: ReturnType<typeof buildCrewSyncPresentation>;
  operationalException?: "LATE_UNSTARTED" | "SYNC_CONFLICT";
}

const crewTimeline = ["ASSIGNED", "EN_ROUTE", "IN_PROGRESS", "PENDING_REVIEW", "COMPLETED"] as const;
type CrewTimelineStatus = (typeof crewTimeline)[number];

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

function statusLabel(status: VisitDTO["status"]) {
  if (status === "PENDING_REVIEW") return "Waiting for review";
  if (status === "IN_PROGRESS") return "In progress";
  if (status === "EN_ROUTE") return "En route";
  if (status === "AWAITING_PAYMENT") return "Waiting for dispatch";
  if (status === "PAYMENT_REVIEW") return "Waiting for dispatch";
  return status.charAt(0) + status.slice(1).toLowerCase().replaceAll("_", " ");
}

function nextActionLabel(visit: VisitDTO) {
  const action = getCrewOperableTransitionAction(visit);
  if (action === "EN_ROUTE") return "Mark en route";
  if (action === "START") return "Start job";
  if (action === "SUBMIT_REVIEW") return "Send for review";
  if (visit.status === "PENDING_REVIEW") return "Waiting for review";
  if (visit.status === "COMPLETED") return "Completed";
  if (visit.status === "CANCELLED") return "Cancelled";
  return "Check with dispatch";
}

function evidenceProgress(evidence: readonly VisitEvidenceDTO[]) {
  const before = evidence.some((item) => item.kind === "BEFORE_PHOTO");
  const after = evidence.some((item) => item.kind === "AFTER_PHOTO");
  return { before, after, completed: Number(before) + Number(after) };
}

function checklistProgress(checklist: readonly VisitChecklistItemDTO[]) {
  return checklist.filter((item) => item.completed).length;
}

function exceptionFor(visit: VisitDTO, sync: CrewSyncState, now: string): CrewTodayJobView["operationalException"] {
  if (sync.status === "VERSION_CONFLICT" || sync.status === "ACTION_NO_LONGER_VALID") return "SYNC_CONFLICT";
  const late = new Date(visit.startAt).getTime() < new Date(now).getTime()
    && ["CONFIRMED", "ASSIGNED"].includes(visit.status);
  return late ? "LATE_UNSTARTED" : undefined;
}

function hasReached(current: VisitDTO["status"], step: CrewTimelineStatus) {
  const currentIndex = crewTimeline.indexOf(current as CrewTimelineStatus);
  const stepIndex = crewTimeline.indexOf(step);
  return currentIndex >= 0 && stepIndex <= currentIndex;
}

export function buildCrewTodayJobs(jobs: readonly CrewTodayJobInput[], now: string): CrewTodayJobView[] {
  return [...jobs]
    .filter((job) => Boolean(job.visit.crewId))
    .filter((job) => isVisitOnOperationalDay(job.visit, now, job.workspaceTimeZone))
    .sort((a, b) => a.visit.startAt.localeCompare(b.visit.startAt) || a.visit.id.localeCompare(b.visit.id))
    .map(({ request, visit, context, sync, workspaceTimeZone, evidence = [], checklist = [] }) => {
      const window = formatVisitWindow(visit, workspaceTimeZone);
      const evidenceState = evidenceProgress(evidence);
      const completedChecklist = checklistProgress(checklist);
      return {
        visitId: visit.id,
        serviceLabel: request.serviceCode ?? "Service visit",
        dateLabel: window.dateLabel,
        timeWindowLabel: window.windowLabel,
        timeZoneLabel: window.timeZoneLabel,
        statusLabel: statusLabel(visit.status),
        locationLabel: context.authorized ? context.locationLabel ?? "Address unavailable" : "Address hidden",
        customerLabel: context.authorized ? context.customerLabel : undefined,
        accessNote: context.authorized ? context.accessNotes : undefined,
        serviceNote: context.authorized ? context.serviceNotes : undefined,
        highPriorityNotes: context.authorized ? context.highPriorityNotes ?? [] : [],
        progressPercent: progressByStatus[visit.status],
        nextActionLabel: nextActionLabel(visit),
        checklistProgressLabel: checklist.length === 0 ? "Checklist not started" : `${completedChecklist}/${checklist.length} checklist`,
        evidenceProgressLabel: `${evidenceState.completed}/2 photos`,
        sync: buildCrewSyncPresentation(sync),
        operationalException: exceptionFor(visit, sync, now),
      };
    });
}

export interface CrewJobDetailInput extends CrewTodayJobInput {
  evidence: readonly VisitEvidenceDTO[];
  checklist: readonly VisitChecklistItemDTO[];
  attentionItems?: readonly AttentionItemDTO[];
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
  if (visit.status !== "IN_PROGRESS") blocker = "Review is available after the job has started.";
  else if (!beforeEvidencePresent || !afterEvidencePresent) blocker = "Add before and after photos before sending this job for review.";

  return {
    beforeEvidencePresent,
    afterEvidencePresent,
    requiredEvidenceComplete,
    canSubmitReview,
    crewCanComplete: false,
    blocker,
  };
}

export function buildCrewJobDetailView(input: CrewJobDetailInput) {
  const gate = buildCrewEvidenceGate(input.visit, input.evidence);
  const transition = getCrewOperableTransitionAction(input.visit);
  const completedChecklist = checklistProgress(input.checklist);
  const window = formatVisitWindow(input.visit, input.workspaceTimeZone);
  const relatedIssues = (input.attentionItems ?? [])
    .filter((item) => item.status !== "RESOLVED" && item.resourceId === input.visit.id)
    .map((item) => ({ id: item.id, severity: item.severity, summary: item.summary }));

  return {
    visitId: input.visit.id,
    version: input.visit.version,
    serviceLabel: input.request.serviceCode ?? "Service visit",
    statusLabel: statusLabel(input.visit.status),
    dateLabel: window.dateLabel,
    timeWindowLabel: window.windowLabel,
    timeZoneLabel: window.timeZoneLabel,
    locationLabel: input.context.authorized ? input.context.locationLabel ?? "Address unavailable" : "Address hidden",
    customerLabel: input.context.authorized ? input.context.customerLabel : undefined,
    serviceNotes: input.context.authorized ? input.context.serviceNotes : undefined,
    accessNotes: input.context.authorized ? input.context.accessNotes : undefined,
    highPriorityNotes: input.context.authorized ? input.context.highPriorityNotes ?? [] : [],
    checklist: input.checklist,
    checklistProgressLabel: input.checklist.length === 0
      ? "Checklist not started"
      : `${completedChecklist}/${input.checklist.length} complete`,
    evidence: input.evidence,
    evidenceGate: gate,
    issues: relatedIssues,
    timeline: crewTimeline.map((step) => ({
      status: step,
      label: statusLabel(step),
      reached: hasReached(input.visit.status, step),
      current: input.visit.status === step,
    })),
    transitionAction: transition,
    nextActionLabel: nextActionLabel(input.visit),
    sync: buildCrewSyncPresentation(input.sync),
    uploadState: input.uploadTransportAvailable
      ? "Photo upload available"
      : "Photo upload isn’t available on this screen yet.",
  };
}
