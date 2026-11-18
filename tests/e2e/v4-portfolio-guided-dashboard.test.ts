import { describe, it, expect } from "vitest";
import {
  dashboardModules, dashboardGuide, dashboardNextAction, dashboardStageView,
  dashboardScreenFor, dashboardProgress, dashboardStatus,
} from "@/features/product/demo-dashboard-model";
import {createSandboxState,sandboxReducer,sandboxStages,sandboxQuote} from "@/features/sandbox/sandbox-engine";

describe("guided portfolio dashboard controls",()=>{
 it("covers each main operational screen with genuine, accessible guidance",()=>{
   expect(dashboardModules.map(x=>x.id)).toEqual(["overview","inbox","requests","schedule","crew","finance","ai","automations","activity"]);
   expect(dashboardGuide.length).toBeGreaterThanOrEqual(5);
   expect(new Set(dashboardGuide.map(x=>x.module)).size).toBeGreaterThan(4);
   expect(dashboardGuide.every(x=>x.title&&x.explanation&&dashboardModules.some(m=>m.id===x.module))).toBe(true);
 });
 it("maps each real sandbox milestone to an operator screen",()=>{
   for(const stage of sandboxStages){
     const view=dashboardStageView(stage.id);
     expect(dashboardModules.some(x=>x.id===view)).toBe(true);
   }
 });
 it("never jumps around the genuine sandbox action ordering",()=>{
   let state=createSandboxState();
   expect(dashboardNextAction(state)?.action).toBe("CREATE_QUOTE");
   state=sandboxReducer(state,"CREATE_QUOTE");
   expect(dashboardNextAction(state)?.action).toBe("ACCEPT_QUOTE");
   state=sandboxReducer(state,"ACCEPT_QUOTE");
   expect(dashboardNextAction(state)?.action).toBe("HOLD_SLOT");
   state=sandboxReducer(state,"HOLD_SLOT");
   expect(dashboardNextAction(state)?.action).toBe("PAY_DEPOSIT");
   expect(dashboardStatus(state).claim).toBe("SAMPLE ONLY");
   expect(sandboxQuote.totalMinor).toBeGreaterThan(0);
 });
 it("never invents completed actions or future events",()=>{
   const state=createSandboxState();
   expect(dashboardProgress(state).completed).toBe(0);
   expect(dashboardProgress(state).total).toBe(sandboxStages.length-1);
   expect(dashboardScreenFor("overview")).toBeDefined();
   expect(dashboardScreenFor("unknown" as "overview").id).toBe("overview");
   const atEnd=sandboxStages.slice(1).reduce((s,stage)=>sandboxReducer(s,stage.action!),state);
   expect(dashboardNextAction(atEnd)).toBeNull();
   expect(dashboardProgress(atEnd).completed).toBe(sandboxStages.length-1);
 });
});
