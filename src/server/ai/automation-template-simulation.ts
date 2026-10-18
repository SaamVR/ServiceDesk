import type { WorkflowEventEnvelope, WorkflowEventValue } from "../workflows/engine";
import { evaluateWorkflowRule, validateWorkflowEventEnvelope } from "../workflows/engine";
import { automationPlaybooks } from "../../features/operations/automation-playbooks";
import type { WorkflowRuleVersionDTO } from "../../contracts";

/** A human-selected, fictional event for testing which existing template
 * *could* apply. Never accepts sourceEventId, invoices, customer contacts or
 * tenant data from a model; publishing/side effects are outside this API. */
export interface AutomationTemplateSimulation {
  actor: { workspaceId:string; role:"OWNER"|"DISPATCHER"|"CREW"|"CUSTOMER" };
  workspaceId:string;
  branchId:string;
  eventType:WorkflowRuleVersionDTO["eventType"];
  snapshot:Record<string,WorkflowEventValue>;
  limit?:number;
}
export type AutomationTemplateSimulationResult =
  | {ok:false;code:"AUTOMATION_TEMPLATE_SCOPE_INVALID"|"AUTOMATION_TEMPLATE_INPUT_INVALID"}
  | {ok:true;value:{
      state:"SYNTHETIC_AUTOMATION_RECOMMENDATIONS_ONLY";
      eventType:WorkflowRuleVersionDTO["eventType"];
      inspected:number; matched:number; truncated:boolean;
      suggestions:Array<{templateId:string;code:string;name:string;
        severity:"INFO"|"WARNING"|"CRITICAL";conditionMatched:true;
        needsOwnerApproval:true;wouldCreateInternalAttention:true}>;
      published:false;executed:false;sentCustomerMessage:false;
      chargedCustomer:false;
    }};

const validId=(s:unknown):s is string=>
  typeof s==="string" && /^[A-Za-z0-9:_-]{3,128}$/.test(s);

/**
 * Reuse the real workflow evaluator for all 27 shipped, versioned starter
 * recipes, but enforce PREVIEW and construct local-only identity. The caller
 * must separately verify the fictional actor and workspace when authoring.
 */
export function simulateAutomationCatalog(
  input:AutomationTemplateSimulation,
):AutomationTemplateSimulationResult {
  if (!input || !input.actor || input.actor.role!=="OWNER" ||
      !validId(input.workspaceId) || !validId(input.branchId) ||
      input.actor.workspaceId!==input.workspaceId)
    return {ok:false,code:"AUTOMATION_TEMPLATE_SCOPE_INVALID"};
  const limit=input.limit??6;
  if(!Number.isSafeInteger(limit) || limit<1 || limit>27 ||
     !input.snapshot || typeof input.snapshot!=="object" ||
     Array.isArray(input.snapshot) ||
     ![Object.prototype,null].includes(Object.getPrototypeOf(input.snapshot)) ||
     Reflect.ownKeys(input.snapshot).length!==Object.keys(input.snapshot).length ||
     Object.values(Object.getOwnPropertyDescriptors(input.snapshot)).some(d=>!Object.hasOwn(d,"value")))
    return {ok:false,code:"AUTOMATION_TEMPLATE_INPUT_INVALID"};
  const event:WorkflowEventEnvelope={
    workspaceId:input.workspaceId,branchId:input.branchId,
    eventType:input.eventType,snapshot:input.snapshot,recursionDepth:0,
  };
  if(!validateWorkflowEventEnvelope(event).ok)
    return {ok:false,code:"AUTOMATION_TEMPLATE_INPUT_INVALID"};
  const relevant=automationPlaybooks.filter(p=>p.eventType===input.eventType);
  const suggestions:Extract<AutomationTemplateSimulationResult,{ok:true}>["value"]["suggestions"]=[];
  let matched=0;
  for (const template of relevant){
    // All catalogue actions remain CREATE_ATTENTION. A future external-send
    // starter must be excluded until a separately audited authoring release.
    if(!/^[A-Z0-9_]{3,80}$/.test(template.actionDetail))continue;
    const version:WorkflowRuleVersionDTO={
      id:"synthetic-template-v1",ruleId:"synthetic-template",
      workspaceId:input.workspaceId,branchId:input.branchId,versionNumber:1,
      state:"DRAFT",eventType:template.eventType,
      conditions:template.condition?[template.condition]:[],
      actions:[{type:"CREATE_ATTENTION",severity:template.severity,
        summaryKey:template.actionDetail}],maxActionsPerEvent:1,
      createdAt:"2026-10-18T00:00:00.000Z",
    };
    const result=evaluateWorkflowRule(version,event,"PREVIEW");
    if(!result.ok || !result.value.matched ||
       result.value.actionPlans.length!==1 ||
       result.value.actionPlans[0].action.type!=="CREATE_ATTENTION")
      continue;
    matched++;
    if(suggestions.length<limit)suggestions.push({
      templateId:template.id,code:template.code,name:template.name,
      severity:template.severity,conditionMatched:true,
      needsOwnerApproval:true,wouldCreateInternalAttention:true,
    });
  }
  return {ok:true,value:{
    state:"SYNTHETIC_AUTOMATION_RECOMMENDATIONS_ONLY",
    eventType:input.eventType,inspected:relevant.length,matched,
    truncated:matched>suggestions.length,suggestions,
    published:false,executed:false,sentCustomerMessage:false,
    chargedCustomer:false,
  }};
}
