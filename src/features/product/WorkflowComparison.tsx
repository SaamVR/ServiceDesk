"use client";
import {useState} from "react";
import Link from "next/link";
import styles from "./WorkflowComparison.module.css";
const stories=[
{id:"enquiry",label:"New customer enquiry",icon:"message-square",prompt:"A customer needs a three-bedroom move-out clean.",manual:["Check scattered messages","Copy details to a spreadsheet","Ask someone for an estimate","Follow up on a different channel"],assisted:["Capture structured request","Prepare editable AI intake brief","Apply reviewed pricing rules","Queue a draft reply for staff review"],gate:"The dispatcher approves the details, quote and any outbound message."},
{id:"scheduling",label:"Crew scheduling",icon:"calendar-check",prompt:"An accepted quote needs a realistic visit time.",manual:["Find the previous customer email","Call the crew for availability","Compare calendars by hand","Send an unverified confirmation"],assisted:["Review slot freshness","Check conflicts and holds","Propose eligible crew assignment","Wait for dispatcher confirmation"],gate:"No booking is confirmed until real capacity and provider state are verified."},
{id:"recovery",label:"Failed confirmation",icon:"mail",prompt:"An outbound job update has no delivery receipt.",manual:["Search the mailbox for a reply","Guess whether the customer read it","Resend without verifying the last send","Lose context during handover"],assisted:["Preserve QUEUED/FAILED state","Show owned recovery attention","Require operator reconciliation","Only retry after human authorization"],gate:"Provider acceptance, delivery and read are always distinct."},
] as const;
function Icon({name}:{name:string}){const url="url(/portfolio/icons/"+name+".svg)";return <span aria-hidden="true" className={styles.icon} style={{maskImage:url,WebkitMaskImage:url,maskSize:"contain",WebkitMaskSize:"contain",maskRepeat:"no-repeat",WebkitMaskRepeat:"no-repeat",maskPosition:"center",WebkitMaskPosition:"center"}}/>}
export function WorkflowComparison(){
 const [active,setActive]=useState(0);
 const [focus,setFocus]=useState(0);
 const story=stories[active];
 return <section className={styles.section} id="comparison" aria-labelledby="comparison-heading">
 <div className={styles.heading}><div><p className={styles.eyebrow}>02 / BUSINESS PROCESS DESIGN</p><h2 id="comparison-heading">From disconnected tasks<br/>to <em>one clear operation.</em></h2></div><p>Choose a business event and compare the work involved. These are illustrative steps, not measured efficiency results or proof of live provider integration.</p></div>
 <div className={styles.choices} role="group" aria-label="Choose a business process to compare">
  {stories.map((item,i)=><button type="button" key={item.id} data-active={i===active} aria-pressed={i===active} onClick={()=>{setActive(i);setFocus(0)}}><Icon name={item.icon}/>{item.label}<span aria-hidden="true">↗</span></button>)}
 </div>
 <div className={styles.statement}><span><Icon name={story.icon}/> CURRENT EXAMPLE</span><strong>{story.prompt}</strong></div>
 <div className={styles.comparison}>
  <article className={styles.manual}><div className={styles.columnHead}><span className={styles.manualIcon}><Icon name="inbox"/></span><div><p>WITHOUT A CONNECTED WORKSPACE</p><h3>Fragmented handoffs.</h3></div></div><ol key={story.id+"-manual"}>{story.manual.map((item,i)=><li key={item} data-active={i===focus}><button type="button" aria-current={i===focus?"step":undefined} onClick={()=>setFocus(i)}><span>{String(i+1).padStart(2,"0")}</span><strong>{item}</strong><span aria-hidden="true">↗</span></button></li>)}</ol><div className={styles.columnNote}>Illustrative manual process. No fabricated time or ROI figures.</div></article>
  <div className={styles.bridge}><span><Icon name="workflow"/></span><p>DESIGNED<br/>HANDOFF</p><i aria-hidden="true">→</i></div>
  <article className={styles.assisted}><div className={styles.columnHead}><span className={styles.assistedIcon}><Icon name="brain-circuit"/></span><div><p>WITH SERVICEDESK SUPPORT</p><h3>Visible, reviewed work.</h3></div></div><ol key={story.id+"-assisted"}>{story.assisted.map((item,i)=><li key={item} data-active={i===focus}><button type="button" aria-current={i===focus?"step":undefined} onClick={()=>setFocus(i)}><span>{String(i+1).padStart(2,"0")}</span><strong>{item}</strong><span className={styles.check} aria-hidden="true">{i<=focus?"✓":"○"}</span></button></li>)}</ol><div className={styles.columnNote}><Icon name="shield-check"/> {story.gate}</div></article>
 </div>
 <div className={styles.footer}><p><strong>Focus step {focus+1} of 4.</strong> Click any handoff to compare what changes in the process. All events remain demonstrations.</p><Link href="/demo">Explore the actual guided dashboard <span aria-hidden="true">↗</span></Link></div>
 </section>;
}
