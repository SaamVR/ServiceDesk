import {createHash} from "node:crypto";
import {resolveStaffActor} from "@/features/operations/operational-product-runtime";
import {trustedQuoteInstant} from "@/features/operations/quote-validity-clock";
type Resolver=typeof resolveStaffActor;
type Session=Extract<Awaited<ReturnType<Resolver>>,{ok:true}>["value"];
type SourceReader=(session:Session)=>Promise<F07UsageSource|null>;
export interface F07UsageRow{
 id:string;workspaceId:string;metric:"AI_ACTIONS";
 periodStart:string;periodEnd:string;used:number;updatedAt:string;
}
export interface F07UsageSource{rows:F07UsageRow[];limitValue:number|null}
export interface F07UsageDeps{resolveActor?:Resolver;readSaved?:SourceReader;signal?:AbortSignal;now?:()=>number}
export type F07UsageResult=
 | {ok:false;code:"F07_USAGE_INPUT_INVALID"|"F07_USAGE_OWNER_REQUIRED"|
   "F07_USAGE_SOURCE_UNAVAILABLE"|"F07_USAGE_SOURCE_UNVERIFIED"|
   "F07_USAGE_SOURCE_CHANGED"|"F07_USAGE_CANCELLED"}
 | {ok:true;value:{
   state:"F07_OWNER_SAVED_AI_ACTION_USAGE_REVIEW";
   source:"DOUBLE_READ_SCOPED_AI_ACTION_COUNTERS_NOT_TOKEN_BILLING";
   workspaceId:string;inspectedPeriods:number;
   currentPeriodStart:string|null;currentUsed:number|null;
   currentLimit:number|null;evidenceDigest:string;
   warnings:Array<"MODEL_SPEND_AMOUNT_UNVERIFIED"|"AI_ACTION_LIMIT_REACHED"|
     "AI_ACTION_LIMIT_APPROACHING"|"AI_ACTION_USAGE_HISTORY_NOT_PROVEN">;
   modelPriceAndTokensUnavailable:true;actualModelCostUnverified:true;
   serviceRoleCounterCompletenessUnverified:true;
   spendAmountMinor:null;currency:null;
   operatorReviewRequired:true;
   modelInvoked:false;providerCalled:false;customerMessaged:false;
   usageConsumed:false;moneyChanged:false;published:false;
 }};
const deny=(code:Extract<F07UsageResult,{ok:false}>["code"]):F07UsageResult=>({ok:false,code});
const uuid=(v:unknown):v is string=>typeof v==="string"&&
 /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const time=(v:unknown)=>trustedQuoteInstant(v);
const slug=(v:unknown):v is string=>typeof v==="string"&&v.length>=3&&v.length<=40&&
 /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
function plain(v:unknown,keys:readonly string[]):v is Record<string,unknown>{
 try{
  if(!v||typeof v!=="object"||Array.isArray(v)||Object.getPrototypeOf(v)!==Object.prototype)return false;
  const d=Object.getOwnPropertyDescriptors(v);
  return Reflect.ownKeys(v).length===keys.length&&
   keys.every(k=>Object.hasOwn(d,k)&&Object.hasOwn(d[k],"value"));
 }catch{return false;}
}
async function readSaved(session:Session):Promise<F07UsageSource|null>{
 try{
  const {id}=session.workspace;
  const [counter,limit]=await Promise.all([
   session.service.from("workspace_usage_counters")
    .select("id,workspace_id,metric,period_start,period_end,used,updated_at")
    .eq("workspace_id",id).eq("metric","AI_ACTIONS")
    .order("period_start",{ascending:false}).limit(201),
   session.service.from("workspace_usage_limits")
    .select("workspace_id,metric,limit_value")
    .eq("workspace_id",id).eq("metric","AI_ACTIONS").maybeSingle(),
  ]);
  if(counter.error||limit.error||!Array.isArray(counter.data)||counter.data.length>=201)return null;
  const rows:F07UsageRow[]=[];
  for(const v of counter.data){
   if(!v||typeof v!=="object")return null;
   rows.push({id:v.id,workspaceId:v.workspace_id,metric:v.metric,
    periodStart:v.period_start,periodEnd:v.period_end,
    used:v.used,updatedAt:v.updated_at});
  }
  if(limit.data&&(limit.data.workspace_id!==id||limit.data.metric!=="AI_ACTIONS"))return null;
  return {rows,limitValue:limit.data?.limit_value??null};
 }catch{return null;}
}
type Review={fingerprint:string;periods:F07UsageRow[];current:F07UsageRow|null};
function checked(source:F07UsageSource,workspace:string,now:number):Review|null{
 if(!plain(source,["rows","limitValue"])||!Array.isArray(source.rows)||
    Object.getPrototypeOf(source.rows)!==Array.prototype||
    source.rows.length>=201||
    Reflect.ownKeys(source.rows).length!==source.rows.length+1||
    (source.limitValue!==null&&(!Number.isSafeInteger(source.limitValue)||
      source.limitValue<0||source.limitValue>1_000_000_000)))return null;
 const observed=new Set<string>(),seenIds=new Set<string>();
 const periods:F07UsageRow[]=[];
 for(const v of source.rows){
  if(!plain(v,["id","workspaceId","metric","periodStart","periodEnd","used","updatedAt"])||
     !uuid(v.id)||seenIds.has(v.id)||v.workspaceId!==workspace||
     v.metric!=="AI_ACTIONS"||
     !Number.isSafeInteger(v.used)||v.used<0||v.used>1_000_000_000||
     time(v.periodStart)===null||time(v.periodEnd)===null||time(v.updatedAt)===null||
     time(v.periodEnd)!<=time(v.periodStart)!||
     time(v.updatedAt)!>now+60_000||observed.has(v.periodStart+":"+v.periodEnd))
     return null;
  seenIds.add(v.id);observed.add(v.periodStart+":"+v.periodEnd);
  periods.push(v);
 }
 periods.sort((a,b)=>a.periodStart.localeCompare(b.periodStart)||a.id.localeCompare(b.id));
 const active=periods.filter(v=>time(v.periodStart)!<=now&&now<time(v.periodEnd)!);
 if(active.length>1)return null;
 return {periods,current:active[0]??null,
  fingerprint:JSON.stringify({
   workspace,limit:source.limitValue,rows:periods.map(v=>
    [v.id,v.workspaceId,v.metric,v.periodStart,v.periodEnd,v.used,v.updatedAt]),
  })};
}
function owner(x:Awaited<ReturnType<Resolver>>,name:string):
 x is Extract<Awaited<ReturnType<Resolver>>,{ok:true}>{
 return x.ok&&x.value.workspace.slug===name&&uuid(x.value.workspace.id)&&
  x.value.actor.workspaceId===x.value.workspace.id&&
  uuid(x.value.actor.userId)&&x.value.actor.role==="OWNER";
}
export async function reviewF07SavedAiActionUsage(
 name:string,deps:F07UsageDeps={},
):Promise<F07UsageResult>{
 if(!slug(name))return deny("F07_USAGE_INPUT_INVALID");
 if(deps.signal?.aborted)return deny("F07_USAGE_CANCELLED");
 const resolve=deps.resolveActor??resolveStaffActor,reader=deps.readSaved??readSaved;
 const now=deps.now??Date.now;
 const clock=now();if(!Number.isFinite(clock))return deny("F07_USAGE_INPUT_INVALID");
 let a:Awaited<ReturnType<Resolver>>;
 try{a=await resolve(name);}catch{return deny("F07_USAGE_OWNER_REQUIRED");}
 if(!owner(a,name))return deny("F07_USAGE_OWNER_REQUIRED");
 let first:F07UsageSource|null;
 try{first=await reader(a.value);}catch{first=null;}
 const initial=first?checked(first,a.value.workspace.id,clock):null;
 if(!initial)return deny("F07_USAGE_SOURCE_UNVERIFIED");
 if(deps.signal?.aborted)return deny("F07_USAGE_CANCELLED");
 let b:Awaited<ReturnType<Resolver>>;
 try{b=await resolve(name);}catch{return deny("F07_USAGE_SOURCE_CHANGED");}
 if(!owner(b,name)||b.value.workspace.id!==a.value.workspace.id||
   b.value.actor.userId!==a.value.actor.userId)return deny("F07_USAGE_SOURCE_CHANGED");
 let second:F07UsageSource|null;
 try{second=await reader(b.value);}catch{second=null;}
 const latest=second?checked(second,b.value.workspace.id,clock):null;
 if(!latest||latest.fingerprint!==initial.fingerprint)return deny("F07_USAGE_SOURCE_CHANGED");
 if(deps.signal?.aborted)return deny("F07_USAGE_CANCELLED");
 const limit=second!.limitValue,active=latest.current;
 const warnings:Extract<F07UsageResult,{ok:true}>["value"]["warnings"]=[
   "MODEL_SPEND_AMOUNT_UNVERIFIED",
 ];
 if(!active)warnings.push("AI_ACTION_USAGE_HISTORY_NOT_PROVEN");
 if(active&&limit!==null&&active.used>=limit)warnings.push("AI_ACTION_LIMIT_REACHED");
 else if(active&&limit!==null&&limit>0&&active.used>=Math.ceil(limit*0.8))
  warnings.push("AI_ACTION_LIMIT_APPROACHING");
 return {ok:true,value:{
  state:"F07_OWNER_SAVED_AI_ACTION_USAGE_REVIEW",
  source:"DOUBLE_READ_SCOPED_AI_ACTION_COUNTERS_NOT_TOKEN_BILLING",
  workspaceId:b.value.workspace.id,inspectedPeriods:latest.periods.length,
  currentPeriodStart:active?.periodStart??null,currentUsed:active?.used??null,
  currentLimit:limit,evidenceDigest:createHash("sha256").update(latest.fingerprint).digest("hex"),
  warnings,modelPriceAndTokensUnavailable:true,actualModelCostUnverified:true,
  serviceRoleCounterCompletenessUnverified:true,spendAmountMinor:null,currency:null,
  operatorReviewRequired:true,modelInvoked:false,providerCalled:false,
  customerMessaged:false,usageConsumed:false,moneyChanged:false,published:false,
 }};
}
