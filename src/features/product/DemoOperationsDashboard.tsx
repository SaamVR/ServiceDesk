"use client";
import {useReducer,useState,type CSSProperties} from "react";
import Link from "next/link";
import {createSandboxState,sandboxReducer,sandboxQuote,sandboxStages,sandboxOutstandingMinor,sandboxAllocatedMinor,type SandboxAction} from "@/features/sandbox/sandbox-engine";
import {automationPlaybooks,automationPlaybookCategories} from "@/features/operations/automation-playbooks";
import {dashboardModules,dashboardGuide,dashboardNextAction,dashboardProgress,dashboardStatus,dashboardScreenFor,type DashboardModule} from "./demo-dashboard-model";
import styles from "./DemoOperationsDashboard.module.css";
import {aiReviewScenarios,aiScenarioFor,aiCanApprove,aiDecisionLabel,type AiReviewDecision,type AiReviewScenarioId} from "./ai-review-model";

const usd=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0});
const money=(minor:number)=>usd.format(minor/100);
function Icon({name}:{name:string}){
 const url="url(/portfolio/icons/"+name+".svg)";
 return <span aria-hidden="true" className={styles.icon} style={{maskImage:url,WebkitMaskImage:url,maskPosition:"center",WebkitMaskPosition:"center",maskSize:"contain",WebkitMaskSize:"contain",maskRepeat:"no-repeat",WebkitMaskRepeat:"no-repeat"} as CSSProperties}/>;
}


export function DemoOperationsDashboard(){
 const [state,dispatch]=useReducer(sandboxReducer,undefined,createSandboxState);
 const [module,setModule]=useState<DashboardModule>("overview");
 const [guide,setGuide]=useState(true);
 const [guideIndex,setGuideIndex]=useState(0);
 const [aiScenarioId,setAiScenarioId]=useState<AiReviewScenarioId>("move-out");
 const [reply,setReply]=useState(aiReviewScenarios[0].draft);
 const [review,setReview]=useState<AiReviewDecision>("pending");
 const [category,setCategory]=useState("All");
 const [filter,setFilter]=useState("");
 const [ruleId,setRuleId]=useState("new-enquiry");
 const [checks,setChecks]=useState([false,false,false]);
 const next=dashboardNextAction(state);
 const progress=dashboardProgress(state);
 const status=dashboardStatus(state);
 const rules=automationPlaybooks.filter(r=>(category==="All"||r.category===category)&&(r.name+" "+r.description+" "+r.eventType).toLowerCase().includes(filter.trim().toLowerCase().slice(0,80)));
 const selectedRule=rules.find(r=>r.id===ruleId)??rules[0];
 const currentGuide=dashboardGuide[guideIndex];
 const sampleStage=sandboxStages.find(s=>s.id===state.stage)??sandboxStages[0];
 const aiScenario=aiScenarioFor(aiScenarioId);
 function chooseAiScenario(id:AiReviewScenarioId){
  const selected=aiScenarioFor(id);
  setAiScenarioId(id);setReply(selected.draft);setReview("pending");
 }
 function navigate(to: DashboardModule) {
   setModule(to);
   if (guide) {
     const index = dashboardGuide.findIndex(item=>item.module===to);
     if(index>=0) setGuideIndex(index);
   }
 }


 function act(action:SandboxAction){
   dispatch(action);
   if(action==="RESET"){navigate("overview");chooseAiScenario("move-out");setChecks([false,false,false]);return;}
   if(action==="CREATE_QUOTE"||action==="ACCEPT_QUOTE")navigate("requests");
   else if(action==="HOLD_SLOT"||action==="ASSIGN_CREW")navigate("schedule");
   else if(action==="PAY_DEPOSIT"||action==="PAY_BALANCE")navigate("finance");
   else if(action==="START_JOB"||action==="COMPLETE_JOB")navigate("crew");
   else navigate("inbox");
 }
 function stepGuide(index:number){
   const value=Math.max(0,Math.min(index,dashboardGuide.length-1));
   setGuideIndex(value);navigate(dashboardGuide[value].module);
 }
 const moneyTile=[
   {label:"Calculated quote",value:money(sandboxQuote.totalMinor),desc:"Actual domain pricing",icon:"file-text"},
   {label:"Sample allocated",value:money(sandboxAllocatedMinor(state)),desc:"Never charged",icon:"badge-check"},
   {label:"Sample outstanding",value:money(sandboxOutstandingMinor(state)),desc:"Local ledger state",icon:"receipt"},
   {label:"Job progress",value:progress.completed+"/"+progress.total,desc:status.stage,icon:"workflow"},
 ];

 return <main className={styles.app} id="demo-main">
 <aside className={styles.sidebar}>
   <Link href="/" className={styles.brand}><span className={styles.brandIcon}><Icon name="workflow"/></span><span><strong>ServiceDesk <em>AI</em></strong><small>OPERATIONS OS</small></span></Link>
   <div className={styles.workspace}><span>B</span><p><strong>BrightRoom Cleaning</strong><small>FICTIONAL WORKSPACE</small></p></div>
   <div className={styles.sideTitle}>WORKSPACE</div>
   <nav aria-label="Dashboard modules" className={styles.nav}>
    {dashboardModules.map(item=><button key={item.id} type="button" data-active={module===item.id} data-guided={guide&&currentGuide.module===item.id} aria-current={module===item.id?"page":undefined} onClick={()=>navigate(item.id)}><Icon name={item.icon}/>{item.label}{guide&&currentGuide.module===item.id?<span className={styles.guideDot}/>:null}</button>)}
   </nav>
   <div className={styles.sideFoot}><p><Icon name="shield-check"/><span><strong>Portfolio mode</strong><small>No real customer data</small></span></p><Link href="/">← Return to portfolio</Link></div>
 </aside>
 <div className={styles.area}>
  <header className={styles.topbar}>
   <p>BrightRoom <span>/</span> <strong>{dashboardScreenFor(module).label}</strong></p>
   <div><span className={styles.synth}><i/> SAMPLE ONLY</span><button type="button" onClick={()=>{setGuide(true);stepGuide(0)}}>Guided tour</button><button type="button" onClick={()=>act("RESET")}>↺ Reset</button><span className={styles.avatar}>BR</span></div>
  </header>
  <nav className={styles.mobileNav} aria-label="Dashboard module shortcuts">{dashboardModules.map(item=><button type="button" key={item.id} data-active={module===item.id} onClick={()=>navigate(item.id)}>{item.label}</button>)}</nav>
  {guide?<section className={styles.guide} aria-label="Dashboard guided tour">
    <span className={styles.guideIcon}><Icon name="sparkles"/></span>
    <div><p className={styles.eyebrow}>INTERACTIVE WALKTHROUGH · {guideIndex+1}/{dashboardGuide.length} · SYNTHETIC</p><h2>{currentGuide.title}</h2><p className={styles.guideExplanation}>{currentGuide.explanation}</p><p className={styles.guideInstruction}><strong>{currentGuide.instruction}</strong></p><details className={styles.guideMobileDetails}><summary>Why this matters</summary><p>{currentGuide.explanation}</p></details><div className={styles.guideProgress}><span style={{width:Math.round((guideIndex+1)/dashboardGuide.length*100)+"%"}}/></div></div>
    <div className={styles.guideActions}><button type="button" disabled={guideIndex===0} onClick={()=>stepGuide(guideIndex-1)}>← Back</button>{guideIndex===dashboardGuide.length-1?<button type="button" className={styles.primary} onClick={()=>setGuide(false)}>Finish ✓</button>:<button type="button" className={styles.primary} onClick={()=>stepGuide(guideIndex+1)}>Next guide step →</button>}<button type="button" onClick={()=>setGuide(false)}>Skip</button></div>
   </section>:<div className={styles.guideClosed}>Sample-only workspace. <button type="button" onClick={()=>{setGuide(true);stepGuide(0)}}>Restart guided walkthrough →</button></div>}
  <section className={styles.main} aria-labelledby="demo-title">
   <div className={styles.heading}><div><p className={styles.eyebrow}>BRIGHTROOM / {module.toUpperCase()} / SAMPLE WORKSPACE</p><h1 id="demo-title">{dashboardScreenFor(module).label}</h1><p>{dashboardScreenFor(module).short}. No real account, AI provider or payment is connected.</p></div><span className={styles.headingBadge}><Icon name="shield-check"/> SAFE DEMO WORKSPACE</span></div>
   <div className={styles.metrics}>{moneyTile.map(tile=><article key={tile.label}><span>{tile.label}</span><strong>{tile.value}</strong><small>{tile.desc}</small><Icon name={tile.icon}/></article>)}</div>
   <section className={styles.mission} aria-labelledby="demo-mission-title">
     <div className={styles.missionIcon}><Icon name={next?"workflow":"badge-check"}/></div>
     <div className={styles.missionCopy}>
       <p className={styles.eyebrow}>OPERATOR MISSION · {progress.completed+1} / {progress.total+1} · SAMPLE</p>
       <h2 id="demo-mission-title">{next?"Make the next handoff visible":"Sample lifecycle complete"}</h2>
       <p aria-live="polite">{next?.detail??"All sandbox business steps have been recorded locally. Explore the audit trail or reset."}</p>
       <div className={styles.missionProgress} role="progressbar" aria-label="Sample job lifecycle completion" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.completed}>
         <span style={{width:progress.percent+"%"}}/>
       </div>
     </div>
     <div className={styles.missionActions}>
       {next?<>
         <button type="button" onClick={()=>navigate(next.module)}>Inspect {dashboardScreenFor(next.module).label} →</button>
         <button type="button" className={styles.primary} onClick={()=>act(next.action)}>Simulate {next.label} ✓</button>
       </>:<>
         <button type="button" onClick={()=>navigate("activity")}>Review audit trail →</button>
         <button type="button" className={styles.primary} onClick={()=>act("RESET")}>Restart scenario ↺</button>
       </>}
     </div>
   </section>

   <div className={styles.surface}>
    {module==="overview"?<>
     <div className={styles.sectionTop}><div><p className={styles.eyebrow}>SAMPLE ACTIVITY</p><h2>One request. A connected operation.</h2><p>Advance the fictional cleaning request through its actual deterministic sandbox lifecycle.</p></div><span className={styles.chip}>{status.stage}</span></div>
     <div className={styles.overview}>
      <ol className={styles.timeline}>{sandboxStages.map((s,i)=><li key={s.id} data-current={progress.completed===i} data-passed={i<progress.completed}><span>{i<progress.completed?"✓":String(i+1).padStart(2,"0")}</span><div><strong>{s.label}</strong><p>{s.description}</p></div></li>)}</ol>
      <div className={styles.sideCards}><article><Icon name="inbox"/><h3>Customer enquiry</h3><p>Alex Morgan · move-out cleaning · 3 bedrooms · 2 bathrooms · oven add-on.</p><button type="button" onClick={()=>navigate("inbox")}>Inspect conversation →</button></article><article><Icon name="workflow"/><h3>Next controlled handoff</h3><p>{next?.detail??"All sample business transitions are complete."}</p><button type="button" onClick={()=>navigate(next?.module??"activity")}>View responsible team →</button></article><article className={styles.nightCard}><Icon name="brain-circuit"/><h3>AI as a drafting partner</h3><p>Review a proposal, edit it, approve or reject it. No live model connection.</p><button type="button" onClick={()=>navigate("ai")}>Open AI co-pilot →</button></article></div>
     </div>
    </>:null}
    {module==="inbox"?<>
     <div className={styles.sectionTop}><div><p className={styles.eyebrow}>CUSTOMER COMMUNICATION</p><h2>Every message has context.</h2><p>Fictional enquiry and locally simulated delivery recovery.</p></div><span className={styles.chip}>1 sample conversation</span></div>
     <div className={styles.chat}><aside><h3>Shared inbox</h3><p>ALL THREADS · SAMPLE</p><div className={styles.thread}><span className={styles.customer}>AM</span><span><strong>Alex Morgan</strong><small>Move-out clean · Enquiry</small></span></div></aside><div><header><span className={styles.customer}>AM</span><span><strong>Alex Morgan</strong><small>WEBSITE / FICTIONAL</small></span></header><div className={styles.bubble}>Hi, I need a move-out clean with the oven included. Can someone send me a quote?<small>EXAMPLE MESSAGE · NOT RECEIVED LIVE</small></div><div className={styles.assistantBubble}><Icon name="brain-circuit"/><p><strong>Draft intake</strong><span>Move-out · 3 bedrooms · 2 bathrooms · oven. Missing: confirmed date and address.</span></p></div><div className={styles.inlineActions}><button type="button" onClick={()=>navigate("ai")}>Review AI draft →</button><button type="button" onClick={()=>navigate("requests")}>View quote ↗</button></div></div></div>
     <div className={styles.recovery}><div><h3>Mock communication recovery</h3><p>{status.delivery}. Acceptance is not delivery.</p></div><div className={styles.inlineActions}>{state.delivery==="UNSENT"?<button type="button" disabled={progress.completed<4} onClick={()=>act("QUEUE_CONFIRMATION")}>Queue local confirmation</button>:state.delivery==="QUEUED"?<><button type="button" onClick={()=>act("FAIL_DELIVERY")}>Inject failure</button><button type="button" onClick={()=>act("ACKNOWLEDGE_DELIVERY")}>Mock acceptance</button></>:state.delivery==="FAILED"?<button type="button" onClick={()=>act("RETRY_DELIVERY")}>Retry locally</button>:<span>Mock transport accepted; no customer delivery receipt.</span>}</div></div>
    </>:null}
    {module==="requests"?<>
     <div className={styles.sectionTop}><div><p className={styles.eyebrow}>QUOTES / SOURCE PRICING</p><h2>Every quote has a reason.</h2><p>Actual deterministic calculation, with a fictional request and human approval points.</p></div><span className={styles.chip}>{sampleStage.label}</span></div>
     <div className={styles.split}><article className={styles.detail}><h3>Request #DEMO-001</h3><dl><dt>Customer</dt><dd>Alex Morgan (fictional)</dd><dt>Service</dt><dd>Move-out clean</dd><dt>Property</dt><dd>3 bedrooms / 2 bathrooms</dd><dt>Add-on</dt><dd>Oven cleaning</dd><dt>Version</dt><dd>Illustrative v1</dd></dl><button type="button" onClick={()=>navigate("ai")}>See bounded AI review ↗</button></article><article className={styles.detail}><span className={styles.eyebrow}>CALCULATED QUOTE</span><div className={styles.bigMoney}>{money(sandboxQuote.totalMinor)}</div><p>Deposit {money(sandboxQuote.depositMinor)} · Balance {money(sandboxQuote.balanceMinor)}</p><p className={styles.ruleBoundary}><Icon name="shield-check"/> AI does not create prices or accept a quote on a customer’s behalf.</p>{next&&["CREATE_QUOTE","ACCEPT_QUOTE"].includes(next.action)?<button type="button" className={styles.primary} onClick={()=>act(next.action)}>{next.label} →</button>:<p>Waiting for the next eligible business stage.</p>}</article></div>
    </>:null}
    {module==="schedule"?<>
     <div className={styles.sectionTop}><div><p className={styles.eyebrow}>DISPATCH / CAPACITY</p><h2>Schedule without guessing.</h2><p>Demonstration week: no Google Calendar or crew schedule is contacted.</p></div><span className={styles.chip}>{status.stage}</span></div>
     <div className={styles.calendar}>{["Mon","Tue","Wed","Thu","Fri"].map((day,i)=><article key={day}><strong>{day}</strong><small>EXAMPLE DAY {i+1}</small><span data-selected={i===2}>{i===2?"Crew Alpha · illustration":"No selected sample slot"}</span></article>)}</div><div className={styles.recovery}><div><h3>Approval and availability</h3><p>Capacity freshness, slot holds, simulated deposits and dispatcher assignment stay distinct.</p></div>{next&&["HOLD_SLOT","PAY_DEPOSIT","ASSIGN_CREW"].includes(next.action)?<button type="button" className={styles.primary} onClick={()=>act(next.action)}>{next.label} →</button>:<p>{status.stage}</p>}</div>
    </>:null}
    {module==="crew"?<>
     <div className={styles.sectionTop}><div><p className={styles.eyebrow}>FIELD OPERATIONS</p><h2>Checklists with ownership.</h2><p>Ticking a sample checklist does not create operational evidence or complete the job.</p></div><span className={styles.chip}>{status.stage}</span></div>
     <div className={styles.split}><article className={styles.detail}><h3>Sample crew checklist</h3><div className={styles.checklist}>{["Kitchen and oven","Bedrooms and bathrooms","Quality supervisor review"].map((item,i)=><label key={item}><input type="checkbox" checked={checks[i]} onChange={e=>setChecks(x=>x.map((v,j)=>j===i?e.target.checked:v))}/>{item}</label>)}</div></article><article className={styles.detail}><h3>Sample visit progression</h3><p>{status.stage}. Only the permitted next sandbox action can advance the visit.</p>{next&&["ASSIGN_CREW","START_JOB","COMPLETE_JOB"].includes(next.action)?<button type="button" className={styles.primary} onClick={()=>act(next.action)}>{next.label} →</button>:<p>Relevant crew action is locked until the preceding business state.</p>}</article></div>
    </>:null}
    {module==="finance"?<>
     <div className={styles.sectionTop}><div><p className={styles.eyebrow}>FINANCE / TRANSACTION EXAMPLE</p><h2>Reconcile without inventing money.</h2><p>Existing sandbox pricing and local ledger allocations—no Stripe checkout.</p></div><span className={styles.chip}>Sample invoice</span></div>
     <div className={styles.invoice}><div><p className={styles.eyebrow}>BRIGHTROOM CLEANING / SAMPLE</p><h3>Invoice #DEMO-001</h3><p>Alex Morgan · Fictional customer</p></div><dl><dt>Move-out cleaning including oven</dt><dd>{money(sandboxQuote.subtotalMinor)}</dd><dt>Illustrative tax</dt><dd>{money(sandboxQuote.taxMinor)}</dd><dt className={styles.invoiceTotal}>Quote total</dt><dd className={styles.invoiceTotal}>{money(sandboxQuote.totalMinor)}</dd><dt>Simulated deposit</dt><dd>− {money(state.depositAllocatedMinor)}</dd><dt>Simulated balance</dt><dd>− {money(state.balanceAllocatedMinor)}</dd><dt className={styles.invoiceDue}>Remaining sample balance</dt><dd className={styles.invoiceDue}>{money(sandboxOutstandingMinor(state))}</dd></dl>{next&&["PAY_DEPOSIT","PAY_BALANCE"].includes(next.action)?<button type="button" className={styles.primary} onClick={()=>act(next.action)}>Simulate {next.label} →</button>:<p>Complete previous stages to unlock eligible sample finance actions.</p>}</div>
    </>:null}
    {module==="ai"?<>
     <div className={styles.sectionTop}><div><p className={styles.eyebrow}>AI DECISION STUDIO / SCRIPTED EXAMPLES</p><h2>Show the evidence. Keep a human in charge.</h2><p>Change the customer situation, inspect the extracted facts, edit the reply and decide whether to approve, reject or escalate. This is a prewritten simulation, not an LLM connection.</p></div><span className={styles.chip}>NO MODEL / NO SEND</span></div>
     <div className={styles.aiScenarioPicker} role="group" aria-label="Choose a fictional AI-assisted business situation">
       {aiReviewScenarios.map(item=><button type="button" key={item.id} data-active={aiScenarioId===item.id} aria-pressed={aiScenarioId===item.id} onClick={()=>chooseAiScenario(item.id)}>
         <span>{item.requiresEscalation?"03 / SAFETY":"SCENARIO / SAMPLE"}</span>
         <strong>{item.label}</strong><small>{item.short}</small>
       </button>)}
     </div>
     <div className={styles.aiFlow} aria-label="AI review is a three-step process"><span><b>01</b> Customer enquiry</span><i aria-hidden="true">→</i><span><b>02</b> Scripted evidence</span><i aria-hidden="true">→</i><span><b>03</b> Human decision</span></div>
     <div key={aiScenario.id} className={styles.aiSplit}>
       <article className={styles.aiSource}>
         <div className={styles.aiPanelTitle}><Icon name="inbox"/><span>FICTIONAL CUSTOMER INPUT</span><small>NOT RECEIVED LIVE</small></div>
         <blockquote>{aiScenario.customerMessage}</blockquote>
         <div className={styles.aiPanelTitle}><Icon name="file-text"/><span>SCRIPTED STRUCTURED FIELDS</span></div>
         <div className={styles.extractions}>{aiScenario.facts.map(fact=><div key={fact.label} data-missing={fact.source==="missing"}><span>{fact.label}</span><strong>{fact.value}</strong><small>{fact.source==="stated"?"Stated in sample enquiry":"Needs human clarification"}</small></div>)}</div>
       </article>
       <article className={styles.aiDraft}>
         <div className={styles.aiPanelTitle}><Icon name="brain-circuit"/><span>EDITABLE DRAFT / NO AI CALL</span><small>HUMAN DECIDES</small></div>
         <label htmlFor="dashboard-draft">Reply draft — review the wording</label>
         <textarea id="dashboard-draft" value={reply} maxLength={520} rows={7} onChange={e=>{setReply(e.target.value);setReview("pending")}}/>
         <div className={styles.aiCharacterCount}><span>{reply.length} / 520 characters</span><span>Saved in memory only</span></div>
         <div className={styles.aiGate} data-alert={aiScenario.requiresEscalation}>
           <Icon name="shield-check"/><span><strong>{aiScenario.requiresEscalation?"SAFETY REVIEW — ROUTINE WORK BLOCKED":"REQUIRED HUMAN REVIEW"}</strong><small>{aiScenario.reviewNote}</small></span>
         </div>
         <div className={styles.inlineActions}>
           {aiScenario.requiresEscalation?
             <button type="button" className={styles.primary} onClick={()=>setReview("escalated")}>Escalate for human review →</button>:
             <button type="button" className={styles.primary} disabled={!aiCanApprove(aiScenario,reply)} onClick={()=>setReview("approved")}>✓ Approve local draft</button>}
           <button type="button" onClick={()=>setReview("rejected")}>✕ Reject suggestion</button>
           <button type="button" onClick={()=>{setReply(aiScenario.draft);setReview("pending")}}>↺ Restore example</button>
         </div>
         <p className={styles.reviewState} data-decision={review} role="status">{aiDecisionLabel(review)}</p>
       </article>
     </div>
     <div className={styles.aiHumanNote}><Icon name="shield-check"/><span>Simulation boundary: these three scripted examples demonstrate the intended AI review experience. They do not perform extraction, submit real customer messages, schedule jobs or connect to an LLM.</span></div>
    </>:null}
    {module==="automations"?<>
     <div className={styles.sectionTop}><div><p className={styles.eyebrow}>AUTOMATIONS / REAL SOURCE CATALOGUE</p><h2>27 review-only workflow starters.</h2><p>No rule can be published or trigger a customer communication from this demo.</p></div><span className={styles.chip}>{rules.length} matching</span></div>
     <div className={styles.filters}><label>Search<input type="search" value={filter} maxLength={80} onChange={e=>setFilter(e.target.value)} placeholder="invoice, request, deep..."/></label><label>Category<select value={category} onChange={e=>setCategory(e.target.value)}><option value="All">All categories</option>{automationPlaybookCategories.map(c=><option key={c} value={c}>{c}</option>)}</select></label></div>
     <div className={styles.rules}><div className={styles.ruleList}>{rules.map(r=><button type="button" key={r.id} data-active={selectedRule?.id===r.id} onClick={()=>setRuleId(r.id)}><small>{r.category} · {r.severity}</small><strong>{r.name}</strong></button>)}{rules.length===0?<p>No match. Adjust filters.</p>:null}</div><article className={styles.ruleDetail}><Icon name="workflow"/>{selectedRule?<><h3>{selectedRule.name}</h3><dl><dt>Trigger</dt><dd>{selectedRule.eventType}</dd><dt>Condition</dt><dd>{selectedRule.condition?selectedRule.condition.field+" "+selectedRule.condition.operator+" "+String(selectedRule.condition.value):"Supported event received"}</dd><dt>Safe action</dt><dd>{selectedRule.actionDetail.replaceAll("_"," ")}</dd></dl><p>Internal attention draft only. Owner approval required for activation.</p></>:<p>Choose a starter to inspect.</p>}</article></div>
    </>:null}
    {module==="activity"?<>
     <div className={styles.sectionTop}><div><p className={styles.eyebrow}>AUDIT / CURRENT BROWSER SESSION</p><h2>Actions should be traceable.</h2><p>These {state.events.length} events come from your actual sandbox actions, not prefilled success receipts.</p></div><span className={styles.chip}>LOCAL LEDGER</span></div>
     <ol className={styles.activity}>{[...state.events].reverse().map(e=><li key={e.id}><span>{String(e.id).padStart(2,"0")}</span><div><strong>{e.title}</strong><p>{e.detail}</p><small>Simulated event · no provider receipt</small></div></li>)}</ol>
    </>:null}
   </div>
   <footer className={styles.footer}><Icon name="shield-check"/><p>Portfolio dashboard · all messages, bookings, AI text, financial actions, and crew records are fictional and stored in React memory only.</p><Link href="/sandbox">Original sandbox ↗</Link></footer>
  </section>
 </div>
 </main>;
}
