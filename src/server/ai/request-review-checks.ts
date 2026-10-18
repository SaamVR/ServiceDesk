/** The server has already loaded authorized persisted source facts before
 * calling this deterministic, non-generative missing-information assistant.
 * No email, booking, quote or provider action is performed. */
export interface SavedRequestCheckFacts {
  serviceCode:string;
  bedrooms:number|null;
  bathrooms:number|null;
  status:string;
}
export interface SavedRequestReviewCheck {
  field:"serviceCode"|"bedrooms"|"bathrooms";
  question:string;
  state:"STAFF_CONFIRMATION_REQUIRED";
  customerContactSent:false;
}
const code=/^[A-Za-z0-9_-]{1,64}$/;
export function planSavedRequestReviewChecks(
  facts:SavedRequestCheckFacts,
):SavedRequestReviewCheck[]|null {
  if(!facts || typeof facts!=="object" || Array.isArray(facts) ||
     Object.getPrototypeOf(facts)!==Object.prototype ||
     Reflect.ownKeys(facts).length!==4 ||
     !["serviceCode","bedrooms","bathrooms","status"].every(key=>Object.hasOwn(facts,key)) ||
     Object.values(Object.getOwnPropertyDescriptors(facts)).some(d=>!Object.hasOwn(d,"value")) ||
     typeof facts.serviceCode!=="string" ||
     (facts.serviceCode!=="not recorded" && !code.test(facts.serviceCode)) ||
     typeof facts.status!=="string" || !code.test(facts.status) ||
     [facts.bedrooms,facts.bathrooms].some(value=>
       value!==null && !(typeof value==="number" &&
          Number.isSafeInteger(value) && value>=0 && value<=50))) return null;
  const result:SavedRequestReviewCheck[]=[];
  const add=(field:SavedRequestReviewCheck["field"],question:string)=>{
    result.push({field,question,state:"STAFF_CONFIRMATION_REQUIRED",customerContactSent:false});
  };
  if(facts.serviceCode==="not recorded")add("serviceCode",
    "Which saved service category should apply to this request?");
  if(facts.bedrooms===null)add("bedrooms",
    "How many bedrooms should the service include?");
  if(facts.bathrooms===null)add("bathrooms",
    "How many bathrooms should the service include?");
  return result;
}
