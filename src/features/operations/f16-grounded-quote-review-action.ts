"use server";
import { loadOperationalStaffSnapshot } from "./operational-product-runtime";
import { proposeAuthorizedGroundedQuoteAlternatives } from "@/server/ai/f01-grounded-quote-alternatives";

type QuoteChoice={
 serviceCode:"STANDARD"|"DEEP"|"MOVE_OUT";
 variant:"BASE"|"OPTIONAL_OVEN"; currency:string;
 totalMinor:number; depositMinor:number;balanceMinor:number;durationMinutes:number;
 rateVersion:string;requiresStaffServiceSelection:boolean;
 requiresStaffAddonConfirmation:boolean;requiresSpecialistReview:boolean;
};
export type F16GroundedQuoteResult=
 | {ok:false;state:"GROUND_PRICE_UNAVAILABLE"}
 | {ok:true;state:"GROUND_PRICE_REVIEW_ONLY";requestVersion:number;
     options:QuoteChoice[];staffApprovalRequired:true;quoteCreated:false;
     modelInvoked:false;customerMessaged:false;priceBookChanged:false};
const denied=():F16GroundedQuoteResult=>({ok:false,state:"GROUND_PRICE_UNAVAILABLE"});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const safeMoney=(v:unknown):v is number=>typeof v==="number"&&
 Number.isSafeInteger(v)&&v>=0&&v<=10_000_000_000;
/** Current authenticated request revision, active catalog and saved branch rate
 * book are revalidated by F01 before a displayed alternative is returned. */
export async function requestF16GroundedQuoteReview(
 workspaceSlug:string,requestId:string,
):Promise<F16GroundedQuoteResult>{
 if(typeof workspaceSlug!=="string"||workspaceSlug.length<3||
    workspaceSlug.length>40||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspaceSlug)||
    typeof requestId!=="string"||!uuid.test(requestId))return denied();
 try{
  const snapshot=await loadOperationalStaffSnapshot(workspaceSlug);
  if(!snapshot.ok||snapshot.value.workspace.slug!==workspaceSlug||
     !["OWNER","DISPATCHER"].includes(snapshot.value.actor.role))return denied();
  const req=snapshot.value.requests.find(x=>x.id===requestId);
  if(!req||!Number.isSafeInteger(req.version)||req.version<1)return denied();
  const r=await proposeAuthorizedGroundedQuoteAlternatives({
   workspaceSlug,requestId,expectedVersion:req.version,
  });
  if(!r.ok)return denied();
  const v=r.value;
  if(v.state!=="STAFF_APPROVAL_REQUIRED"||
     v.source!=="AUTHORIZED_SAVED_REQUEST_AND_BRANCH_PRICE_BOOK"||
     v.workspaceId!==snapshot.value.workspace.id||
     v.requestId!==requestId||v.requestVersion!==req.version||
     v.savedQuoteCreated!==false||v.customerContactSent!==false||
     !Array.isArray(v.options)||v.options.length<1||v.options.length>4)return denied();
  const choices:QuoteChoice[]=[];
  const unique=new Set<string>();
  for(const o of v.options){
   if(!["STANDARD","DEEP","MOVE_OUT"].includes(o.serviceCode)||
      !["BASE","OPTIONAL_OVEN"].includes(o.variant)||
      !/^[A-Z]{3}$/.test(o.currency)||!safeMoney(o.totalMinor)||
      !safeMoney(o.depositMinor)||!safeMoney(o.balanceMinor)||
      o.totalMinor<1||o.depositMinor+o.balanceMinor!==o.totalMinor||
      !Number.isSafeInteger(o.durationMinutes)||o.durationMinutes<1||
      o.durationMinutes>1440||typeof o.rateVersion!=="string"||
      o.rateVersion.length<1||o.rateVersion.length>80||
      o.requiresStaffServiceSelection!==Boolean(o.requiresStaffServiceSelection)||
      o.requiresStaffAddonConfirmation!==Boolean(o.requiresStaffAddonConfirmation)||
      o.requiresSpecialistReview!==Boolean(o.requiresSpecialistReview))return denied();
   const key=o.serviceCode+":"+o.variant;
   if(unique.has(key))return denied();
   unique.add(key);
   choices.push({serviceCode:o.serviceCode,variant:o.variant,currency:o.currency,
     totalMinor:o.totalMinor,depositMinor:o.depositMinor,balanceMinor:o.balanceMinor,
     durationMinutes:o.durationMinutes,rateVersion:o.rateVersion,
     requiresStaffServiceSelection:o.requiresStaffServiceSelection,
     requiresStaffAddonConfirmation:o.requiresStaffAddonConfirmation,
     requiresSpecialistReview:o.requiresSpecialistReview});
  }
  return {ok:true,state:"GROUND_PRICE_REVIEW_ONLY",requestVersion:req.version,
   options:choices,staffApprovalRequired:true,quoteCreated:false,modelInvoked:false,
   customerMessaged:false,priceBookChanged:false};
 }catch{return denied();}
}
