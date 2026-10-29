import type {OperationalQuote,OperationalRequest} from "./operational-product-runtime";
import {guideSavedQuoteRecovery,type QuoteRecoveryGuidance} from "./f17-quote-recovery-guide";
import {buildStaffModuleHref} from "./staff-modules";
export type F19QuoteRecoveryTarget={
 state:"SAVED_QUOTE_SOURCE_RECOVERY";guidance:QuoteRecoveryGuidance;
 sourceRequestHref:string;currentQuoteHref?:string;pricingHref:string;
 currentVersionVerified:boolean;automaticRenewal:false;automaticSend:false;
};
const validId=(x:unknown):x is string=>typeof x==="string"&&
 /^[A-Za-z0-9:_-]{3,128}$/.test(x);
const safeSlug=(x:unknown):x is string=>typeof x==="string"&&x.length<=40&&
 /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x);
/** Reconciles a selected saved quote to a unique newest version and its
 * authorized source request. No guessed renewal, quote issue or auto-send.
 * The caller supplies only role/branch-scoped records from a fresh server read. */
export function resolveF19QuoteRecoveryTarget(input:{
 slug:string;selectedId:string;quotes:readonly OperationalQuote[];
 requests:readonly OperationalRequest[];loadedAt:string;
}):F19QuoteRecoveryTarget|null{
 const {slug,selectedId,quotes,requests,loadedAt}=input;
 if(!safeSlug(slug)||!validId(selectedId)||!Array.isArray(quotes)||
    quotes.length===0||quotes.length>=300||!Array.isArray(requests)||
    requests.length>=300||new Set(quotes.map(q=>q.id)).size!==quotes.length||
    new Set(requests.map(q=>q.id)).size!==requests.length)return null;
 const selected=quotes.find(q=>q.id===selectedId);
 if(!selected||!validId(selected.requestId))return null;
 const req=requests.find(x=>x.id===selected.requestId);
 if(!req||!Number.isSafeInteger(req.version)||req.version<1)return null;
 const guidance=guideSavedQuoteRecovery(quotes,selectedId,loadedAt);
 const versions=quotes.filter(q=>q.requestId===selected.requestId);
 if(!versions.length||versions.some(q=>!validId(q.id)||!Number.isSafeInteger(q.version)||
   q.version<1))return null;
 const max=Math.max(...versions.map(q=>q.version));
 const highest=versions.filter(q=>q.version===max);
 const unique=highest.length===1;
 const originalQuoteHref=buildStaffModuleHref(slug,"quotes");
 const sourceRequestHref=buildStaffModuleHref(slug,"requests")+"?request="+encodeURIComponent(req.id);
 const pricingHref=buildStaffModuleHref(slug,"settings")+"#owner-first-run-pricing";
 return {state:"SAVED_QUOTE_SOURCE_RECOVERY",guidance,
    sourceRequestHref,pricingHref,
    currentQuoteHref:unique?originalQuoteHref+"?quote="+encodeURIComponent(highest[0].id):undefined,
    currentVersionVerified:unique,automaticRenewal:false,automaticSend:false};
}
