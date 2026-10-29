import Link from "next/link";
import {loadOperationalStaffSnapshot} from "./operational-product-runtime";
import {AiConsentedInboxDraft} from "./AiConsentedInboxDraft";
import {buildStaffModuleHref} from "./staff-modules";
/** The owner-only ALL-branch F04 proof cannot run on an unverified selection.
 * Read limited saved conversations on the server, never leak customer
 * identifiers, message bodies, contacts, opt-out state or untrusted text. */
export async function InboxConsentedDraftPanel({workspaceSlug,selectedConversationId}:{
 workspaceSlug:string;selectedConversationId?:string;
}){
 if(typeof workspaceSlug!=="string"||
   !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspaceSlug))return null;
 const result=await loadOperationalStaffSnapshot(workspaceSlug);
 if(!result.ok || result.value.workspace.slug!==workspaceSlug||
    result.value.actor.role!=="OWNER"||
    result.value.branchScope?.mode!=="ALL"||
    result.value.retentionAvailable!==true)return null;
 const conversations=result.value.conversations.filter(c=>
   c.workspaceId===result.value.workspace.id&&
   (c.channel==="EMAIL"||c.channel==="WHATSAPP")&&
   Number.isSafeInteger(c.version)&&c.version>0).slice(0,20);
 if(!conversations.length)return null;
 const selected=conversations.find(c=>c.id===selectedConversationId)??conversations[0];
 const inboxHref=buildStaffModuleHref(workspaceSlug,"inbox");
 return <section className="app-panel" aria-label="Owner consent-checked reply workbench"
   data-testid="f18-inbox-owner-draft-workbench">
  <h2>Owner reply preparation</h2>
  <p>Review a supported saved email or WhatsApp conversation. This does not load recipient details into the browser or authorize delivery.</p>
  <nav aria-label="Saved conversation selection for owner reply draft">
    <ul>{conversations.map((c,i)=><li key={c.id}>
     {c.id===selected.id?<strong>Thread {i+1} · {c.channel} · selected</strong>:
     <Link href={inboxHref+"?conversation="+encodeURIComponent(c.id)}>
      Thread {i+1} · {c.channel}</Link>}
    </li>)}</ul>
  </nav>
  <AiConsentedInboxDraft workspaceSlug={workspaceSlug} conversationId={selected.id}/>
  <p>The first 20 authorized conversations are available for draft preparation. A missing verified recipient or revoked consent always blocks the draft.</p>
 </section>;
}
