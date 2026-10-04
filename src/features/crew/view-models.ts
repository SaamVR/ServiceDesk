import type { InvoiceDTO, RequestDTO, VisitDTO } from "@/contracts";
import { buildCrewFieldEvidenceBoundary } from "./field-evidence-boundary";
import { buildCrewTransitionPresentation } from "./server-boundary";

type CrewTimelineStatus = "ASSIGNED" | "EN_ROUTE" | "IN_PROGRESS" | "PENDING_REVIEW" | "COMPLETED";
type CrewFixtureSource = "FIXTURE_UI_ONLY";

interface BuildCrewExecutionViewInput {
  request: RequestDTO;
  visit: VisitDTO;
  invoice: InvoiceDTO;
}

const crewTimeline: CrewTimelineStatus[] = ["ASSIGNED", "EN_ROUTE", "IN_PROGRESS", "PENDING_REVIEW", "COMPLETED"];

const crewStatusLabels: Record<VisitDTO["status"], string> = {
  AWAITING_PAYMENT: "Wait for dispatch",
  CONFIRMED: "Wait for assignment",
  ASSIGNED: "Start travel",
  EN_ROUTE: "Start job",
  IN_PROGRESS: "Submit completion review",
  PENDING_REVIEW: "Await dispatcher review",
  COMPLETED: "Job completed",
  CANCELLED: "Job cancelled",
  PAYMENT_REVIEW: "Wait for payment review",
};

const checklistFixtures = [
  "Confirm rooms and access notes",
  "Record pre-clean condition",
  "Complete move-out cleaning checklist",
  "Add after-clean photo evidence",
  "Submit time/material note",
] as const;

function formatMinor(amount: number, currency: InvoiceDTO["currency"]) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount / 100);
}

function hasReached(current: VisitDTO["status"], step: CrewTimelineStatus) {
  const currentIndex = crewTimeline.indexOf(current as CrewTimelineStatus);
  const stepIndex = crewTimeline.indexOf(step);
  return currentIndex >= 0 && stepIndex <= currentIndex;
}

export function buildCrewExecutionView({ request, visit, invoice }: BuildCrewExecutionViewInput) {
  const status = visit.status;
  const transition = buildCrewTransitionPresentation(visit, false);
  const fieldEvidence = buildCrewFieldEvidenceBoundary("FIXTURE_UI_ONLY");

  return {
    requestLabel: `${request.serviceCode ?? "SERVICE"} · ${request.bedrooms ?? "?"} bed / ${request.bathrooms ?? "?"} bath`,
    currentStatus: status,
    primaryAction: transition.action ? transition.label : crewStatusLabels[status],
    transition,
    reviewRequired: status === "IN_PROGRESS" || status === "PENDING_REVIEW",
    timeline: crewTimeline.map((step) => ({
      status: step,
      label: step.replaceAll("_", " ").toLowerCase(),
      reached: hasReached(status, step),
      current: status === step,
    })),
    checklist: checklistFixtures.map((label, index) => ({
      id: `crew_check_${index + 1}`,
      label,
      state: "NOT_PERSISTED" as const,
      source: "FIXTURE_UI_ONLY" as CrewFixtureSource,
    })),
    fieldEvidence,
    evidenceSlots: fieldEvidence.photoSlots.map((slot) => ({
      kind: slot.kind,
      label: slot.label,
      state: slot.state === "OPTIONAL" ? "Optional / NOT_PERSISTED" : "Required / NOT_PERSISTED",
      persistence: slot.persistence,
    })),
    timeNote: {
      label: "Time and materials note",
      value: "NOT_PERSISTED — future E06 evidence command required",
      persistence: "FUTURE_E06_CORE_EVIDENCE" as const,
    },
    incident: {
      status: "NOT_PERSISTED — incident note is presentation-only",
      escalationLabel: "Incident persistence waits for a future Core E06 evidence command",
      persistence: "FUTURE_E06_CORE_EVIDENCE" as const,
    },
    balanceLabel: `Balance remaining ${formatMinor(invoice.balanceMinor, invoice.currency)}`,
    allowedCrewActions: transition.action ? [transition.label] : [],
    businessBoundary: "Crew transition uses transitionVisit only; field evidence remains FIXTURE_UI_ONLY / NOT_PERSISTED until a Core evidence command exists.",
  };
}
