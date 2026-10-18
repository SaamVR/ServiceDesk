import type {WorkflowEventValue} from "../workflows/engine";
import type {WorkflowEventType} from "../../contracts";
import {simulateAutomationCatalog} from "./automation-template-simulation";

/** Safe preview-only bulk acceptance matrix for the 27 internal starters.
 * These are fictional events, NEVER journaled, published or executed. */
export interface FictionalAutomationScenario {
  scenarioId:string;
  eventType:WorkflowEventType;
  snapshot:Record<string,WorkflowEventValue>;
}
export interface AutomationCoverageBatch {
  actor:{workspaceId:string;role:"OWNER"|"DISPATCHER"|"CREW"|"CUSTOMER"};
  workspaceId:string;
  branchId:string;
  scenarios:readonly FictionalAutomationScenario[];
}
export type AutomationCoverageResult =
  | {ok:false;code:"AUTOMATION_COVERAGE_SCOPE_INVALID"|"AUTOMATION_COVERAGE_SOURCE_INVALID"}
  | {ok:true;value:{
      state:"SYNTHETIC_CATALOG_COVERAGE_ONLY";
      inputSource:"FICTIONAL_OWNER_SCENARIOS";
      inspectedScenarios:number;
      evaluatedPlaybookChecks:number;
      matchedScenarioCount:number;
      totalTemplateMatches:number;
      distinctMatchedTemplates:number;
      uncoveredScenarioIds:string[];
      matches:Array<{
        scenarioId:string;eventType:WorkflowEventType;
        matchedTemplates:number;
        starterIds:string[];
        truncated:false;
      }>;
      published:false;executed:false;
      providerMessagesSent:false;customerCharged:false;
      ownerApprovalRequired:true;
    }};

const id=(value:unknown):value is string=>typeof value==="string" &&
  /^[A-Za-z0-9:_-]{3,128}$/.test(value);
function exactScenario(value:unknown):value is FictionalAutomationScenario {
  if(!value||typeof value!=="object"||Array.isArray(value) ||
     Object.getPrototypeOf(value)!==Object.prototype ||
     Reflect.ownKeys(value).length!==3)return false;
  const record=value as Record<string,unknown>;
  return ["scenarioId","eventType","snapshot"].every(k=>Object.hasOwn(record,k)) &&
    Object.values(Object.getOwnPropertyDescriptors(value)).every(d=>Object.hasOwn(d,"value")) &&
    id(record.scenarioId);
}
function denseScenarios(value:unknown):value is FictionalAutomationScenario[] {
  if(!Array.isArray(value)||value.length<1||value.length>12 ||
     Reflect.ownKeys(value).length!==value.length+1)return false;
  return value.every(x=>exactScenario(x));
}

/** Executes the actual existing rule evaluator in PREVIEW mode for a whole
 * fictional scenario suite. A malformed/foreign event blocks the entire batch
 * rather than returning an incomplete 'all-clear' coverage report. */
export function previewAutomationCatalogCoverage(
  input:AutomationCoverageBatch,
):AutomationCoverageResult {
  if(!input || !input.actor || input.actor.role!=="OWNER" ||
     !id(input.workspaceId) || !id(input.branchId) ||
     input.actor.workspaceId!==input.workspaceId)
    return {ok:false,code:"AUTOMATION_COVERAGE_SCOPE_INVALID"};
  if(!denseScenarios(input.scenarios))
    return {ok:false,code:"AUTOMATION_COVERAGE_SOURCE_INVALID"};
  const seen=new Set<string>();
  const distinct=new Set<string>();
  const matches:Extract<AutomationCoverageResult,{ok:true}>["value"]["matches"]=[];
  let checked=0,total=0,positive=0;
  const uncovered:string[]=[];
  for(const scenario of input.scenarios) {
    if(seen.has(scenario.scenarioId))return {ok:false,code:"AUTOMATION_COVERAGE_SOURCE_INVALID"};
    seen.add(scenario.scenarioId);
    const simulated=simulateAutomationCatalog({
      actor:input.actor,workspaceId:input.workspaceId,branchId:input.branchId,
      eventType:scenario.eventType,snapshot:scenario.snapshot,limit:27,
    });
    if(!simulated.ok || simulated.value.truncated ||
       simulated.value.matched!==simulated.value.suggestions.length)
      return {ok:false,code:"AUTOMATION_COVERAGE_SOURCE_INVALID"};
    checked+=simulated.value.inspected;
    total+=simulated.value.matched;
    if(simulated.value.matched===0)uncovered.push(scenario.scenarioId);
    else positive++;
    const starterIds=simulated.value.suggestions.map(s=>{
      distinct.add(s.templateId);
      return s.templateId;
    });
    matches.push({scenarioId:scenario.scenarioId,eventType:scenario.eventType,
      matchedTemplates:simulated.value.matched,starterIds,truncated:false});
  }
  return {ok:true,value:{
    state:"SYNTHETIC_CATALOG_COVERAGE_ONLY",inputSource:"FICTIONAL_OWNER_SCENARIOS",
    inspectedScenarios:matches.length,evaluatedPlaybookChecks:checked,
    matchedScenarioCount:positive,totalTemplateMatches:total,
    distinctMatchedTemplates:distinct.size,uncoveredScenarioIds:uncovered,matches,
    published:false,executed:false,providerMessagesSent:false,
    customerCharged:false,ownerApprovalRequired:true,
  }};
}
