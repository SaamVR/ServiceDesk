/**
 * Human-selected starter rules. These are FORM DEFAULTS ONLY; never published,
 * previewed or executed from a link click. All authoritative commands still
 * pass through the owner-scoped Postgres rule/version/review boundaries.
 */
export const automationPlaybooks = [
  {
    id: "new-enquiry",
    code: "NEW_ENQUIRY_REVIEW",
    name: "New enquiry — review intake",
    description: "When an enquiry arrives, create an internal attention item so an operator can review scope before quoting.",
    eventType: "REQUEST_CREATED",
    actionDetail: "REVIEW_NEW_ENQUIRY",
  },
  {
    id: "quote-accepted",
    code: "QUOTE_ACCEPTED_DISPATCH",
    name: "Quote accepted — arrange dispatch",
    description: "After quote acceptance, flag the request for crew allocation; do not promise calendar availability.",
    eventType: "QUOTE_ACCEPTED",
    actionDetail: "CHECK_CREW_ASSIGNMENT",
  },
  {
    id: "job-completed",
    code: "JOB_COMPLETED_QA",
    name: "Job completed — quality check",
    description: "When a visit finishes, flag quality review before human-owned aftercare.",
    eventType: "VISIT_COMPLETED",
    actionDetail: "REVIEW_COMPLETED_JOB",
  },
] as const;

export function getAutomationPlaybook(value: string | undefined) {
  return automationPlaybooks.find(playbook => playbook.id === value);
}
