import {
  loadOperationalStaffSnapshot,
  type OperationalStaffSnapshot,
} from "@/features/operations/operational-product-runtime";
import {trustedQuoteInstant} from "@/features/operations/quote-validity-clock";

type Loader=typeof loadOperationalStaffSnapshot;
export interface F03SavedIntelligenceDependencies {
  loadSnapshot?:Loader;
  now?:()=>number;
  signal?:AbortSignal;
}
export type F03SavedIntelligenceResult=
  | {ok:false;code:
      "F03_BI_INPUT_INVALID"|"F03_BI_OWNER_REQUIRED"|
      "F03_BI_SNAPSHOT_UNAVAILABLE"|"F03_BI_SOURCE_INCOMPLETE"|
      "F03_BI_SOURCE_CHANGED"|"F03_BI_CANCELLED"}
  | {ok:true;value:{
      state:"AUTHORIZED_SAVED_DAILY_WEEKLY_OPERATIONS_REVIEW";
      source:"DOUBLE_READ_COMPLETE_AUTHORIZED_REQUEST_VISIT_ROWS";
      workspaceId:string;
      sourceClock:string;
      timeBasis:"UTC_CIVIL_DAYS_NO_DEADLINE_INFERENCE";
      daily:{
        utcDay:string;
        createdRequestRecords:number;
        nonCancelledVisitStartRecords:number;
      };
      weekly:{
        fromUtcDay:string;
        throughUtcDay:string;
        days:Array<{
          utcDay:string;
          createdRequestRecords:number;
          nonCancelledVisitStartRecords:number;
        }>;
        createdRequestRecords:number;
        nonCancelledVisitStartRecords:number;
      };
      revenueUnavailable:true;
      paymentSettlementUnverified:true;
      deadlinesUnavailable:true;
      financialAmountsAsserted:false;
      messagesSent:false;
      businessStateMutated:false;
      modelInvoked:false;
      manualReviewRequired:true;
    }};
const fail=(code:Extract<F03SavedIntelligenceResult,{ok:false}>["code"]):F03SavedIntelligenceResult=>
  ({ok:false,code});
const validId=(x:unknown):x is string=>
  typeof x==="string" && /^[A-Za-z0-9:_-]{3,128}$/.test(x);
const instant=(v:unknown)=>trustedQuoteInstant(v);
const dense=(v:unknown,max:number):v is Record<string,unknown>[]=>{
  if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||
    v.length>=max||Reflect.ownKeys(v).length!==v.length+1)return false;
  return v.every(row=>{
    if(!row||typeof row!=="object"||Array.isArray(row)||
       Object.getPrototypeOf(row)!==Object.prototype)return false;
    const descriptors=Object.getOwnPropertyDescriptors(row);
    return Reflect.ownKeys(row).length===Object.keys(row).length &&
      Object.values(descriptors).every(d=>Object.hasOwn(d,"value"));
  });
};
function authorized(snapshot:OperationalStaffSnapshot,slug:string,now:number):boolean{
  const scope=snapshot.branchScope,loaded=instant(snapshot.loadedAt);
  return snapshot.workspace?.slug===slug && validId(snapshot.workspace.id) &&
    snapshot.actor?.workspaceId===snapshot.workspace.id &&
    validId(snapshot.actor.userId) && snapshot.actor.role==="OWNER" &&
    scope!==undefined && (scope.mode==="ALL"||scope.mode==="BRANCH") &&
    (scope.mode!=="BRANCH"||validId(scope.selectedBranchId)) &&
    Array.isArray(scope.branches) && scope.branches.length>0 &&
    scope.branches.every(b=>validId(b.id)) &&
    loaded!==null && Number.isFinite(now) &&
    loaded>=now-300_000 && loaded<=now+60_000;
}
type Projection={
  fingerprint:string;
  requests:ReadonlyArray<{createdAt:number}>;
  visits:ReadonlyArray<{startAt:number;status:string}>;
};
const requestStatuses=new Set(["NEW","COLLECTING","READY","NEEDS_REVIEW",
  "QUOTED","BOOKED","LOST","CLOSED"]);
const visitStatuses=new Set(["AWAITING_PAYMENT","CONFIRMED","ASSIGNED",
  "EN_ROUTE","IN_PROGRESS","PENDING_REVIEW","COMPLETED","CANCELLED",
  "PAYMENT_REVIEW"]);
function savedProjection(s:OperationalStaffSnapshot):Projection|null{
  // Both operational tables are loaded with LIMIT 300. Exactly 300 rows
  // cannot distinguish a complete table from a truncated result.
  if(!dense(s.requests,300)||!dense(s.visits,300))return null;
  const scope=s.branchScope!;
  const branches=new Set(scope.branches.map(b=>b.id));
  if(branches.size!==scope.branches.length)return null;
  const seenReq=new Set<string>(),seenVisit=new Set<string>();
  const requests:Projection["requests"][number][]=[];
  const visits:Projection["visits"][number][]=[];
  const requestTuples:unknown[][]=[],visitTuples:unknown[][]=[];
  const sourceAt=instant(s.loadedAt)!;
  for(const req of s.requests){
    const created=instant(req.createdAt);
    if(!validId(req.id)||seenReq.has(req.id)||!validId(req.branchId)||
       !branches.has(req.branchId)||
       (scope.mode==="BRANCH" && req.branchId!==scope.selectedBranchId)||
       !requestStatuses.has(req.status)||created===null||
       created>sourceAt+60_000||
       !Number.isSafeInteger(req.version)||req.version<1)return null;
    seenReq.add(req.id);
    requests.push({createdAt:created});
    requestTuples.push([req.id,req.branchId,req.version,req.status,req.createdAt]);
  }
  for(const visit of s.visits){
    const start=instant(visit.startAt);
    if(!validId(visit.id)||seenVisit.has(visit.id)||
       visit.workspaceId!==s.workspace.id||!validId(visit.branchId)||
       !branches.has(visit.branchId)||
       (scope.mode==="BRANCH" && visit.branchId!==scope.selectedBranchId)||
       !visitStatuses.has(visit.status)||start===null||
       !Number.isSafeInteger(visit.version)||visit.version<1)return null;
    seenVisit.add(visit.id);
    visits.push({startAt:start,status:visit.status});
    visitTuples.push([visit.id,visit.workspaceId,visit.branchId,visit.version,
      visit.status,visit.startAt,visit.crewId??null]);
  }
  requestTuples.sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
  visitTuples.sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
  return {fingerprint:JSON.stringify({
    branch:[scope.mode,scope.selectedBranchId??null,[...branches].sort()],
    requests:requestTuples,visits:visitTuples,
  }),requests,visits};
}

/** UTC civil date aggregation only. No revenue or relative deadline can be
 * derived from creation/start instants and the persisted operational snapshot
 * does not supply settlement receipts or complete accounting records.
 */
export async function loadF03SavedDailyWeeklyIntelligence(
  workspaceSlug:string,deps:F03SavedIntelligenceDependencies={},
):Promise<F03SavedIntelligenceResult>{
  if(typeof workspaceSlug!=="string"||workspaceSlug.length<3||
     workspaceSlug.length>40||
     !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspaceSlug))
    return fail("F03_BI_INPUT_INVALID");
  if(deps.signal?.aborted)return fail("F03_BI_CANCELLED");
  const load=deps.loadSnapshot??loadOperationalStaffSnapshot,now=deps.now??Date.now;
  let first:Awaited<ReturnType<Loader>>;
  try{first=await load(workspaceSlug);}catch{return fail("F03_BI_SNAPSHOT_UNAVAILABLE");}
  if(!first.ok||!authorized(first.value,workspaceSlug,now()))
    return fail("F03_BI_OWNER_REQUIRED");
  const source=savedProjection(first.value);
  if(!source)return fail("F03_BI_SOURCE_INCOMPLETE");
  if(deps.signal?.aborted)return fail("F03_BI_CANCELLED");
  let second:Awaited<ReturnType<Loader>>;
  try{second=await load(workspaceSlug);}catch{return fail("F03_BI_SNAPSHOT_UNAVAILABLE");}
  if(!second.ok||!authorized(second.value,workspaceSlug,now())||
     second.value.workspace.id!==first.value.workspace.id||
     second.value.actor.userId!==first.value.actor.userId)
    return fail("F03_BI_OWNER_REQUIRED");
  const latest=savedProjection(second.value);
  if(!latest||latest.fingerprint!==source.fingerprint ||
     first.value.loadedAt.slice(0,10)!==second.value.loadedAt.slice(0,10))
    return fail("F03_BI_SOURCE_CHANGED");
  if(deps.signal?.aborted)return fail("F03_BI_CANCELLED");

  const currentDay=second.value.loadedAt.slice(0,10);
  const dayZero=Date.parse(currentDay+"T00:00:00Z");
  const days:Array<{utcDay:string;createdRequestRecords:number;nonCancelledVisitStartRecords:number}>=[];
  for(let offset=-6;offset<=0;offset++){
    const begin=dayZero+offset*86_400_000,end=begin+86_400_000;
    days.push({
      utcDay:new Date(begin).toISOString().slice(0,10),
      createdRequestRecords:latest.requests.filter(r=>r.createdAt>=begin&&r.createdAt<end).length,
      nonCancelledVisitStartRecords:latest.visits.filter(v=>
        v.status!=="CANCELLED"&&v.startAt>=begin&&v.startAt<end).length,
    });
  }
  const daily=days[6];
  return {ok:true,value:{
    state:"AUTHORIZED_SAVED_DAILY_WEEKLY_OPERATIONS_REVIEW",
    source:"DOUBLE_READ_COMPLETE_AUTHORIZED_REQUEST_VISIT_ROWS",
    workspaceId:second.value.workspace.id,sourceClock:second.value.loadedAt,
    timeBasis:"UTC_CIVIL_DAYS_NO_DEADLINE_INFERENCE",
    daily,weekly:{
      fromUtcDay:days[0].utcDay,throughUtcDay:daily.utcDay,
      days,
      createdRequestRecords:days.reduce((sum,d)=>sum+d.createdRequestRecords,0),
      nonCancelledVisitStartRecords:days.reduce((sum,d)=>sum+d.nonCancelledVisitStartRecords,0),
    },
    revenueUnavailable:true,paymentSettlementUnverified:true,
    deadlinesUnavailable:true,financialAmountsAsserted:false,
    messagesSent:false,businessStateMutated:false,modelInvoked:false,
    manualReviewRequired:true,
  }};
}
