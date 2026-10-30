import Link from "next/link";
import {loadOperationalStaffSnapshot} from "./operational-product-runtime";
import {operationalDatabaseMode} from "@/features/auth/operational-preview-mode";
import {canProcessSavedInboxRequestRules} from "./inbox-request-rule-gate";
import {AiInboxRequestRules} from "./AiInboxRequestRules";
import {buildStaffModuleHref} from "./staff-modules";

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

/**
 * IR21+ additive Inbox operator action. Deliberately does not replace or
 * modify the existing F15 protected SLA panel or its source provenance.
 * Browser selection is a conversation ID, NEVER a trusted request ID.
 */
export async function InboxRequestRulesPanel({workspaceSlug,selectedConversationId}:{
 workspaceSlug:string;selectedConversationId?:string;
}){
 if(typeof workspaceSlug!=="string"||workspaceSlug.length<3||
    workspaceSlug.length>40||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspaceSlug)||
    !uuid.test(selectedConversationId??""))return null;
 const s=await loadOperationalStaffSnapshot(workspaceSlug);
 if(!s.ok||s.value.workspace.slug!==workspaceSlug||
    s.value.actor.role!=="OWNER"||!s.value.actor.userId||
    s.value.actor.workspaceId!==s.value.workspace.id||
    s.value.branchScope?.mode!=="ALL")return null;
 const conversation=s.value.conversations.find(c=>
    c.id===selectedConversationId&&c.workspaceId===s.value.workspace.id&&
    uuid.test(c.id)&&uuid.test(c.requestId??"")&&
    Number.isSafeInteger(c.version)&&c.version>0);
 if(!conversation)return null;
 const request=s.value.requests.find(r=>
    r.id===conversation.requestId&&!!r.branchId&&
    s.value.branchScope?.branches.some(b=>b.id===r.branchId));
 if(!request)return null;
 const eligible=canProcessSavedInboxRequestRules({
  request,mode:operationalDatabaseMode(),
  workflowAvailable:s.value.workflowAvailable,
  rules:s.value.workflowRules,versions:s.value.workflowRuleVersions,
 });
 return <section className="app-panel" aria-label="Owner saved Inbox request workflow"
   data-testid="ir21-owner-inbox-request-rules">
  <h2>Request workflow · internal attention</h2>
  <p>This separate action processes published REQUEST_CREATED rules for the
   selected saved request. It is not the F15 overdue-lead SLA claim.</p>
  {eligible?
   <AiInboxRequestRules workspaceSlug={workspaceSlug}
    conversationId={conversation.id}/>:
   <p>There is no active published REQUEST_CREATED rule for this request branch,
    or the trusted backend is not available.{" "}
    <Link href={buildStaffModuleHref(workspaceSlug,"automations")}>
     Review automation rules</Link>. The protected F15 review above is unaffected.</p>}
 </section>;
}
