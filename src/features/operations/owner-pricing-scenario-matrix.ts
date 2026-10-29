import type { QuoteServiceCode } from "@/domain/quote";
import {evaluateOwnerPricingWorksheet} from "./owner-cleaning-pricing-worksheet";

const layouts=[
 {id:"compact",name:"Compact",bedrooms:0,bathrooms:1},
 {id:"family",name:"Family",bedrooms:2,bathrooms:2},
 {id:"larger",name:"Larger",bedrooms:4,bathrooms:3},
] as const;
const services:readonly QuoteServiceCode[]=["STANDARD","DEEP","MOVE_OUT"];

export type OwnerPricingScenarioMatrix =
 | {state:"INCOMPLETE";detail:string}
 | {state:"READY";source:"CURRENT_UNSAVED_OWNER_FORM";rows:Array<{
   key:string;label:string;service:QuoteServiceCode;bedrooms:number;bathrooms:number;oven:boolean;
   subtotalMinor:number;depositMinor:number;balanceMinor:number;durationMinutes:number;
   approval:"BELOW_OWNER_THRESHOLD"|"REVIEW_THRESHOLD";
 }> ;customerQuoteCreated:false;pricesSaved:false};

/** Nine grounded previews from one complete owner-entered form.
 * Never silently supply fictitious dollar rates or persist a scenario. */
export function evaluateOwnerPricingScenarioMatrix(
 form:FormData,ovenForMoveOut:boolean,
):OwnerPricingScenarioMatrix{
 if(!(form instanceof FormData)||typeof ovenForMoveOut!=="boolean")
  return {state:"INCOMPLETE",detail:"A complete owner rate form and valid optional add-on are required."};
 const rows:Extract<OwnerPricingScenarioMatrix,{state:"READY"}>["rows"]=[];
 for(const service of services)for(const layout of layouts){
  const oven=service==="MOVE_OUT"&&ovenForMoveOut;
  const calculated=evaluateOwnerPricingWorksheet(form,{
   service,bedrooms:layout.bedrooms,bathrooms:layout.bathrooms,oven,
  });
  if(calculated.state!=="READY")
   return {state:"INCOMPLETE",detail:"Enter every actual business rate, duration and policy before comparing pricing. No sample dollar values are supplied."};
  rows.push({key:service+"-"+layout.id,label:service.replace("_"," ")+" · "+layout.name,
   service,bedrooms:layout.bedrooms,bathrooms:layout.bathrooms,oven,
   subtotalMinor:calculated.value.subtotalMinor,depositMinor:calculated.value.depositMinor,
   balanceMinor:calculated.value.balanceMinor,durationMinutes:calculated.value.durationMinutes,
   approval:calculated.value.approval});
 }
 return {state:"READY",source:"CURRENT_UNSAVED_OWNER_FORM",rows,
  customerQuoteCreated:false,pricesSaved:false};
}
