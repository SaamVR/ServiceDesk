import { describe, expect, it } from "vitest";
import {
  initialTheaterState, scenarioFor, theaterIsBlocked, theaterLedger,
  theaterSteps, theaterTransition,
} from "@/features/product/operations-theater-model";
import { operatorBeats, operatorPresentation } from "@/features/product/interactive-story-model";

describe("playable operator story shares the six-stage theater state", () => {
  it("has a distinct illustrated acting beat for every existing stage", () => {
    expect(operatorBeats).toHaveLength(theaterSteps.length);
    expect(new Set(operatorBeats.map(beat => beat.screen)).size).toBe(theaterSteps.length);
    expect(operatorBeats.every(beat => !!beat.pose && !!beat.action && !!beat.explanation)).toBe(true);
  });

  it("makes normal enquiry handoffs without a provider call or claimed real delivery", () => {
    let state = initialTheaterState("new-lead");
    expect(operatorPresentation(state).pose).toBe("notice");
    for (let step = 1; step < theaterSteps.length; step += 1) {
      state = theaterTransition(state, { type: "NEXT" });
      expect(operatorPresentation(state).step).toBe(step);
      expect(operatorPresentation(state).blocked).toBe(false);
    }
    expect(operatorPresentation(state).end).toBe(true);
    expect(operatorPresentation(state).nextLabel).toContain("Replay");
    expect(operatorPresentation(state).explanation).toContain("cannot fabricate");
    expect(theaterLedger(state)).toHaveLength(6);
  });

  it("locks scope exception at human review and reflects that in both surfaces", () => {
    let state = initialTheaterState("urgent-clean");
    state = theaterTransition(state, { type: "NEXT" });
    state = theaterTransition(state, { type: "NEXT" });
    const story = operatorPresentation(state);
    expect(theaterIsBlocked(state)).toBe(true);
    expect(story.pose).toBe("alert");
    expect(story.screen).toBe("REVIEW REQUIRED");
    expect(story.blocked).toBe(true);
    expect(story.nextLabel).toContain("fictional review");
    expect(story.explanation).toBe(scenarioFor("urgent-clean").recovery);
    expect(theaterLedger(state).at(-1)?.status).toBe("needs-review");
    expect(theaterTransition(state, { type: "NEXT" }).step).toBe(2);
    state = theaterTransition(state, { type: "ACKNOWLEDGE" });
    expect(operatorPresentation(state).blocked).toBe(false);
    state = theaterTransition(state, { type: "NEXT" });
    expect(operatorPresentation(state).step).toBe(3);
  });

  it("resets the illustrated character and theater ledger together on story branch change", () => {
    let state = initialTheaterState("urgent-clean");
    for(let i = 0; i < 2; i += 1) state = theaterTransition(state, { type: "NEXT" });
    state = theaterTransition(state, { type: "ACKNOWLEDGE" });
    state = theaterTransition(state, { type: "SELECT_SCENARIO", scenarioId: "new-lead" });
    expect(operatorPresentation(state).pose).toBe("notice");
    expect(state.resolved).toBe(false);
    expect(state.step).toBe(0);
    expect(theaterLedger(state)).toHaveLength(1);
  });
});
