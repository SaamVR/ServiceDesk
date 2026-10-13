/** Deterministic next steps derived from the currently authorized saved request.
 * This does not persist AI guesses, mutate quotes, or imply provider delivery. */
export interface CleaningRequestNextStepsInput {
  serviceActive: boolean;
  bedrooms?: number;
  bathrooms?: number;
  pricingState: "VERIFIED" | "UNVERIFIED" | "MISSING";
  currentQuote?: { status: string; totalMinor: number; currency: string };
  requestedStartAt?: string;
}
export interface CleaningRequestStep {
  id: "service" | "rooms" | "pricing" | "quote";
  label: string;
  state: "DONE" | "ACTION_REQUIRED" | "UNVERIFIED";
  detail: string;
}
export function cleaningRequestNextSteps(input: CleaningRequestNextStepsInput): {
  complete: number;
  steps: CleaningRequestStep[];
  quoteReady: boolean;
} {
  const roomsValid = Number.isSafeInteger(input.bedrooms) &&
    Number.isSafeInteger(input.bathrooms) &&
    (input.bedrooms ?? -1) >= 0 && (input.bedrooms ?? 11) <= 10 &&
    (input.bathrooms ?? -1) >= 0 && (input.bathrooms ?? 11) <= 10;
  const confirmedQuote = Boolean(input.currentQuote &&
    ["DRAFT", "APPROVED", "SENT", "ACCEPTED", "EXPIRED", "REJECTED"].includes(input.currentQuote.status) &&
    input.currentQuote.currency === "USD" &&
    Number.isSafeInteger(input.currentQuote.totalMinor) &&
    input.currentQuote.totalMinor >= 0);
  const steps: CleaningRequestStep[] = [
    {id:"service",label:"Choose an active cleaning service",
      state:input.serviceActive?"DONE":"ACTION_REQUIRED",
      detail:input.serviceActive?"Saved active service verified.":"Owner must activate a real service before pricing."},
    {id:"rooms",label:"Confirm bedrooms and bathrooms",
      state:roomsValid?"DONE":"ACTION_REQUIRED",
      detail:roomsValid?"Room counts saved as staff-confirmed facts.":"Enter both room counts in the request form; do not rely on AI estimates."},
    {id:"pricing",label:"Verify the branch price book",
      state:input.pricingState==="VERIFIED"?"DONE":input.pricingState==="UNVERIFIED"?"UNVERIFIED":"ACTION_REQUIRED",
      detail:input.pricingState==="VERIFIED"?"Authorized branch rates verified.":input.pricingState==="UNVERIFIED"?"Price-book evidence unavailable; do not assume any rate.":"Owner must save approved rates for this request's branch."},
    {id:"quote",label:"Save a calculated quote",
      state:confirmedQuote?"DONE":"ACTION_REQUIRED",
      detail:confirmedQuote?"A saved USD quote exists. This does not mean it was delivered or paid.":"Staff must calculate and verify a persisted quote; preview totals are not enough."},
  ];
  return {
    complete:steps.filter(step=>step.state==="DONE").length,
    steps,
    quoteReady:input.serviceActive && roomsValid && input.pricingState==="VERIFIED",
  };
}
