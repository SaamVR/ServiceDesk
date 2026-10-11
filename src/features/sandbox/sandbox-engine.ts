import { calculateMoveOutQuote } from "@/domain/pricing";

/**
 * Public, client-only, deterministic sandbox. Never imports provider clients,
 * Supabase, server actions or live repositories.
 */
export const sandboxQuote = calculateMoveOutQuote({
  bedrooms: 3,
  bathrooms: 2,
  oven: true,
});

export const sandboxStages = [
  { id: "ENQUIRY", label: "New enquiry", description: "Synthetic customer requests a three-bedroom move-out clean.", action: null },
  { id: "QUOTED", label: "Quote prepared", description: "The real pricing function calculates a versioned sample quote.", action: "CREATE_QUOTE" },
  { id: "ACCEPTED", label: "Quote accepted", description: "Simulated customer approval of this quote version.", action: "ACCEPT_QUOTE" },
  { id: "HELD", label: "Capacity held", description: "Simulated 15-minute crew slot hold, not a Google Calendar reservation.", action: "HOLD_SLOT" },
  { id: "DEPOSIT_PAID", label: "Deposit recorded", description: "Simulated sandbox payment confirmation; no charge or Stripe request.", action: "PAY_DEPOSIT" },
  { id: "ASSIGNED", label: "Crew assigned", description: "Synthetic dispatcher allocates Crew Alpha.", action: "ASSIGN_CREW" },
  { id: "IN_PROGRESS", label: "Work in progress", description: "Synthetic crew starts the checklist.", action: "START_JOB" },
  { id: "COMPLETED", label: "Completion reviewed", description: "Synthetic supervisor approves job completion.", action: "COMPLETE_JOB" },
  { id: "BALANCE_PAID", label: "Balance recorded", description: "Simulated balance payment closes the invoice, without moving money.", action: "PAY_BALANCE" },
] as const;

export type SandboxStage = (typeof sandboxStages)[number]["id"];
type AdvanceAction = Exclude<(typeof sandboxStages)[number]["action"], null>;
export type SandboxAction =
  | AdvanceAction
  | "QUEUE_CONFIRMATION"
  | "FAIL_DELIVERY"
  | "RETRY_DELIVERY"
  | "ACKNOWLEDGE_DELIVERY"
  | "RESET";

export type SimulatedDelivery = "UNSENT" | "QUEUED" | "FAILED" | "SIMULATED_PROVIDER_ACCEPTED";

export interface SandboxEvent {
  id: number;
  title: string;
  detail: string;
}

export interface SandboxState {
  stage: SandboxStage;
  delivery: SimulatedDelivery;
  depositAllocatedMinor: number;
  balanceAllocatedMinor: number;
  events: SandboxEvent[];
  notice: string;
}

export function createSandboxState(): SandboxState {
  return {
    stage: "ENQUIRY",
    delivery: "UNSENT",
    depositAllocatedMinor: 0,
    balanceAllocatedMinor: 0,
    events: [{
      id: 1,
      title: "Sample enquiry received",
      detail: "Alex Morgan · move-out cleaning · 3 bedrooms, 2 bathrooms, oven",
    }],
    notice: "This session is synthetic, local to your browser, and never sends or charges anything.",
  };
}

function record(state: SandboxState, update: Partial<SandboxState>, title: string, detail: string): SandboxState {
  return {
    ...state,
    ...update,
    events: [...state.events, { id: state.events.length + 1, title, detail }],
    notice: detail,
  };
}

function blocked(state: SandboxState, reason: string): SandboxState {
  return { ...state, notice: reason };
}

export function sandboxReducer(state: SandboxState, action: SandboxAction): SandboxState {
  if (action === "RESET") return createSandboxState();

  const nextIndex = sandboxStages.findIndex(step => step.action === action);
  if (nextIndex > 0) {
    const currentIndex = sandboxStages.findIndex(step => step.id === state.stage);
    if (currentIndex !== nextIndex - 1) {
      return blocked(state, "Complete the preceding stage first. Repeated actions cannot create duplicate records.");
    }
    const next = sandboxStages[nextIndex];
    const financialUpdate: Partial<SandboxState> =
      action === "PAY_DEPOSIT" ? { depositAllocatedMinor: sandboxQuote.depositMinor } :
      action === "PAY_BALANCE" ? { balanceAllocatedMinor: sandboxQuote.balanceMinor } : {};
    return record(
      state,
      { ...financialUpdate, stage: next.id },
      next.label,
      next.description,
    );
  }

  const advancedEnough = sandboxStages.findIndex(s => s.id === state.stage) >=
    sandboxStages.findIndex(s => s.id === "DEPOSIT_PAID");
  if (!advancedEnough) {
    return blocked(state, "Communications become available only after simulated deposit confirmation.");
  }
  switch (action) {
    case "QUEUE_CONFIRMATION":
      return state.delivery === "UNSENT"
        ? record(state, { delivery: "QUEUED" }, "Confirmation queued", "Local simulation only. No WhatsApp or email was contacted.")
        : blocked(state, "A confirmation already exists. Duplicate queueing was prevented.");
    case "FAIL_DELIVERY":
      return state.delivery === "QUEUED"
        ? record(state, { delivery: "FAILED" }, "Simulated delivery failure", "A synthetic transport outage needs staff recovery.")
        : blocked(state, "Failure simulation requires a queued confirmation.");
    case "RETRY_DELIVERY":
      return state.delivery === "FAILED"
        ? record(state, { delivery: "QUEUED" }, "Delivery retried", "Local retry queued once; no external send occurred.")
        : blocked(state, "Only failed delivery can be retried.");
    case "ACKNOWLEDGE_DELIVERY":
      return state.delivery === "QUEUED"
        ? record(state, { delivery: "SIMULATED_PROVIDER_ACCEPTED" }, "Mock transport accepted", "Simulated acceptance is not customer delivery or read confirmation.")
        : blocked(state, "Mock transport must be queued before acceptance.");
    default:
      return blocked(state, "Unknown sandbox action was rejected.");
  }
}

export function sandboxAllocatedMinor(state: SandboxState): number {
  return state.depositAllocatedMinor + state.balanceAllocatedMinor;
}

export function sandboxOutstandingMinor(state: SandboxState): number {
  return sandboxQuote.totalMinor - sandboxAllocatedMinor(state);
}
