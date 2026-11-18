import { describe, it, expect } from "vitest";
import {
  initialTheaterState, theaterTransition, theaterIsBlocked, theaterLedger,
  theaterScenarios, theaterSteps, scenarioFor,
} from "@/features/product/operations-theater-model";

describe("connected portfolio theater", () => {
  it("contains four bounded scenarios and six accessible event stages", () => {
    expect(theaterScenarios).toHaveLength(4);
    expect(theaterSteps).toHaveLength(6);
    expect(new Set(theaterScenarios.map(s => s.id)).size).toBe(4);
    expect(theaterScenarios.every(s => s.exampleOnly && s.channel && s.id && s.customerBrief)).toBe(true);
  });
  it("starts with the first event and progresses to a terminal stop, not a loop", () => {
    let state=initialTheaterState("new-lead");
    expect(state.step).toBe(0);
    for (let i=0;i<20;i++) state=theaterTransition(state,{type:"NEXT"});
    expect(state.step).toBe(theaterSteps.length-1);
    expect(state.playing).toBe(false);
    expect(theaterIsBlocked(state)).toBe(false);
    expect(theaterLedger(state).length).toBe(theaterSteps.length);
  });
  it.each([
    ["urgent-clean",2],["stale-calendar",3],["failed-message",5],
  ] as const)("stops the %s scenario at the human gate in stage %i", (scenarioId,blockAt) => {
    let state=initialTheaterState(scenarioId);
    for(let i=0;i<blockAt;i++) state=theaterTransition(state,{type:"NEXT"});
    expect(state.step).toBe(blockAt);
    expect(theaterIsBlocked(state)).toBe(true);
    const blocked=theaterTransition({...state,playing:true},{type:"TICK"});
    expect(blocked.step).toBe(blockAt);
    expect(blocked.playing).toBe(false);
    expect(blocked.resolved).toBe(false);
    const reviewed=theaterTransition(blocked,{type:"ACKNOWLEDGE"});
    expect(reviewed.resolved).toBe(true);
    expect(theaterIsBlocked(reviewed)).toBe(false);
    const resumed=theaterTransition(reviewed,{type:"NEXT"});
    expect(resumed.step).toBe(Math.min(blockAt+1,theaterSteps.length-1));
  });
  it("resets human approvals and old history when the scenario changes",()=>{
    let state=initialTheaterState("stale-calendar");
    for(let i=0;i<3;i++)state=theaterTransition(state,{type:"NEXT"});
    state=theaterTransition(state,{type:"ACKNOWLEDGE"});
    state=theaterTransition(state,{type:"SELECT_SCENARIO",scenarioId:"failed-message"});
    expect(state.step).toBe(0);
    expect(state.resolved).toBe(false);
    expect(state.playing).toBe(false);
    expect(state.scenarioId).toBe("failed-message");
    expect(theaterLedger(state)).toHaveLength(1);
  });
  it("does not let channel or viewer perspective affect business progress",()=>{
    let state=initialTheaterState("new-lead");
    state=theaterTransition(state,{type:"SET_CHANNEL",channel:"email"});
    state=theaterTransition(state,{type:"SET_VIEW",view:"customer"});
    state=theaterTransition(state,{type:"SET_MESSAGE",message:"A fictional enquiry"});
    expect(state.step).toBe(0);
    expect(state.channel).toBe("email");
    expect(state.view).toBe("customer");
    expect(state.message).toBe("A fictional enquiry");
    expect(theaterTransition(state,{type:"SET_MESSAGE",message:"x".repeat(400)}).message.length).toBe(180);
    expect(scenarioFor(state.scenarioId).exampleOnly).toBe(true);
  });
  it("resets state and replays locally without creating receipts",()=>{
    let state=initialTheaterState("new-lead");
    state=theaterTransition(state,{type:"PLAY"});
    expect(state.playing).toBe(true);
    state=theaterTransition(state,{type:"PAUSE"});
    expect(state.playing).toBe(false);
    state=theaterTransition(state,{type:"NEXT"});
    state=theaterTransition(state,{type:"RESET"});
    expect(state.step).toBe(0);
    expect(state.playing).toBe(false);
    expect(theaterLedger(state)[0].status).toBe("sample");
  });
});
