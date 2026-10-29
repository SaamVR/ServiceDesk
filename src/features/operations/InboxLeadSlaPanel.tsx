import Link from "next/link";
import {loadOperationalStaffSnapshot} from "./operational-product-runtime";
import {AiUnansweredLeadSlaReview} from "./AiUnansweredLeadSlaReview";
import {buildStaffModuleHref} from "./staff-modules";

/** Explicit saved conversation picker. Only server-authorized OWNER + ALL
 * may select a request-linked conversation; no customer data crosses UI. */
export async function InboxLeadSlaPanel({workspaceSlug,selectedConversationId}:{
 workspaceSlug:string;selectedConversationId?:string;
}){
 if(typeof workspaceSlug!=="string"||workspaceSlug.length<3||workspaceSlug.length>40||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspaceSlug))return null;
 const result=await loadOperationalStaffSnapshot(workspaceSlug);
 if(!result.ok||result.value.workspace.slug!==workspaceSlug||
    result.value.actor.role!=="OWNER"||!result.value.actor.userId||
    result.value.actor.workspaceId!==result.value.workspace.id||
    result.value.branchScope?.mode!=="ALL")return null;
 const conversations=result.value.conversations.filter(c=>
   c.workspaceId===result.value.workspace.id&&
   typeof c.requestId==="string"&&
   /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(c.requestId)&&
   ["WEB","EMAIL","WHATSAPP"].includes(c.channel)&&
   Number.isSafeInteger(c.version)&&c.version>0).slice(0,20);
 if(!conversations.length)return null;
 const selected=conversations.find(c=>c.id===selectedConversationId)??conversations[0];
 const href=buildStaffModuleHref(workspaceSlug,"inbox");
 return <section className="app-panel" aria-label="Owner saved lead follow-up review"
   data-testid="f15-inbox-owner-sla-panel">
  <h2>Unanswered lead follow-up</h2>
  <p>Select a saved request-linked conversation. The on-demand check reads the database twice; a limited Inbox preview is never treated as proof of a missing response.</p>
  <nav aria-label="Request-linked conversations">
   <ul>{conversations.map((c,i)=><li key={c.id}>
    {c.id===selected.id?<strong>Request thread {i+1} · {c.channel} · selected</strong>:
     <Link href={href+"?conversation="+encodeURIComponent(c.id)}>
      Request thread {i+1} · {c.channel}</Link>}
   </li>)}</ul>
  </nav>
  <AiUnansweredLeadSlaReview workspaceSlug={workspaceSlug} conversationId={selected.id}/>
  <p>Only the first 20 authorized saved request-linked threads appear here. No external follow-up is sent by this review.</p>
 </section>;
}
