import type {ProposedOwnerWorkflowDraft} from "./workflow-draft-proposal";

type Rejection="PORTFOLIO_SCOPE_INVALID"|"PORTFOLIO_SOURCE_INVALID";
type Conflict="DUPLICATE_DRAFT"|"OVERLAPPING_CONDITION"|"UNCONDITIONAL_SHADOW";
export type AutomationPortfolioResult=
 | {ok:false;code:Rejection}
 | {ok:true;value:{state:"OWNER_AUTOMATION_PORTFOLIO_PREVIEW_ONLY";
   workspaceId:string;branchId:string;inspected:number;
   conflicts:Array<{first:number;second:number;code:Conflict;eventType:string}>;
   reviewedWithoutConflicts:boolean;publishPerformed:false;workflowExecuted:false;
   providerMessagesSent:false;financialStateChanged:false;}};
const safeId=(v:unknown):v is string=>typeof v==="string"&&/^[A-Za-z0-9:_-]{3,128}$/.test(v);
function safeDraft(v:unknown,workspaceId:string,branchId:string):v is ProposedOwnerWorkflowDraft{
 if(!v||typeof v!=="object"||Array.isArray(v)||
   Object.getPrototypeOf(v)!==Object.prototype)return false;
 const d=v as Record<string,unknown>;
 if(Object.keys(d).length!==Reflect.ownKeys(d).length ||
   Object.values(Object.getOwnPropertyDescriptors(d)).some(a=>!Object.hasOwn(a,"value")) ||
   d.state!=="DRAFT_REQUIRES_OWNER_REVIEW" ||
   d.workspaceId!==workspaceId||d.branchId!==branchId||
   d.previewOnly!==true||d.published!==false||
   d.requiresOwnerPublish!==true||d.sendsCustomerMessages!==false||
   d.mutatesFinancialState!==false||d.maxActionsPerEvent!==1 ||
   !["REQUEST_CREATED","QUOTE_ACCEPTED","VISIT_COMPLETED","INVOICE_PAID","ATTENTION_OPENED"].includes(String(d.eventType)) ||
   !Array.isArray(d.actions)||d.actions.length!==1||
   Reflect.ownKeys(d.actions).length!==d.actions.length+1||
   !d.actions.every((a:unknown)=>a&&typeof a==="object"&&!Array.isArray(a)&&
     Object.getPrototypeOf(a)===Object.prototype &&
     Reflect.ownKeys(a).length===3 &&
     ["type","severity","summaryKey"].every(k=>Object.hasOwn(a,k)) &&
     Object.values(Object.getOwnPropertyDescriptors(a)).every(p=>Object.hasOwn(p,"value")) &&
     (a as Record<string,unknown>).type==="CREATE_ATTENTION" &&
     ["INFO","WARNING","CRITICAL"].includes(String((a as Record<string,unknown>).severity)) &&
     typeof (a as Record<string,unknown>).summaryKey==="string" &&
     /^[A-Z0-9_]{3,128}$/.test((a as Record<string,string>).summaryKey)) ||
   !Array.isArray(d.conditions)||d.conditions.length>1||
   Reflect.ownKeys(d.conditions).length!==d.conditions.length+1)return false;
 const keys=["state","source","workspaceId","branchId","eventType","conditions",
   "actions","maxActionsPerEvent","published","requiresOwnerPublish",
   "previewOnly","sendsCustomerMessages","mutatesFinancialState"];
 if(Object.keys(d).length!==keys.length||keys.some(k=>!Object.hasOwn(d,k))||
   d.source!=="UNTRUSTED_MODEL_SUGGESTION_STRICTLY_COMPILED")return false;
 const c=d.conditions[0];
 return c===undefined || !!c&&typeof c==="object"&&!Array.isArray(c)&&
   Object.getPrototypeOf(c)===Object.prototype &&
   Object.keys(c).length===3&&Reflect.ownKeys(c).length===3&&
   Object.values(Object.getOwnPropertyDescriptors(c)).every(p=>Object.hasOwn(p,"value"))&&
   c.field==="request.serviceCode"&&c.operator==="EQ"&&
   ["STANDARD","DEEP","MOVE_OUT"].includes(String(c.value)) &&
   d.eventType!=="ATTENTION_OPENED";
}
/** Preview possible overlap among independent rule drafts, not real published
 * rule conflicts. No persisted rule inventory means no "safe to publish" claim. */
export function inspectOwnerAutomationPortfolio(input:{
 actor:{workspaceId:string;role:string};workspaceId:string;branchId:string;
 drafts:readonly ProposedOwnerWorkflowDraft[];
}):AutomationPortfolioResult{
 if(!input||!input.actor||input.actor.role!=="OWNER"||
    input.actor.workspaceId!==input.workspaceId||!safeId(input.workspaceId)||
    !safeId(input.branchId))return {ok:false,code:"PORTFOLIO_SCOPE_INVALID"};
 const list=input.drafts;
 if(!Array.isArray(list)||list.length===0||list.length>25||
    Reflect.ownKeys(list).length!==list.length+1||
    !list.every((d,i)=>Object.hasOwn(list,i)&&safeDraft(d,input.workspaceId,input.branchId)))
   return {ok:false,code:"PORTFOLIO_SOURCE_INVALID"};
 const conflicts:Extract<AutomationPortfolioResult,{ok:true}>["value"]["conflicts"]=[];
 for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
   const a=list[i],b=list[j];
   if(a.eventType!==b.eventType)continue;
   const left=a.conditions[0]?.value,right=b.conditions[0]?.value;
   const code:Conflict|undefined=!a.conditions.length&&!b.conditions.length?"DUPLICATE_DRAFT":
     !a.conditions.length||!b.conditions.length?"UNCONDITIONAL_SHADOW":
     left===right?"OVERLAPPING_CONDITION":undefined;
   if(code)conflicts.push({first:i,second:j,code,eventType:a.eventType});
 }
 return {ok:true,value:{state:"OWNER_AUTOMATION_PORTFOLIO_PREVIEW_ONLY",
   workspaceId:input.workspaceId,branchId:input.branchId,
   inspected:list.length,conflicts,reviewedWithoutConflicts:conflicts.length===0,
   publishPerformed:false,workflowExecuted:false,
   providerMessagesSent:false,financialStateChanged:false}};
}
