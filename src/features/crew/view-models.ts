import type { InvoiceDTO, RequestDTO, VisitDTO } from "@/contracts";

type CrewTimelineStatus = "ASSIGNED" | "EN_ROUTE" | "IN_PROGRESS" | "PENDING_REVIEW" | "COMPLETED";

type CrewFixtureSource = "FIXTURE_UI_ONLY";

interface BuildCrewExecutionViewInput {
  request: RequestDTO;
  visit: VisitDTO;
  invoice: InvoiceDTO;
}

const crewTimeline: CrewTimelineStatus[] = ["ASSIGNED", "EN_ROUTE", "IN_PROGRESS", "PENDING_REVIEW", "COMPLETED"];

const allowedCrewActionsByStatus: Record<VisitDTO["status"], string> = {
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
  const primaryAction = allowedCrewActionsByStatus[status];

  return {
    requestLabel: `${request.serviceCode ?? "SERVICE"} · ${request.bedrooms ?? "?"} bed / ${request.bathrooms ?? "?"} bath`,
    currentStatus: status,
    primaryAction,
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
      complete: status === "PENDING_REVIEW" || status === "COMPLETED" || (status === "IN_PROGRESS" && index < 2),
      source: "FIXTURE_UI_ONLY" as CrewFixtureSource,
    })),
    evidenceSlots: [
      { kind: "before_photo" as const, label: "Before photo", state: status === "ASSIGNED" || status === "EN_ROUTE" ? "Not started" : "Fixture placeholder" },
      { kind: "after_photo" as const, label: "After photo", state: status === "PENDING_REVIEW" || status === "COMPLETED" ? "Fixture placeholder" : "Required later" },
      { kind: "issue_photo" as const, label: "Issue photo", state: "Optional" },
    ],
    timeNote: {
      label: "Time and materials note",
      value: status === "PENDING_REVIEW" || status === "COMPLETED" ? "4h service, no extra materials recorded" : "Not submitted yet",
    },
    incident: {
      status: "No incident reported",
      escalationLabel: "Incident creates staff review before final invoice",
    },
    balanceLabel: `Balance remaining ${formatMinor(invoice.balanceMinor, invoice.currency)}`,
    allowedCrewActions: [primaryAction, "Add photo evidence", "Record time/material note", "Report incident"],
    businessBoundary: "Crew UI records field evidence only; payment allocation, invoice state and customer-visible completion remain facade-controlled.",
  };
}
