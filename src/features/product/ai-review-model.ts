/** Static, fictional fixtures for the public portfolio. This module never runs a model. */
export type AiReviewScenarioId = "move-out" | "recurring-office" | "unsafe-cleanup";
export type AiReviewDecision = "pending" | "approved" | "rejected" | "escalated";

export interface AiReviewScenario {
  id: AiReviewScenarioId;
  label: string;
  short: string;
  customerMessage: string;
  facts: ReadonlyArray<{ label: string; value: string; source: "stated" | "missing" }>;
  draft: string;
  reviewNote: string;
  requiresEscalation: boolean;
}

export const aiReviewScenarios: readonly AiReviewScenario[] = [
  {
    id: "move-out", label: "Move-out enquiry", short: "Extract scope and request missing details",
    customerMessage: "Hi, could you help with a move-out clean for my three-bedroom apartment? The oven needs attention too. We haven't set a date yet.",
    facts: [
      { label: "Service", value: "Move-out cleaning", source: "stated" },
      { label: "Home", value: "Three bedrooms", source: "stated" },
      { label: "Add-on", value: "Oven", source: "stated" },
      { label: "Missing", value: "Address and date", source: "missing" },
    ],
    draft: "Thanks for your enquiry. We can prepare a move-out cleaning quote including the oven. Could you share the property address and your preferred date? A team member will review the details and confirm availability.",
    reviewNote: "Availability and pricing require human review. No date is reserved by this suggestion.",
    requiresEscalation: false,
  },
  {
    id: "recurring-office", label: "Recurring office", short: "Clarify frequency and space before a proposal",
    customerMessage: "We manage an office with two floors and would like cleaning three evenings per week. We haven't measured the floor area yet.",
    facts: [
      { label: "Service", value: "Office cleaning", source: "stated" },
      { label: "Property", value: "Two floors", source: "stated" },
      { label: "Frequency", value: "3 evenings / week", source: "stated" },
      { label: "Missing", value: "Area and address", source: "missing" },
    ],
    draft: "Thanks for outlining your office cleaning needs. To prepare an accurate service proposal for three evenings a week, could you confirm the approximate floor area, address and preferred time window? Our team will review staffing and scheduling.",
    reviewNote: "Do not imply a recurring contract, staffing commitment or calculated price.",
    requiresEscalation: false,
  },
  {
    id: "unsafe-cleanup", label: "Potential safety incident", short: "Stop routine automation at a risk boundary",
    customerMessage: "A chemical container leaked in our supply room. Can you send a cleaner immediately to mop it up? We don't know what the chemical was.",
    facts: [
      { label: "Request", value: "Unknown chemical spill", source: "stated" },
      { label: "Location", value: "Supply room", source: "stated" },
      { label: "Risk", value: "Material unknown", source: "missing" },
      { label: "Action", value: "Safety escalation", source: "missing" },
    ],
    draft: "Thanks for contacting us. Because the spilled material is unidentified, we cannot arrange routine cleaning or advise handling it. Please keep people away from the area and follow your organization's emergency and safety procedures. A qualified safety professional should assess the situation.",
    reviewNote: "Human safety escalation required. No routine cleaning quote, dispatch or automated approval.",
    requiresEscalation: true,
  },
] as const;

export function aiScenarioFor(id: AiReviewScenarioId): AiReviewScenario {
  return aiReviewScenarios.find(item => item.id === id) ?? aiReviewScenarios[0];
}

export function aiCanApprove(scenario: AiReviewScenario, reply: string): boolean {
  return !scenario.requiresEscalation && reply.trim().length > 0 && reply.length <= 520;
}

export function aiDecisionLabel(decision: AiReviewDecision): string {
  switch (decision) {
    case "approved": return "Locally approved as an editable draft. No message was sent.";
    case "rejected": return "The proposed draft was rejected. No external action occurred.";
    case "escalated": return "Marked for fictional human safety escalation. No job was dispatched.";
    case "pending": return "Awaiting human review. Nothing has been sent.";
  }
}
