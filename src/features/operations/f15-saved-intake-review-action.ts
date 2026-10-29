"use server";
import { loadOperationalStaffSnapshot } from "./operational-product-runtime";
import { planAuthorizedSavedIntake } from "@/server/ai/f01-saved-intake-proposal";

export type F15IntakeReview =
 | { ok:false; state:"SAVED_INTAKE_UNAVAILABLE" }
 | { ok:true; state:"SAVED_INTAKE_REVIEW_ONLY";
     classification:"CLARIFICATION_NEEDED"|"READY_FOR_REVIEW"|"SPECIALIST_REVIEW";
     sourceVersion:number; questions:Array<{field:"serviceCode"|"bedrooms"|"bathrooms";text:string}>;
     staffConfirmationRequired:true; modelInvoked:false; customerContactSent:false;
     bookingChanged:false; pricingChanged:false };
const unavailable=():F15IntakeReview=>({ok:false,state:"SAVED_INTAKE_UNAVAILABLE"});
const slug=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** A fresh authenticated snapshot discovers the exact saved revision. The F01
 * engine then reauthenticates, rereads and refuses source-version changes. */
export async function requestF15SavedIntakeReview(workspaceSlug:string,requestId:string):Promise<F15IntakeReview>{
 if(typeof workspaceSlug!=="string"||workspaceSlug.length<3||
    workspaceSlug.length>40||!slug.test(workspaceSlug)||
    typeof requestId!=="string"||!uuid.test(requestId))return unavailable();
 try{
  const snapshot=await loadOperationalStaffSnapshot(workspaceSlug);
  if(!snapshot.ok||snapshot.value.workspace.slug!==workspaceSlug||
     !["OWNER","DISPATCHER"].includes(snapshot.value.actor.role))return unavailable();
  const req=snapshot.value.requests.find(x=>x.id===requestId);
  if(!req||!Number.isSafeInteger(req.version)||req.version<1)return unavailable();
  const result=await planAuthorizedSavedIntake({
   workspaceSlug,requestId,expectedVersion:req.version,
  });
  if(!result.ok)return unavailable();
  const v=result.value;
  if(v.state!=="STAFF_CONFIRMATION_REQUIRED"||
     v.evidence.requestId!==requestId||v.evidence.requestVersion!==req.version||
     v.evidence.workspaceId!==snapshot.value.workspace.id||
     v.staffConfirmed!==false||v.customerContactSent!==false||
     !["CLARIFICATION_NEEDED","READY_FOR_REVIEW","SPECIALIST_REVIEW"].includes(v.classification)||
     !Array.isArray(v.questions)||v.questions.length>3)return unavailable();
  const allowed=new Set(["serviceCode","bedrooms","bathrooms"]);
  const questions:F15IntakeReview & {ok:true} = {ok:true,state:"SAVED_INTAKE_REVIEW_ONLY",
   classification:v.classification,sourceVersion:req.version,questions:[],
   staffConfirmationRequired:true,modelInvoked:false,customerContactSent:false,
   bookingChanged:false,pricingChanged:false};
  for(const q of v.questions){
   if(!allowed.has(q.field)||typeof q.text!=="string"||q.text.length>220||
      /[\r\n]/.test(q.text))return unavailable();
   questions.questions.push({field:q.field,text:q.text});
  }
  return questions;
 }catch{return unavailable();}
}
