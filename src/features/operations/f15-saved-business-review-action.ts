"use server";
import { loadF03SavedDailyWeeklyIntelligence } from "@/server/ai/f03-saved-daily-weekly-intelligence";
export type F15SavedBusinessReview =
 | {ok:false;state:"SAVED_BI_UNAVAILABLE"}
 | {ok:true;state:"SAVED_BI_REVIEW_ONLY";sourceClock:string;daily:{
     utcDay:string;requests:number;visits:number};
     weekly:{fromUtcDay:string;throughUtcDay:string;requests:number;visits:number;
       days:Array<{utcDay:string;requests:number;visits:number}>};
     completeHistoryVerified:false;revenueVerified:false;manualReviewRequired:true;
     modelInvoked:false;messagesSent:false;financialChanges:false};
const unavailable=():F15SavedBusinessReview=>({ok:false,state:"SAVED_BI_UNAVAILABLE"});
const count=(x:unknown):x is number=>typeof x==="number"&&Number.isSafeInteger(x)&&x>=0&&x<300;
const day=(x:unknown):x is string=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x);
/** Reuses F03 two-owner-check, two-read saved snapshot. Counts are bounded
 * observations, never estimates of revenue or comprehensive transaction history. */
export async function requestF15SavedBusinessReview(workspaceSlug:string):Promise<F15SavedBusinessReview>{
 if(typeof workspaceSlug!=="string"||workspaceSlug.length<3||
    workspaceSlug.length>40||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspaceSlug))
    return unavailable();
 try{
  const r=await loadF03SavedDailyWeeklyIntelligence(workspaceSlug);
  if(!r.ok)return unavailable();
  const v=r.value;
  if(v.state!=="AUTHORIZED_SAVED_DAILY_WEEKLY_OPERATIONS_REVIEW"||
     v.source!=="DOUBLE_READ_BOUNDED_AUTHORIZED_REQUEST_VISIT_ROWS"||
     v.manualReviewRequired!==true||v.historicalCompletenessUnverified!==true||
     v.revenueUnavailable!==true||v.paymentSettlementUnverified!==true||
     v.financialAmountsAsserted!==false||v.messagesSent!==false||
     v.businessStateMutated!==false||v.modelInvoked!==false||
     !Array.isArray(v.weekly.days)||v.weekly.days.length!==7||
     !day(v.daily.utcDay)||!day(v.weekly.fromUtcDay)||!day(v.weekly.throughUtcDay)||
     !count(v.weekly.createdRequestRecords)||!count(v.weekly.nonCancelledVisitStartRecords)||
     !count(v.daily.createdRequestRecords)||!count(v.daily.nonCancelledVisitStartRecords)||
     !v.weekly.days.every(x=>day(x.utcDay)&&count(x.createdRequestRecords)&&count(x.nonCancelledVisitStartRecords)))
    return unavailable();
  return {ok:true,state:"SAVED_BI_REVIEW_ONLY",sourceClock:v.sourceClock,
   daily:{utcDay:v.daily.utcDay,requests:v.daily.createdRequestRecords,
    visits:v.daily.nonCancelledVisitStartRecords},
   weekly:{fromUtcDay:v.weekly.fromUtcDay,throughUtcDay:v.weekly.throughUtcDay,
    requests:v.weekly.createdRequestRecords,visits:v.weekly.nonCancelledVisitStartRecords,
    days:v.weekly.days.map(x=>({utcDay:x.utcDay,requests:x.createdRequestRecords,
     visits:x.nonCancelledVisitStartRecords}))},
   completeHistoryVerified:false,revenueVerified:false,manualReviewRequired:true,
   modelInvoked:false,messagesSent:false,financialChanges:false};
 }catch{return unavailable();}
}
