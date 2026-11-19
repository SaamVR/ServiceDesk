import {
  scenarioFor, theaterIsBlocked, theaterSteps,
  type TheaterState,
} from "./operations-theater-model";

/**
 * The illustrated operator is a view of the existing portfolio reducer.
 * It never executes provider operations, schedules crews, or approves real quotes.
 */
export const operatorBeats = [
  {
    title: "An enquiry lands on the desk",
    sub: "A fictional customer asks for a move-out clean.",
    action: "Review the enquiry",
    explanation: "Intake captures a source, a request and missing fields for an operator.",
    pose: "notice",
    screen: "NEW ENQUIRY",
  },
  {
    title: "AI suggests. The operator verifies.",
    sub: "A draft summary appears beside the original message.",
    action: "Inspect the AI brief",
    explanation: "The brief is illustrative and editable. AI never invents consent, prices or missing details.",
    pose: "read",
    screen: "DRAFT BRIEF",
  },
  {
    title: "A person owns the decision",
    sub: "Scope and pricing need a deliberate human review.",
    action: "Review the quote stage",
    explanation: "The simulated operator checks scope, quote version and authority before any next handoff.",
    pose: "decide",
    screen: "HUMAN REVIEW",
  },
  {
    title: "A schedule needs fresh availability",
    sub: "An appointment is not promised from a stale calendar.",
    action: "Inspect scheduling",
    explanation: "Dispatch checks capacity; this visualisation makes no real booking.",
    pose: "type",
    screen: "SCHEDULE CHECK",
  },
  {
    title: "The crew gets a clear handoff",
    sub: "A checklist, task notes and quality review become visible.",
    action: "Inspect field work",
    explanation: "No crew is dispatched, and no field proof is submitted.",
    pose: "gesture",
    screen: "QUALITY CHECK",
  },
  {
    title: "Aftercare stays accountable",
    sub: "The operator prepares a follow-up without claiming delivery.",
    action: "Review aftercare",
    explanation: "The sample ledger cannot fabricate a payment, sent message or provider receipt.",
    pose: "relief",
    screen: "AFTERCARE DRAFT",
  },
] as const;

export type OperatorPose = (typeof operatorBeats)[number]["pose"] | "alert";

export function operatorPresentation(state: TheaterState) {
  const blocked = theaterIsBlocked(state);
  const end = state.step === theaterSteps.length - 1 && !blocked;
  const beat = operatorBeats[Math.max(0, Math.min(state.step, operatorBeats.length - 1))];
  const scenario = scenarioFor(state.scenarioId);
  return {
    ...beat,
    pose: blocked ? "alert" as const : beat.pose,
    title: blocked ? "A human checkpoint stops the workflow" : beat.title,
    sub: blocked ? scenario.exceptionTitle : beat.sub,
    explanation: blocked ? scenario.recovery : beat.explanation,
    screen: blocked ? "REVIEW REQUIRED" : beat.screen,
    blocked,
    end,
    step: state.step,
    total: theaterSteps.length,
    nextLabel: blocked
      ? "Acknowledge fictional review"
      : end ? "Replay this story" : "Continue to " + theaterSteps[state.step + 1].label,
  };
}
