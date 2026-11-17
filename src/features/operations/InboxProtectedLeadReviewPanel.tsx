import {loadOperationalStaffSnapshot} from "./operational-product-runtime";
import {OwnerUnansweredLeadReview} from "./OwnerUnansweredLeadReview";
import {OwnerLinkedAttentionReview} from "./OwnerLinkedAttentionReview";
/** Strict, explicit conversation selection. A bounded UI snapshot only selects
 * a candidate; it is never used to assert that no staff reply exists. */
export async function InboxProtectedLeadReviewPanel({
 workspaceSlug,selectedConversationId,
}:{workspaceSlug:string;selectedConversationId?:string}){
 if(typeof workspaceSlug!=="string"||workspaceSlug.length<3||
    workspaceSlug.length>40||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspaceSlug)||
    typeof selectedConversationId!=="string"||
    !/^[A-Za-z0-9:_-]{3,128}$/.test(selectedConversationId))return null;
 const s=await loadOperationalStaffSnapshot(workspaceSlug);
 if(!s.ok||s.value.workspace.slug!==workspaceSlug||
    s.value.actor.role!=="OWNER"||s.value.branchScope?.mode!=="ALL"||
    s.value.actor.workspaceId!==s.value.workspace.id)return null;
 const selected=s.value.conversations.find(c=>c.id===selectedConversationId);
 if(!selected||selected.workspaceId!==s.value.workspace.id||
    !selected.requestId)return null;
 const req=s.value.requests.find(q=>q.id===selected.requestId);
 const branches=new Set(s.value.branchScope.branches.map(x=>x.id));
 if(!req||!req.branchId||!branches.has(req.branchId)||
    !Number.isSafeInteger(req.version)||req.version<1)return null;
 return <div>
   <OwnerUnansweredLeadReview workspaceSlug={workspaceSlug}
     requestId={req.id} branchId={req.branchId}/>
   <OwnerLinkedAttentionReview workspaceSlug={workspaceSlug}
     requestId={req.id} branchId={req.branchId}/>
 </div>;
}
