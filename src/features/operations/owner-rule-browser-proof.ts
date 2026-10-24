/** Browser validation for the owner-only AI-to-rule suggestion endpoint.
 * Both the model output and HTTP response are untrusted. Only a strictly
 * compiled single internal CREATE_ATTENTION action may be displayed.
 */
export type SupportedOwnerRuleEvent = "REQUEST_CREATED" | "QUOTE_ACCEPTED" |
  "VISIT_COMPLETED" | "INVOICE_PAID" | "ATTENTION_OPENED";
export type SuggestedSeverity = "INFO" | "WARNING" | "CRITICAL";
export type SuggestedServiceCode = "STANDARD" | "DEEP" | "MOVE_OUT";
export interface VerifiedOwnerRuleSuggestion {
  model: string;
  workspaceId: string;
  branchId: string;
  eventType: SupportedOwnerRuleEvent;
  severity: SuggestedSeverity;
  serviceCode?: SuggestedServiceCode;
  source: "AUTHORIZED_OWNER_AND_SAVED_BRANCH";
  executed: false;
  published: false;
}
export interface VerifiedOwnerWhatIf {
  state: "SYNTHETIC_RULE_PREVIEW_ONLY";
  inputSource: "OWNER_HYPOTHETICAL_NOT_SAVED_EVENT";
  matched: boolean;
  wouldCreateAttention: boolean;
  checkedConditions: Array<{field:string;matched:boolean}>;
  executed: false;
  published: false;
  customerMessaged: false;
  paymentChanged: false;
  ownerPublishStillRequired: true;
}
const eventNames:readonly SupportedOwnerRuleEvent[]=[
  "REQUEST_CREATED","QUOTE_ACCEPTED","VISIT_COMPLETED","INVOICE_PAID","ATTENTION_OPENED",
];
const levels:readonly SuggestedSeverity[]=["INFO","WARNING","CRITICAL"];
const services:readonly SuggestedServiceCode[]=["STANDARD","DEEP","MOVE_OUT"];
const keys:Record<SupportedOwnerRuleEvent,string>={
  REQUEST_CREATED:"AI_REVIEW_NEW_REQUEST",
  QUOTE_ACCEPTED:"AI_REVIEW_ACCEPTED_QUOTE",
  VISIT_COMPLETED:"AI_REVIEW_COMPLETED_VISIT",
  INVOICE_PAID:"AI_REVIEW_PAID_INVOICE",
  ATTENTION_OPENED:"AI_TRIAGE_EXCEPTION",
};
/** JSON responses and server-action values must be inert own-data records.
 * A getter can throw or import concealed provider/customer authority before
 * the owner sees a safe review. Reject rather than execute it. */
const plain=(value:unknown):value is Record<string,unknown> => {
  try {
    return !!value && typeof value==="object" && !Array.isArray(value) &&
      Object.getPrototypeOf(value)===Object.prototype &&
      Reflect.ownKeys(value).length===Object.keys(value).length &&
      Object.values(Object.getOwnPropertyDescriptors(value))
        .every(desc=>Object.hasOwn(desc,"value"));
  } catch {return false;}
};
/** Dense arrays with no accessor/symbol/sidecar fields; max bounds prevent
 * model fanout or untrusted property enumeration. */
const inertArray=(value:unknown,max:number):value is unknown[] => {
  try {
    if(!Array.isArray(value) || Object.getPrototypeOf(value)!==Array.prototype ||
       value.length>max || Reflect.ownKeys(value).length!==value.length+1)
      return false;
    const descriptors=Object.getOwnPropertyDescriptors(value);
    return Array.from({length:value.length},(_,i)=>
      Object.hasOwn(descriptors,String(i)) &&
      Object.hasOwn(descriptors[String(i)],"value")).every(Boolean);
  } catch {return false;}
};
const exact=(obj:Record<string,unknown>,names:readonly string[]) =>
  Object.keys(obj).length===names.length && names.every(k=>Object.hasOwn(obj,k));

export function validateOwnerRuleIntent(raw:string):string|null {
  if(typeof raw!=="string")return null;
  const value=raw.trim();
  if(value.length<10 || value.length>240 || /[\d@<>$€£]/u.test(value) ||
     /https?:|www\.|bearer\s|api[_ -]?key/iu.test(value) ||
     !/^[\p{L}\p{M}\p{Zs},.!?;:'"()_/-]+$/u.test(value)) return null;
  return value;
}
export function parseOwnerWorkflowSuggestion(raw:unknown,expected:{
  workspaceId:string;branchId:string;
}):VerifiedOwnerRuleSuggestion|null {
  if(!plain(raw) || !exact(raw,["state","source","model","draft","executed"]) ||
     raw.state!=="AI_RULE_DRAFT_OWNER_REVIEW_REQUIRED" ||
     raw.source!=="AUTHORIZED_OWNER_AND_SAVED_BRANCH" ||
     raw.executed!==false ||
     typeof raw.model!=="string" || raw.model.length>100 ||
     !/^[A-Za-z0-9._:/-]{1,100}$/.test(raw.model) ||
     !plain(raw.draft)) return null;
  const d=raw.draft;
  if(!exact(d,["state","source","workspaceId","branchId","eventType",
    "conditions","actions","maxActionsPerEvent","published","requiresOwnerPublish",
    "previewOnly","sendsCustomerMessages","mutatesFinancialState"]) ||
     d.state!=="DRAFT_REQUIRES_OWNER_REVIEW" ||
     d.source!=="UNTRUSTED_MODEL_SUGGESTION_STRICTLY_COMPILED" ||
     d.workspaceId!==expected.workspaceId || d.branchId!==expected.branchId ||
     typeof d.eventType!=="string" || !eventNames.includes(d.eventType as SupportedOwnerRuleEvent) ||
     d.maxActionsPerEvent!==1 || d.published!==false ||
     d.requiresOwnerPublish!==true || d.previewOnly!==true ||
     d.sendsCustomerMessages!==false || d.mutatesFinancialState!==false ||
     !inertArray(d.conditions,1) ||
     !inertArray(d.actions,1) || d.actions.length!==1 || !plain(d.actions[0])) return null;
  const eventType=d.eventType as SupportedOwnerRuleEvent;
  const action=d.actions[0] as Record<string,unknown>;
  if(!exact(action,["type","severity","summaryKey"]) ||
     action.type!=="CREATE_ATTENTION" ||
     typeof action.severity!=="string" ||
     !levels.includes(action.severity as SuggestedSeverity) ||
     action.summaryKey!==keys[eventType]) return null;
  let serviceCode:SuggestedServiceCode|undefined;
  if(d.conditions.length){
    const c=d.conditions[0];
    if(!plain(c) || !exact(c,["field","operator","value"]) ||
       c.field!=="request.serviceCode" || c.operator!=="EQ" ||
       typeof c.value!=="string" ||
       !services.includes(c.value as SuggestedServiceCode) ||
       eventType==="ATTENTION_OPENED") return null;
    serviceCode=c.value as SuggestedServiceCode;
  }
  return {
    model:raw.model,workspaceId:expected.workspaceId,branchId:expected.branchId,
    eventType,severity:action.severity as SuggestedSeverity,
    ...(serviceCode?{serviceCode}:{}),
    source:"AUTHORIZED_OWNER_AND_SAVED_BRANCH",executed:false,published:false,
  };
}
export function parseOwnerWhatIfResponse(raw:unknown,expected:{
  eventType:SupportedOwnerRuleEvent;
}):VerifiedOwnerWhatIf|null {
  if(!plain(raw) || !exact(raw,["ok","state","inputSource","eventType",
    "matched","wouldCreateAttention","checkedConditions","conditionCount",
    "executed","published","customerMessaged","paymentChanged","ownerPublishStillRequired"]) ||
     raw.ok!==true || raw.state!=="SYNTHETIC_RULE_PREVIEW_ONLY" ||
     raw.inputSource!=="OWNER_HYPOTHETICAL_NOT_SAVED_EVENT" ||
     raw.eventType!==expected.eventType ||
     typeof raw.matched!=="boolean" || typeof raw.wouldCreateAttention!=="boolean" ||
     !inertArray(raw.checkedConditions,1) ||
     !Number.isSafeInteger(raw.conditionCount) ||
     raw.conditionCount!==raw.checkedConditions.length || raw.conditionCount>1 ||
     raw.executed!==false || raw.published!==false ||
     raw.customerMessaged!==false || raw.paymentChanged!==false ||
     raw.ownerPublishStillRequired!==true) return null;
  const checkedConditions:Array<{field:string;matched:boolean}>=[];
  for(const rawCondition of raw.checkedConditions){
    if(!plain(rawCondition) || !exact(rawCondition,["field","matched"]) ||
       rawCondition.field!=="request.serviceCode" ||
       typeof rawCondition.matched!=="boolean")return null;
    checkedConditions.push({field:"request.serviceCode",matched:rawCondition.matched});
  }
  return {
    state:"SYNTHETIC_RULE_PREVIEW_ONLY",
    inputSource:"OWNER_HYPOTHETICAL_NOT_SAVED_EVENT",
    matched:raw.matched,wouldCreateAttention:raw.wouldCreateAttention,
    checkedConditions,executed:false,published:false,
    customerMessaged:false,paymentChanged:false,ownerPublishStillRequired:true,
  };
}


export type VerifiedOwnerWhatIfMatrix = {
  state:"SYNTHETIC_COMPARISON_ONLY";
  results:Array<{serviceCode:SuggestedServiceCode;matched:boolean;wouldCreateAttention:boolean}>;
  executed:false;published:false;customerMessaged:false;paymentChanged:false;
};
/** Untrusted server-action transport still needs strict browser projection.
 * Three distinct known fictional codes and no additional keys permitted.
 */
export function parseOwnerWhatIfMatrix(raw:unknown):VerifiedOwnerWhatIfMatrix|null{
  if(!plain(raw)||!exact(raw,["ok","state","executed","published",
    "customerMessaged","paymentChanged","results"])||
    raw.ok!==true||raw.state!=="SYNTHETIC_COMPARISON_ONLY"||
    raw.executed!==false||raw.published!==false||
    raw.customerMessaged!==false||raw.paymentChanged!==false||
    !inertArray(raw.results,3)||raw.results.length!==3)return null;
  const codes:readonly SuggestedServiceCode[]=["STANDARD","DEEP","MOVE_OUT"];
  const results:VerifiedOwnerWhatIfMatrix["results"]=[];
  for(let i=0;i<codes.length;i++){
    const item=raw.results[i];
    if(!plain(item)||!exact(item,["serviceCode","matched","wouldCreateAttention"])||
       item.serviceCode!==codes[i]||
       typeof item.matched!=="boolean"||typeof item.wouldCreateAttention!=="boolean"||
       (item.wouldCreateAttention&&!item.matched))return null;
    results.push({serviceCode:codes[i],matched:item.matched,
      wouldCreateAttention:item.wouldCreateAttention});
  }
  return {state:"SYNTHETIC_COMPARISON_ONLY",results,
    executed:false,published:false,customerMessaged:false,paymentChanged:false};
}
