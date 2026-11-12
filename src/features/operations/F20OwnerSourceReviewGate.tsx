import {loadOperationalStaffSnapshot} from "./operational-product-runtime";
import {OwnerLedgerExceptionReview} from "./OwnerLedgerExceptionReview";
import {OwnerConsentedRetentionReview} from "./OwnerConsentedRetentionReview";
/** Owners can discover source-only F03/F04 assistants on authoritative pages.
 * Non-owners never render controls; server actions independently authorize
 * on every click and re-read authoritative records before returning evidence. */
export async function F20OwnerSourceReviewGate({workspaceSlug,surface}:{
 workspaceSlug:string;surface:"invoices"|"customers";
}){
 if(typeof workspaceSlug!=="string"||workspaceSlug.length<3||
    workspaceSlug.length>40||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspaceSlug))
   return null;
 const s=await loadOperationalStaffSnapshot(workspaceSlug);
 if(!s.ok||s.value.workspace.slug!==workspaceSlug||
    s.value.actor.workspaceId!==s.value.workspace.id||
    !s.value.actor.userId||s.value.actor.role!=="OWNER"||
    s.value.branchScope?.mode!=="ALL")return null;
 return surface==="invoices"
  ? <OwnerLedgerExceptionReview workspaceSlug={workspaceSlug}/>
  :<OwnerConsentedRetentionReview workspaceSlug={workspaceSlug}/>;
}
