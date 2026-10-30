import type {OperationalRequest,OperationalQuote} from "./operational-product-runtime";
export interface FirstQuoteGate{
 request?:Pick<OperationalRequest,"id"|"branchId"|"status">;
 quotes?:readonly Pick<OperationalQuote,"requestId">[];
 ownerPricingBookProof?:{state:"VERIFIED"|"UNAVAILABLE";activeBranchIds:string[]};
 serviceRole:boolean;
}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
/** UX-only preflight. Real source/price/duplicate checks happen on every
 * server action; a truncated staff snapshot is never negative DB proof. */
export function canOfferFirstInboxQuote(input:FirstQuoteGate):boolean{
 const {request,quotes,ownerPricingBookProof:price}=input;
 return input.serviceRole===true&&
   !!request&&uuid.test(request.id)&&typeof request.branchId==="string"&&
   uuid.test(request.branchId)&&["READY","NEEDS_REVIEW"].includes(request.status)&&
   price?.state==="VERIFIED"&&Array.isArray(price.activeBranchIds)&&
   price.activeBranchIds.includes(request.branchId)&&
   Array.isArray(quotes)&&!quotes.some(q=>q.requestId===request.id);
}
