import type { WorkflowConditionDTO, WorkflowEventType } from "../../contracts";

/**
 * Safe no-code starters built only from supported authoritative workflow
 * events and CREATE_ATTENTION actions. Selecting a template never publishes
 * it, creates a workflow execution, or queues a provider message.
 *
 * Distinguish this *catalogue of possible rules* from deployed LIVE rules.
 */
export interface AutomationPlaybook {
  id: string;
  code: string;
  name: string;
  category: "Intake" | "Quoting" | "Field work" | "Payments" | "Exceptions";
  eventType: WorkflowEventType;
  actionDetail: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  description: string;
  condition?: WorkflowConditionDTO;
}

export const automationPlaybooks: readonly AutomationPlaybook[] = [
  { id: "new-enquiry", code: "NEW_ENQUIRY_REVIEW", name: "New enquiry — review intake",
    category: "Intake", eventType: "REQUEST_CREATED", actionDetail: "REVIEW_NEW_ENQUIRY",
    severity: "WARNING", description: "New enquiry — review intake. Creates an internal review task; no external send or automatic approval." },
  { id: "standard-enquiry", code: "STANDARD_ENQUIRY_ROUTING", name: "Standard clean — estimate scope",
    category: "Intake", eventType: "REQUEST_CREATED", actionDetail: "ESTIMATE_STANDARD_CLEAN",
    severity: "INFO", description: "Standard clean — estimate scope. Creates an internal review task; no external send or automatic approval.",
    condition: { field: "request.serviceCode", operator: "EQ", value: "STANDARD" } },
  { id: "deep-enquiry", code: "DEEP_ENQUIRY_ROUTING", name: "Deep clean — review extra time",
    category: "Intake", eventType: "REQUEST_CREATED", actionDetail: "ASSESS_DEEP_CLEAN",
    severity: "WARNING", description: "Deep clean — review extra time. Creates an internal review task; no external send or automatic approval.",
    condition: { field: "request.serviceCode", operator: "EQ", value: "DEEP" } },
  { id: "moveout-enquiry", code: "MOVEOUT_ENQUIRY_ROUTING", name: "Move-out clean — property checklist",
    category: "Intake", eventType: "REQUEST_CREATED", actionDetail: "CHECK_MOVEOUT_PROPERTY",
    severity: "WARNING", description: "Move-out clean — property checklist. Creates an internal review task; no external send or automatic approval.",
    condition: { field: "request.serviceCode", operator: "EQ", value: "MOVE_OUT" } },
  { id: "unclassified-enquiry", code: "UNCLASSIFIED_SERVICE_REVIEW", name: "Missing service — qualify scope",
    category: "Intake", eventType: "REQUEST_CREATED", actionDetail: "QUALIFY_UNCLASSIFIED_SCOPE",
    severity: "CRITICAL", description: "Missing service — qualify scope. Creates an internal review task; no external send or automatic approval.",
    condition: { field: "request.serviceCode", operator: "EQ", value: "" } },
  { id: "website-lead", code: "WEBSITE_LEAD_INTAKE", name: "Website lead — respond promptly",
    category: "Intake", eventType: "REQUEST_CREATED", actionDetail: "TRIAGE_WEBSITE_LEAD",
    severity: "WARNING", description: "Website lead — respond promptly. Creates an internal review task; no external send or automatic approval.",
    condition: { field: "request.leadSource", operator: "EQ", value: "WEBSITE" } },
  { id: "referral-lead", code: "REFERRAL_LEAD_INTAKE", name: "Referral lead — verify referral",
    category: "Intake", eventType: "REQUEST_CREATED", actionDetail: "REVIEW_REFERRAL_LEAD",
    severity: "INFO", description: "Referral lead — verify referral. Creates an internal review task; no external send or automatic approval.",
    condition: { field: "request.leadSource", operator: "EQ", value: "REFERRAL" } },
  { id: "branch-routing", code: "BRANCH_REQUEST_REVIEW", name: "New request — verify branch routing",
    category: "Intake", eventType: "REQUEST_CREATED", actionDetail: "VERIFY_REQUEST_BRANCH",
    severity: "WARNING", description: "New request — verify branch routing. Creates an internal review task; no external send or automatic approval." },
  { id: "quote-accepted", code: "QUOTE_ACCEPTED_DISPATCH", name: "Accepted quote — arrange dispatch",
    category: "Quoting", eventType: "QUOTE_ACCEPTED", actionDetail: "CHECK_CREW_ASSIGNMENT",
    severity: "WARNING", description: "Accepted quote — arrange dispatch. Creates an internal review task; no external send or automatic approval." },
  { id: "quote-usd", code: "QUOTE_USD_DISPATCH", name: "USD quote — verify crew and pricing",
    category: "Quoting", eventType: "QUOTE_ACCEPTED", actionDetail: "VERIFY_USD_QUOTE_DISPATCH",
    severity: "INFO", description: "USD quote — verify crew and pricing. Creates an internal review task; no external send or automatic approval.",
    condition: { field: "quote.currency", operator: "EQ", value: "USD" } },
  { id: "quote-standard", code: "STANDARD_QUOTE_ACCEPTED", name: "Standard clean — plan visit",
    category: "Quoting", eventType: "QUOTE_ACCEPTED", actionDetail: "PLAN_STANDARD_CLEAN_VISIT",
    severity: "INFO", description: "Standard clean — plan visit. Creates an internal review task; no external send or automatic approval.",
    condition: { field: "request.serviceCode", operator: "EQ", value: "STANDARD" } },
  { id: "quote-deep", code: "DEEP_QUOTE_ACCEPTED", name: "Deep clean — allocate adequate time",
    category: "Quoting", eventType: "QUOTE_ACCEPTED", actionDetail: "ALLOCATE_DEEP_CLEAN_TIME",
    severity: "WARNING", description: "Deep clean — allocate adequate time. Creates an internal review task; no external send or automatic approval.",
    condition: { field: "request.serviceCode", operator: "EQ", value: "DEEP" } },
  { id: "quote-moveout", code: "MOVEOUT_QUOTE_ACCEPTED", name: "Move-out quote — confirm access",
    category: "Quoting", eventType: "QUOTE_ACCEPTED", actionDetail: "CONFIRM_MOVEOUT_PROPERTY_ACCESS",
    severity: "WARNING", description: "Move-out quote — confirm access. Creates an internal review task; no external send or automatic approval.",
    condition: { field: "request.serviceCode", operator: "EQ", value: "MOVE_OUT" } },
  { id: "quote-branch", code: "QUOTE_ACCEPTED_BRANCH_REVIEW", name: "Accepted quote — verify branch",
    category: "Quoting", eventType: "QUOTE_ACCEPTED", actionDetail: "VERIFY_ACCEPTED_QUOTE_BRANCH",
    severity: "INFO", description: "Accepted quote — verify branch. Creates an internal review task; no external send or automatic approval." },
  { id: "job-completed", code: "JOB_COMPLETED_QA", name: "Completed job — quality check",
    category: "Field work", eventType: "VISIT_COMPLETED", actionDetail: "REVIEW_COMPLETED_JOB",
    severity: "WARNING", description: "Completed job — quality check. Creates an internal review task; no external send or automatic approval." },
  { id: "incident-visit", code: "VISIT_INCIDENT_ESCALATION", name: "Visit incident — urgent escalation",
    category: "Field work", eventType: "VISIT_COMPLETED", actionDetail: "ESCALATE_COMPLETED_JOB_INCIDENT",
    severity: "CRITICAL", description: "Visit incident — urgent escalation. Creates an internal review task; no external send or automatic approval.",
    condition: { field: "visit.hasIncident", operator: "EQ", value: true } },
  { id: "clean-visit", code: "VISIT_NO_INCIDENT_REVIEW", name: "Incident-free visit — close checklist",
    category: "Field work", eventType: "VISIT_COMPLETED", actionDetail: "VERIFY_COMPLETED_CHECKLIST",
    severity: "INFO", description: "Incident-free visit — close checklist. Creates an internal review task; no external send or automatic approval.",
    condition: { field: "visit.hasIncident", operator: "EQ", value: false } },
  { id: "deep-completed", code: "DEEP_CLEAN_COMPLETED_QA", name: "Deep clean — detailed QA",
    category: "Field work", eventType: "VISIT_COMPLETED", actionDetail: "REVIEW_DEEP_CLEAN_QUALITY",
    severity: "WARNING", description: "Deep clean — detailed QA. Creates an internal review task; no external send or automatic approval.",
    condition: { field: "request.serviceCode", operator: "EQ", value: "DEEP" } },
  { id: "moveout-completed", code: "MOVEOUT_COMPLETED_QA", name: "Move-out clean — property handover",
    category: "Field work", eventType: "VISIT_COMPLETED", actionDetail: "CHECK_MOVEOUT_HANDOVER",
    severity: "WARNING", description: "Move-out clean — property handover. Creates an internal review task; no external send or automatic approval.",
    condition: { field: "request.serviceCode", operator: "EQ", value: "MOVE_OUT" } },
  { id: "paid-invoice", code: "INVOICE_PAID_RECONCILIATION", name: "Paid invoice — reconcile ledger",
    category: "Payments", eventType: "INVOICE_PAID", actionDetail: "RECONCILE_PAID_INVOICE",
    severity: "INFO", description: "Paid invoice — reconcile ledger. Creates an internal review task; no external send or automatic approval." },
  { id: "usd-paid", code: "USD_INVOICE_PAID_REVIEW", name: "USD payment — bookkeeping review",
    category: "Payments", eventType: "INVOICE_PAID", actionDetail: "CHECK_USD_PAYMENT_LEDGER",
    severity: "INFO", description: "USD payment — bookkeeping review. Creates an internal review task; no external send or automatic approval.",
    condition: { field: "invoice.currency", operator: "EQ", value: "USD" } },
  { id: "moveout-paid", code: "MOVEOUT_PAID_AFTERCARE", name: "Move-out paid — check aftercare",
    category: "Payments", eventType: "INVOICE_PAID", actionDetail: "REVIEW_MOVEOUT_AFTERCARE",
    severity: "INFO", description: "Move-out paid — check aftercare. Creates an internal review task; no external send or automatic approval.",
    condition: { field: "request.serviceCode", operator: "EQ", value: "MOVE_OUT" } },
  { id: "deep-paid", code: "DEEP_PAID_AFTERCARE", name: "Deep clean paid — aftercare review",
    category: "Payments", eventType: "INVOICE_PAID", actionDetail: "REVIEW_DEEP_CLEAN_AFTERCARE",
    severity: "INFO", description: "Deep clean paid — aftercare review. Creates an internal review task; no external send or automatic approval.",
    condition: { field: "request.serviceCode", operator: "EQ", value: "DEEP" } },
  { id: "attention-opened", code: "ATTENTION_OPENED_TRIAGE", name: "New exception — triage ownership",
    category: "Exceptions", eventType: "ATTENTION_OPENED", actionDetail: "TRIAGE_OPEN_EXCEPTION",
    severity: "WARNING", description: "New exception — triage ownership. Creates an internal review task; no external send or automatic approval." },
  { id: "critical-attention", code: "CRITICAL_ATTENTION_ESCALATION", name: "Critical exception — urgent owner review",
    category: "Exceptions", eventType: "ATTENTION_OPENED", actionDetail: "ESCALATE_CRITICAL_EXCEPTION",
    severity: "CRITICAL", description: "Critical exception — urgent owner review. Creates an internal review task; no external send or automatic approval.",
    condition: { field: "attention.severity", operator: "EQ", value: "CRITICAL" } },
  { id: "warning-attention", code: "WARNING_ATTENTION_REVIEW", name: "Warning exception — assign recovery",
    category: "Exceptions", eventType: "ATTENTION_OPENED", actionDetail: "ASSIGN_WARNING_RECOVERY",
    severity: "WARNING", description: "Warning exception — assign recovery. Creates an internal review task; no external send or automatic approval.",
    condition: { field: "attention.severity", operator: "EQ", value: "WARNING" } },
  { id: "info-attention", code: "INFO_ATTENTION_REVIEW", name: "Informational item — triage queue",
    category: "Exceptions", eventType: "ATTENTION_OPENED", actionDetail: "TRIAGE_INFORMATIONAL_ITEM",
    severity: "INFO", description: "Informational item — triage queue. Creates an internal review task; no external send or automatic approval.",
    condition: { field: "attention.severity", operator: "EQ", value: "INFO" } },
];

export const automationPlaybookCategories = [
  "Intake", "Quoting", "Field work", "Payments", "Exceptions",
] as const;

export function getAutomationPlaybook(value: string | undefined): AutomationPlaybook | undefined {
  return automationPlaybooks.find(playbook => playbook.id === value);
}
