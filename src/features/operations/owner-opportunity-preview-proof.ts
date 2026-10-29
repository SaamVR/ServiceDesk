/** Browser-only proof gate: never trust the server-returned label as proof of
 * a saved action. Treat review-only suggestions as untrusted until shape,
 * tenant, branch, internal action and no-side-effect flags are all verified. */
export interface VerifiedOwnerOpportunity{
 key:"CRITICAL_ATTENTION"|"OPEN_REQUEST";
 count:number;eventType:"ATTENTION_OPENED"|"REQUEST_CREATED";
 severity:"CRITICAL"|"WARNING";summaryKey:string;
 title:string;description:string;module:"overview"|"requests";
}
export interface VerifiedOwnerOpportunityPreview {
 inspectedPriorities:number;
 suggestions:VerifiedOwnerOpportunity[];
}
const template={
 CRITICAL_ATTENTION:{target:"FUTURE_ATTENTION_OPENED",eventType:"ATTENTION_OPENED",
  severity:"CRITICAL",summaryKey:"AI_TRIAGE_EXCEPTION",
  title:"Critical attention follow-up",description:"Current critical alerts suggest a future internal triage rule. Existing alerts are NOT processed.",module:"overview"},
 OPEN_REQUEST:{target:"FUTURE_REQUEST_CREATED",eventType:"REQUEST_CREATED",
  severity:"WARNING",summaryKey:"AI_REVIEW_NEW_REQUEST",
  title:"New request intake review",description:"Saved open requests suggest an internal review rule for future requests. No current request is changed.",module:"requests"},
} as const;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function data(value:unknown,fields:readonly string[]):value is Record<string,unknown>{
 try{
  if(!value||typeof value!=="object"||Array.isArray(value)||
     Object.getPrototypeOf(value)!==Object.prototype)return false;
  const own=Reflect.ownKeys(value),descs=Object.getOwnPropertyDescriptors(value);
  return own.length===fields.length&&own.every(x=>typeof x==="string"&&fields.includes(x))&&
   fields.every(x=>Object.hasOwn(descs,x)&&Object.hasOwn(descs[x],"value")&&descs[x].enumerable);
 }catch{return false;}
}
export function parseOwnerOpportunityPreview(raw:unknown,scope:{
 workspaceId:string;branchId:string;
}):VerifiedOwnerOpportunityPreview|null{
 if(!uuid.test(scope.workspaceId)||!uuid.test(scope.branchId)||
    !data(raw,["ok","state","source","workspaceId","branchId","inspectedPriorities",
      "suggestions","modelInvoked","saved","executed","published",
      "providerMessagesSent","financialStateChanged"])||
    raw.ok!==true||raw.state!=="OWNER_OPPORTUNITY_REVIEW_ONLY"||
    raw.source!=="DOUBLE_CHECKED_OWNER_WORKDAY_AND_ACTIVE_WORKSPACE_BRANCH"||
    raw.workspaceId!==scope.workspaceId||raw.branchId!==scope.branchId||
    !Number.isSafeInteger(raw.inspectedPriorities)||
    (raw.inspectedPriorities as number)<0||(raw.inspectedPriorities as number)>7||
    raw.modelInvoked!==false||raw.saved!==false||raw.executed!==false||
    raw.published!==false||raw.providerMessagesSent!==false||
    raw.financialStateChanged!==false||!Array.isArray(raw.suggestions)||
    raw.suggestions.length>2)return null;
 const selected:VerifiedOwnerOpportunity[]=[];
 const seen=new Set<string>();
 for(const row of raw.suggestions){
  if(!data(row,["evidenceKey","savedCount","target","eventType","severity",
      "summaryKey","existingCasesProcessed","published","requiresOwnerApproval"])||
     typeof row.evidenceKey!=="string"||!Object.hasOwn(template,row.evidenceKey)||
     seen.has(row.evidenceKey)||!Number.isSafeInteger(row.savedCount)||
     (row.savedCount as number)<1||(row.savedCount as number)>5000||
     row.existingCasesProcessed!==false||row.published!==false||
     row.requiresOwnerApproval!==true)return null;
  const t=template[row.evidenceKey as keyof typeof template];
  if(row.target!==t.target||row.eventType!==t.eventType||
     row.severity!==t.severity||row.summaryKey!==t.summaryKey)return null;
  seen.add(row.evidenceKey);
  selected.push({key:row.evidenceKey as VerifiedOwnerOpportunity["key"],
   count:row.savedCount as number,eventType:t.eventType,severity:t.severity,
   summaryKey:t.summaryKey,title:t.title,description:t.description,module:t.module});
 }
 // The upstream workday priority order ranks critical review before intake.
 if(selected.length===2&&selected[0].key!=="CRITICAL_ATTENTION")return null;
 return {inspectedPriorities:raw.inspectedPriorities as number,suggestions:selected};
}
