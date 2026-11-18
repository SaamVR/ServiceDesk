/**
 * Fictional portfolio event simulation — intentionally not Core workflow execution.
 * All outputs are local presentation state, not records, receipts or provider actions.
 */
export const theaterSteps = [
  {
    id: "lead", icon: "message-square", label: "Capture", title: "A request arrives",
    operator: "Intake receives a structured review item.",
    customer: "Your fictional enquiry has been captured for review.",
    action: "Record a fictional request, source and missing fields",
    detail: "A visible handoff replaces a lost message.",
  },
  {
    id: "brief", icon: "brain-circuit", label: "AI brief", title: "Context is summarized",
    operator: "A suggested brief is prepared for a dispatcher to verify.",
    customer: "The team prepares a draft of the service needs.",
    action: "Prepare an editable summary; never infer missing address or consent",
    detail: "AI is a draft assistant, not an authorized operator.",
  },
  {
    id: "quote", icon: "file-text", label: "Review", title: "Scope and pricing are checked",
    operator: "An owner checks price rules, scope and quote version.",
    customer: "The cost and scope require a deliberate approval.",
    action: "Human-reviewed quote version; AI cannot set price",
    detail: "An exception must be resolved before proceeding.",
  },
  {
    id: "schedule", icon: "calendar-check", label: "Schedule", title: "A safe visit is planned",
    operator: "Dispatch checks capacity, availability and crew assignment.",
    customer: "A visit time is not promised until availability is verified.",
    action: "Confirm fresh capacity rather than assume a stale slot",
    detail: "Never silently convert a slot hold into a confirmed booking.",
  },
  {
    id: "field", icon: "clipboard-check", label: "Field work", title: "Crew and quality are linked",
    operator: "A sample crew task and quality checklist become reviewable.",
    customer: "The service scope is visible to the team performing the work.",
    action: "Show checklist, notes and a human quality review",
    detail: "Field proof remains a fictional event in this view.",
  },
  {
    id: "followup", icon: "mail", label: "Aftercare", title: "The next action is owned",
    operator: "The outbox, invoice and follow-up need verified evidence and authority.",
    customer: "A sample follow-up is prepared, not actually delivered.",
    action: "Propose a draft response without sending a real message",
    detail: "Delivery is never marked successful without a provider receipt.",
  },
] as const;

export type TheaterScenarioId = "new-lead" | "urgent-clean" | "stale-calendar" | "failed-message";
export type TheaterChannel = "website" | "whatsapp" | "email" | "voice";
export type TheaterView = "operator" | "customer";

export type TheaterScenario = {
  id: TheaterScenarioId;
  title: string;
  eyebrow: string;
  short: string;
  icon: string;
  channel: TheaterChannel;
  customerBrief: string;
  exceptionAt: number | null;
  exceptionTitle: string;
  exceptionReason: string;
  recovery: string;
  exampleOnly: true;
};

export const theaterScenarios: readonly TheaterScenario[] = [
  {
    id: "new-lead", title: "From enquiry to aftercare", eyebrow: "01 / HAPPY PATH",
    short: "A standard move-out enquiry travels across the whole business.",
    icon: "house", channel: "website",
    customerBrief: "Hi, I need a move-out clean for a three-bedroom property next week.",
    exceptionAt: null, exceptionTitle: "No injected exception",
    exceptionReason: "This is a synthetic happy-path demonstration. Provider execution is not implied.",
    recovery: "All stages remain sample records until real authority and provider proof exist.",
    exampleOnly: true,
  },
  {
    id: "urgent-clean", title: "Unusual quote needs approval", eyebrow: "02 / HUMAN DECISION",
    short: "An urgent job is held for scope and pricing review.",
    icon: "file-text", channel: "email",
    customerBrief: "Could you quote a same-day deep clean with special stain treatment?",
    exceptionAt: 2, exceptionTitle: "Scope exception: approval required",
    exceptionReason: "The proposed rush work falls outside the usual reviewed quote assumptions.",
    recovery: "An authorized owner reviews the specific scope, pricing version and consent before moving forward.",
    exampleOnly: true,
  },
  {
    id: "stale-calendar", title: "Calendar conflict detected", eyebrow: "03 / SAFE STOP",
    short: "The scheduler refuses to promise an expired slot.",
    icon: "calendar-check", channel: "whatsapp",
    customerBrief: "Hello, can someone clean my apartment on Friday at 9 AM?",
    exceptionAt: 3, exceptionTitle: "Availability must be refreshed",
    exceptionReason: "The sample slot became stale while the request was being reviewed.",
    recovery: "Dispatch checks fresh external availability and acknowledges the updated plan.",
    exampleOnly: true,
  },
  {
    id: "failed-message", title: "Follow-up delivery uncertain", eyebrow: "04 / RECOVERY",
    short: "The system does not invent a delivered receipt.",
    icon: "mail", channel: "voice",
    customerBrief: "Please follow up after the clean with my invoice and next steps.",
    exceptionAt: 5, exceptionTitle: "Outbound message not verified",
    exceptionReason: "A fictional provider send fails or has no accepted delivery receipt.",
    recovery: "An operator reconciles provider state before deciding whether to retry.",
    exampleOnly: true,
  },
];

export function scenarioFor(id: TheaterScenarioId): TheaterScenario {
  return theaterScenarios.find(scenario => scenario.id === id) ?? theaterScenarios[0];
}

export type TheaterState = {
  scenarioId: TheaterScenarioId;
  step: number;
  playing: boolean;
  resolved: boolean;
  view: TheaterView;
  channel: TheaterChannel;
  message: string;
};
export type TheaterAction =
  | { type: "SELECT_SCENARIO"; scenarioId: TheaterScenarioId }
  | { type: "NEXT" }
  | { type: "PREVIOUS" }
  | { type: "REVISIT"; index: number }
  | { type: "TICK" }
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "RESET" }
  | { type: "ACKNOWLEDGE" }
  | { type: "SET_CHANNEL"; channel: TheaterChannel }
  | { type: "SET_VIEW"; view: TheaterView }
  | { type: "SET_MESSAGE"; message: string };

export function initialTheaterState(scenarioId: TheaterScenarioId = "new-lead"): TheaterState {
  const scenario = scenarioFor(scenarioId);
  return {
    scenarioId: scenario.id, step: 0, playing: false, resolved: false,
    view: "operator", channel: scenario.channel, message: scenario.customerBrief,
  };
}

export function theaterIsBlocked(state: TheaterState): boolean {
  const exceptionAt = scenarioFor(state.scenarioId).exceptionAt;
  return exceptionAt !== null && state.step >= exceptionAt && !state.resolved;
}

function moveForward(state: TheaterState, automatic: boolean): TheaterState {
  if (theaterIsBlocked(state)) return { ...state, playing: false };
  const next = Math.min(state.step + 1, theaterSteps.length - 1);
  const after = { ...state, step: next, playing: automatic && next < theaterSteps.length - 1 };
  return theaterIsBlocked(after) ? { ...after, playing: false } : after;
}

export function theaterTransition(state: TheaterState, action: TheaterAction): TheaterState {
  switch (action.type) {
    case "SELECT_SCENARIO": return initialTheaterState(action.scenarioId);
    case "NEXT": return moveForward(state, false);
    case "TICK": return !state.playing ? state : moveForward(state, true);
    case "PREVIOUS": return { ...state, step: Math.max(state.step - 1, 0), playing: false };
    case "REVISIT":
      return Number.isInteger(action.index) && action.index >= 0 && action.index < state.step
        ? { ...state, step: action.index, playing: false }
        : state;
    case "PLAY":
      return (theaterIsBlocked(state) || state.step >= theaterSteps.length - 1)
        ? { ...state, playing: false }
        : { ...state, playing: true };
    case "PAUSE": return { ...state, playing: false };
    case "RESET": return { ...initialTheaterState(state.scenarioId), channel: state.channel, view: state.view, message: state.message };
    case "ACKNOWLEDGE": return theaterIsBlocked(state) ? { ...state, resolved: true, playing: false } : state;
    case "SET_CHANNEL": return { ...state, channel: action.channel, playing: false };
    case "SET_VIEW": return { ...state, view: action.view };
    case "SET_MESSAGE": return { ...state, message: action.message.slice(0, 180), playing: false };
  }
}

export type TheaterLedgerItem = { id: string; label: string; status: "sample" | "needs-review"; detail: string };
export function theaterLedger(state: TheaterState): TheaterLedgerItem[] {
  return theaterSteps.slice(0, state.step + 1).map((item, index) => ({
    id: item.id, label: item.label,
    status: index === state.step && theaterIsBlocked(state) ? "needs-review" : "sample",
    detail: item.action,
  }));
}
