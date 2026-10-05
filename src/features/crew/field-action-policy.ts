import type { VisitDTO } from "@/contracts";

const checklistEditableStatuses: ReadonlySet<VisitDTO["status"]> = new Set([
  "ASSIGNED",
  "EN_ROUTE",
  "IN_PROGRESS",
]);

const issueReportableStatuses: ReadonlySet<VisitDTO["status"]> = new Set([
  "ASSIGNED",
  "EN_ROUTE",
  "IN_PROGRESS",
  "PENDING_REVIEW",
]);

export function canCrewEditChecklist(status: VisitDTO["status"]): boolean {
  return checklistEditableStatuses.has(status);
}

export function canCrewReportIssue(status: VisitDTO["status"]): boolean {
  return issueReportableStatuses.has(status);
}

export const requiredCrewFieldMutationHardening = {
  checklist: {
    productAllowedStatuses: [...checklistEditableStatuses],
    coreRequirement: "servicedesk_set_visit_checklist_item must reject stale expectedVersion atomically before upsert",
  },
  incident: {
    productAllowedStatuses: [...issueReportableStatuses],
    coreRequirement: "servicedesk_add_visit_evidence should reject stale expectedVersion atomically before insert",
  },
} as const;
