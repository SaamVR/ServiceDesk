"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { motionJourney, aiShowcaseModules, integrationShowcase, recoveryShowcase } from "./automation-motion-model";
import { automationPlaybooks, automationPlaybookCategories } from "../operations/automation-playbooks";
import { filterAutomationPlaybooks, type PlaybookCategoryFilter, type PlaybookSeverityFilter } from "../operations/automation-playbook-finder";
import styles from "./AutomationMotionHome.module.css";
import { OperationsTheater } from "./OperationsTheater";
import { CinematicHero } from "./CinematicHero";
import { WorkflowComparison } from "./WorkflowComparison";

const totalStages = motionJourney.length;

function Icon({ name, className = "" }: { name: string; className?: string }) {
  const image = "url(/portfolio/icons/" + name + ".svg)";
  const mask: CSSProperties = {
    maskImage: image,
    WebkitMaskImage: image,
    maskPosition: "center",
    WebkitMaskPosition: "center",
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskSize: "contain",
    WebkitMaskSize: "contain",
  };
  return <span className={styles.svgIcon + " " + className} style={mask} aria-hidden="true" />;
}

function Num({ value }: { value: number }) {
  return <>{String(value).padStart(2, "0")}</>;
}

export function AutomationMotionHome() {
  const [currentStage, setCurrentStage] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [inViewport, setInViewport] = useState(true);
  const stageRef = useRef<HTMLDivElement>(null);
  const [aiIndex, setAiIndex] = useState(0);
  const [aiPreview, setAiPreview] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryCategory, setLibraryCategory] = useState<PlaybookCategoryFilter>("All");
  const [librarySeverity, setLibrarySeverity] = useState<PlaybookSeverityFilter>("Any");
  const [expandedLibrary, setExpandedLibrary] = useState(false);
  const [selectedRule, setSelectedRule] = useState<string>("new-enquiry");
  const [simulatedRule, setSimulatedRule] = useState(false);
  const [integrationIndex, setIntegrationIndex] = useState(0);
  const [recoveryIndex, setRecoveryIndex] = useState(0);
  const [recoveryTriggered, setRecoveryTriggered] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => { setReduced(mq.matches); if (mq.matches) setPlaying(false); };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const node = stageRef.current;
    if (!node || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => setInViewport(entry.isIntersecting), { threshold: 0.12 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!playing || reduced || !inViewport) return;
    const id = window.setInterval(() => {
      if (!document.hidden) setCurrentStage(previous => (previous + 1) % totalStages);
    }, 3600);
    return () => window.clearInterval(id);
  }, [playing, reduced, inViewport]);

  const visiblePlaybooks = useMemo(
    () => filterAutomationPlaybooks(automationPlaybooks, {
      search: librarySearch, category: libraryCategory, severity: librarySeverity,
    }),
    [librarySearch, libraryCategory, librarySeverity],
  );
  const selectedPlaybook = visiblePlaybooks.find(item => item.id === selectedRule) ?? visiblePlaybooks[0];
  const ruleCards = expandedLibrary ? visiblePlaybooks : visiblePlaybooks.slice(0, 9);
  const stage = motionJourney[currentStage];
  const ai = aiShowcaseModules[aiIndex];
  const integration = integrationShowcase[integrationIndex];
  const recovery = recoveryShowcase[recoveryIndex];

  function selectStage(index: number) {
    setCurrentStage(index);
    setPlaying(false);
  }
  function selectAi(index: number) {
    setAiIndex(index);
    setAiPreview(false);
  }
  function setCategory(value: string) {
    setLibraryCategory(value as PlaybookCategoryFilter);
    setExpandedLibrary(false);
    setSimulatedRule(false);
  }
  function setSeverity(value: string) {
    setLibrarySeverity(value as PlaybookSeverityFilter);
    setExpandedLibrary(false);
    setSimulatedRule(false);
  }

  return <div className={styles.home}>
    <section className={styles.hero} id="public-main-content" tabIndex={-1} aria-labelledby="motion-home-title">
      <div className={styles.heroDecor} aria-hidden="true"><span /><span /><span /></div>
      <div className={styles.heroInner}>
        <div className={styles.heroCopy}>
          <div className={styles.kicker}><span className={styles.kickerSpark}><Icon name="sparkles" /></span> BUSINESS AUTOMATION / INTERACTIVE PORTFOLIO</div>
          <h1 id="motion-home-title">Your business.<br /><em>In motion.</em></h1>
          <p className={styles.heroLead}>Watch a cleaning business move from the first customer message to the final follow-up. Explore the systems, AI assistance and human decisions behind every handoff.</p>
          <div className={styles.heroActions}>
            <Link href="/demo" className={styles.primaryCta}>Explore guided dashboard <span aria-hidden="true">↗</span></Link>
            <a href="#scenario-lab" className={styles.secondaryCta}>Run workflow simulation <span aria-hidden="true">↘</span></a>
          </div>
          <p className={styles.heroBoundary}><span className={styles.boundaryDot} /> Interactive fictional walkthrough. Source-level prototypes; no live customer, AI or payment actions.</p>
        </div>
        <CinematicHero />
      </div>
      <div className={styles.heroStrip}>
        <div><strong>08</strong><span>Story stages</span></div>
        <div><strong>27</strong><span>Source playbook starters</span></div>
        <div><strong>06</strong><span>AI demonstration views</span></div>
        <div><strong>07</strong><span>Integration surfaces</span></div>
        <p>Catalogued capabilities, not live customer deployments.</p>
      </div>
    </section>

    <OperationsTheater />
    <WorkflowComparison />

    <section className={styles.sectionLight} id="live-workflow" aria-labelledby="journey-title" ref={stageRef}>
      <div className={styles.sectionHead}>
        <div><p className={styles.eyebrow}><Num value={1} /> / INTERACTIVE MOTION STORY</p><h2 id="journey-title">From the first hello<br />to the final <em>follow-up.</em></h2></div>
        <p>Every icon is a real licensed vector asset. Every state change represents a business handoff. Select an event or start playback to see what moves—and who approves it.</p>
      </div>
      <div className={styles.journeyBoard}>
        <div className={styles.journeyChrome}><span><span className={styles.ping} /> WORKFLOW SIMULATOR</span><span>SAMPLE DATA • NO EXTERNAL ACTIONS</span></div>
        <div className={styles.routeViewport} aria-label="Select a stage to inspect">
          <div className={styles.routeTrack} aria-hidden="true"><div className={styles.routeFill} style={{width: (currentStage / (totalStages - 1) * 100) + "%"}} /><span className={styles.routePacket} style={{left: (currentStage / (totalStages - 1) * 100) + "%"}} /></div>
          <ol className={styles.stageNodes}>
            {motionJourney.map((item, index) => (
              <li key={item.tag}>
                <button type="button" onClick={() => selectStage(index)} data-state={index === currentStage ? "active" : index < currentStage ? "passed" : "waiting"} className={styles.stageButton} aria-current={currentStage === index ? "step" : undefined} aria-label={"Inspect stage " + (index + 1) + ": " + item.tag}>
                  <span className={styles.stageIcon}><Icon name={item.icon} /></span>
                  <span className={styles.stageMeta}><small><Num value={index + 1} /></small><strong>{item.tag}</strong></span>
                </button>
              </li>
            ))}
          </ol>
        </div>
        <div className={styles.journeyInspector}>
          <div className={styles.inspectorNumber}><span>EVENT IN FOCUS</span><strong><Num value={currentStage + 1} /> / <Num value={totalStages} /></strong></div>
          <div key={currentStage} className={styles.stageContent} aria-live={playing ? "off" : "polite"}>
            <div className={styles.eventIllustration}><span className={styles.eventRing}><Icon name={stage.icon} /></span><span className={styles.eventStamp}>SAMPLE EVENT</span></div>
            <div className={styles.eventCopy}><p className={styles.eventType}>{stage.tag}</p><h3>{stage.title}</h3><p>{stage.trail}</p></div>
          </div>
          <div key={"details" + currentStage} className={styles.eventDetails}>
            <div><span>TRIGGER</span><p>{stage.trigger}</p></div>
            <div><span>SYSTEM RESPONSE</span><p>{stage.work}</p></div>
            <div><span>AI ASSISTANCE</span><p>{stage.ai}</p></div>
            <div><span>HUMAN GATE</span><p>{stage.human}</p></div>
          </div>
          <div className={styles.eventFooter}><span className={styles.eventOutcome}><span className={styles.ping} /> {stage.record}</span><span>VISUALIZATION ONLY</span></div>
        </div>
        <div className={styles.timelineControls}>
          <div className={styles.controlGroup}>
            <button type="button" className={styles.playButton} aria-label={playing ? "Pause workflow playback" : "Play workflow animation"} aria-pressed={playing} disabled={reduced} onClick={() => setPlaying(p => !p)}>
              {reduced ? "Motion off" : playing ? "Ⅱ Pause" : "▶ Play"} 
            </button>
            <button type="button" className={styles.controlButton} onClick={() => selectStage((currentStage + totalStages - 1) % totalStages)}>← Previous</button>
            <button type="button" className={styles.controlButton} onClick={() => selectStage((currentStage + 1) % totalStages)}>Next →</button>
            <button type="button" className={styles.controlButton} onClick={() => selectStage(0)}>↺ Restart</button>
          </div>
          <span>{reduced ? "Reduced-motion preference respected · use Next" : playing ? "Playing · pauses when out of view" : "Paused · select a stage"}</span>
        </div>
      </div>
    </section>

    <section className={styles.sectionDark} id="ai-studio" aria-labelledby="ai-title">
      <div className={styles.sectionHead}>
        <div><p className={styles.eyebrow}><Num value={2} /> / THE AI ASSISTANT LAYER</p><h2 id="ai-title">Intelligence that drafts.<br /><em>People who decide.</em></h2></div>
        <p>Six source-backed AI use cases. Select an example and run a scripted preview to see its input, expected suggestion and safety boundary. No model provider is called from this site.</p>
      </div>
      <div className={styles.aiLayout}>
        <div className={styles.aiMenu} role="group" aria-label="Choose an AI use case">
          {aiShowcaseModules.map((item, index) => <button type="button" key={item.id} onClick={() => selectAi(index)} aria-pressed={aiIndex === index} data-selected={aiIndex === index} className={styles.aiMenuItem}>
            <span className={styles.aiMenuGlyph}><Icon name={item.icon} /></span><span><small>{item.group}</small><strong>{item.name}</strong></span><span className={styles.aiMenuArrow}>↗</span>
          </button>)}
        </div>
        <div className={styles.aiCanvas}>
          <div className={styles.aiCanvasChrome}><span><span className={styles.ping} /> AI ASSISTANCE / EXAMPLE</span><span>MODEL NOT CONNECTED</span></div>
          <div className={styles.aiCanvasInner} key={ai.id}>
            <div className={styles.aiModuleHeading}><div className={styles.aiModuleIcon}><Icon name={ai.icon} /></div><div><p>{ai.group} / SAMPLE WORKSPACE</p><h3>{ai.name}</h3></div></div>
            <div className={styles.aiInput}><span>FICTIONAL INPUT</span><p>{ai.input}</p></div>
            <div className={styles.aiRunArea}>
              <button type="button" className={styles.aiRunButton} onClick={() => setAiPreview(v => !v)}>{aiPreview ? "↺ Hide sample draft" : "✦ Show scripted AI preview"}</button>
              <span>Human-reviewed draft, not an AI call</span>
            </div>
            {aiPreview ? <div className={styles.aiOutput} role="status"><span className={styles.aiOutputStamp}><Icon name="sparkles" /> SAMPLE DRAFT</span><p>{ai.output}</p><div className={styles.aiApproval}><Icon name="shield-check" /> Approval checkpoint: {ai.boundary}</div></div> :
              <div className={styles.aiPlaceholder}><Icon name="brain-circuit" /><span>Choose “Show scripted AI preview” to reveal the suggested next step.</span></div>}
            <div className={styles.aiSource}>SOURCE MODULE <strong>{ai.source}</strong></div>
          </div>
        </div>
      </div>
    </section>

    <section className={styles.sectionLight} id="playbooks" aria-labelledby="playbooks-title">
      <div className={styles.sectionHead}>
        <div><p className={styles.eyebrow}><Num value={3} /> / AUTOMATION LIBRARY</p><h2 id="playbooks-title">27 rules for<br /><em>less routine work.</em></h2></div>
        <p>This is the actual 27-item starter catalogue from ServiceDesk's source, not invented portfolio data. These rules create <strong>internal attention drafts</strong>; none is published or connected to real customer sends here.</p>
      </div>
      <div className={styles.libraryFrame}>
        <div className={styles.filterBar}>
          <label className={styles.searchLabel}><span>SEARCH PLAYBOOKS</span><input type="search" value={librarySearch} onChange={e => {setLibrarySearch(e.currentTarget.value);setExpandedLibrary(false);setSimulatedRule(false);}} placeholder="e.g. deep, visit, invoice, critical" maxLength={80} /></label>
          <label className={styles.selectLabel}><span>BUSINESS AREA</span><select value={libraryCategory} onChange={e => setCategory(e.currentTarget.value)}><option value="All">All categories</option>{automationPlaybookCategories.map(c => <option value={c} key={c}>{c}</option>)}</select></label>
          <label className={styles.selectLabel}><span>SEVERITY</span><select value={librarySeverity} onChange={e => setSeverity(e.currentTarget.value)}><option value="Any">Any priority</option><option value="INFO">Info</option><option value="WARNING">Warning</option><option value="CRITICAL">Critical</option></select></label>
          <div className={styles.resultCounter}><strong>{visiblePlaybooks.length}</strong><span>matching starters</span></div>
        </div>
        <div className={styles.libraryLayout}>
          <div>
            <div className={styles.ruleGrid}>
              {ruleCards.map(item => <button type="button" key={item.id} className={styles.ruleCard} data-selected={selectedPlaybook?.id === item.id} onClick={() => {setSelectedRule(item.id);setSimulatedRule(false);}}>
                <span className={styles.ruleCardTop}><span className={styles.ruleCategory}>{item.category}</span><span data-severity={item.severity} className={styles.ruleSeverity}>{item.severity}</span></span>
                <strong>{item.name}</strong><small>{item.eventType.replaceAll("_"," ")}</small><span className={styles.ruleExplore}>Inspect starter <span aria-hidden="true">↗</span></span>
              </button>)}
            </div>
            {visiblePlaybooks.length === 0 ? <p className={styles.noRules} role="status">No starter matches these filters. Try another term or category.</p> : null}
            {visiblePlaybooks.length > 9 ? <button type="button" className={styles.showMore} onClick={() => setExpandedLibrary(v => !v)}>{expandedLibrary ? "Show fewer starters ↑" : "Show all matching starters ↓"}</button> : null}
          </div>
          <aside className={styles.ruleInspector} aria-label="Selected workflow starter">
            <div className={styles.ruleInspectorTop}><span><Icon name="workflow" /> WORKFLOW INSPECTOR</span><span>INTERNAL DRAFT ONLY</span></div>
            {selectedPlaybook ? <>
              <p className={styles.ruleOverline}>{selectedPlaybook.category} / {selectedPlaybook.severity}</p>
              <h3>{selectedPlaybook.name}</h3>
              <div className={styles.ruleDiagram}>
                <div><span>EVENT</span><strong>{selectedPlaybook.eventType}</strong></div><span className={styles.diagramLine} aria-hidden="true">↓</span>
                <div><span>CONDITION</span><strong>{selectedPlaybook.condition ? selectedPlaybook.condition.field + " " + selectedPlaybook.condition.operator + " " + String(selectedPlaybook.condition.value) : "Supported event received"}</strong></div><span className={styles.diagramLine} aria-hidden="true">↓</span>
                <div><span>SAFE ACTION</span><strong>{selectedPlaybook.actionDetail.replaceAll("_"," ")}</strong></div>
              </div>
              <button type="button" className={styles.simulateButton} onClick={() => setSimulatedRule(v => !v)}>{simulatedRule ? "↺ Reset simulated trigger" : "▶ Simulate internal trigger"}</button>
              {simulatedRule ? <div className={styles.ruleSimulation} role="status"><Icon name="badge-check" /><p><strong>Illustrative match.</strong> A fictional event would create a staff attention task for review. No rule is published, and nothing was sent, charged or scheduled.</p></div> : <p className={styles.ruleNeutral}>This inspection is read-only. Select “Simulate” to see the internal attention outcome.</p>}
            </> : <p className={styles.ruleNeutral}>Select a matching starter on the left.</p>}
            <div className={styles.ruleDisclaimer}>All 27 source templates are internal attention starters. Publication and execution require separate authenticated acceptance.</div>
          </aside>
        </div>
      </div>
    </section>

    <section className={styles.sectionSoft} id="integrations" aria-labelledby="integrations-title">
      <div className={styles.sectionHead}>
        <div><p className={styles.eyebrow}><Num value={4} /> / INTEGRATION MAP</p><h2 id="integrations-title">One operational picture.<br /><em>Many moving parts.</em></h2></div>
        <p>Explore designed provider handoffs and their actual evidence boundaries. Source routes exist for several connectors; this portfolio does not claim customer-ready provider access.</p>
      </div>
      <div className={styles.integrationLayout}>
        <div className={styles.providerGrid}>
          {integrationShowcase.map((item, i) => <button type="button" key={item.id} data-selected={i === integrationIndex} aria-pressed={i === integrationIndex} className={styles.providerTile} onClick={() => setIntegrationIndex(i)}>
            <span className={styles.providerIcon}><Icon name={item.icon} /></span><span><strong>{item.name}</strong><small>{item.status}</small></span><span className={styles.providerArrow}>↗</span>
          </button>)}
        </div>
        <article className={styles.integrationInspector} aria-live="polite" key={integration.id}>
          <div className={styles.integrationsTop}><span>CONNECTION BLUEPRINT / {String(integrationIndex+1).padStart(2,"0")}</span><span data-kind={integration.kind}>{integration.status}</span></div>
          <div className={styles.providerBigIcon}><Icon name={integration.icon} /></div><h3>{integration.name}</h3>
          <div className={styles.handoffVisual}><div><span>TRIGGER</span><strong>{integration.trigger}</strong></div><span className={styles.handoffArrow} aria-hidden="true">→</span><div><span>SERVICEDESK</span><strong>Checked handoff</strong></div><span className={styles.handoffArrow} aria-hidden="true">→</span><div><span>CONTROL</span><strong>Human / verified state</strong></div></div>
          <p>{integration.handoff}</p><div className={styles.integrationCaveat}><Icon name="shield-check" /> {integration.boundary}</div>
        </article>
      </div>
    </section>

    <section className={styles.sectionLight} id="recovery" aria-labelledby="recovery-title">
      <div className={styles.sectionHead}>
        <div><p className={styles.eyebrow}><Num value={5} /> / RESILIENCE LAB</p><h2 id="recovery-title">When something fails,<br /><em>the truth stays visible.</em></h2></div>
        <p>Great automation knows when to stop. Select an exception and inject a fictional failure to see how the designed safety boundary protects customers and staff.</p>
      </div>
      <div className={styles.recoveryLayout}>
        <div className={styles.recoveryMenu}>
          {recoveryShowcase.map((item,i) => <button type="button" key={item.id} className={styles.recoveryTab} data-selected={i===recoveryIndex} onClick={()=>{setRecoveryIndex(i);setRecoveryTriggered(false);}}><Icon name={item.icon}/><strong>{item.name}</strong><span>↗</span></button>)}
        </div>
        <div className={styles.recoveryCanvas}>
          <div className={styles.recoveryChrome}><span><span className={styles.ping}/> CONTROLLED EXCEPTION SIMULATOR</span><span>LOCAL / SYNTHETIC</span></div>
          <div className={styles.recoveryGraphic} data-active={recoveryTriggered}>
            <div><Icon name={recovery.icon}/><span>EVENT</span></div><span className={styles.recoveryTrail} aria-hidden="true"><i /></span><div><Icon name={recoveryTriggered?"shield-check":"workflow"}/><span>{recoveryTriggered?"SAFE STOP":"WORKFLOW"}</span></div>
          </div>
          <h3>{recovery.name}</h3><p>{recovery.signal}</p>
          <button type="button" className={styles.recoveryAction} onClick={()=>setRecoveryTriggered(v=>!v)}>{recoveryTriggered?"↺ Reset simulation":"! Inject fictional failure"}</button>
          {recoveryTriggered ? <div role="status" className={styles.recoveryResult}><strong>FAIL-CLOSED RESPONSE</strong><p>{recovery.rule}</p><strong>NEXT HUMAN ACTION</strong><p>{recovery.action}</p></div> : <div className={styles.recoveryReady}>Ready to simulate a non-destructive exception.</div>}
        </div>
      </div>
    </section>

    <section className={styles.capabilities} id="capabilities" aria-labelledby="capabilities-title">
      <div className={styles.sectionHead}><div><p className={styles.eyebrow}><Num value={6} /> / COMPLETE PRODUCT EXPERIENCE</p><h2 id="capabilities-title">More than automation.<br /><em>An operations workspace.</em></h2></div><p>These areas exist as app surfaces and source modules. Real multi-tenant owner acceptance, payments and provider verification are separate release gates.</p></div>
      <div className={styles.capabilityGrid}>
        {[
          {icon:"inbox",title:"Shared inbox",desc:"Conversations, triage, review and customer context"},
          {icon:"users",title:"Customer CRM",desc:"Customer and property history with scoped records"},
          {icon:"calendar-check",title:"Dispatch & scheduling",desc:"Crew coordination, capacity checks and visit tracking"},
          {icon:"clipboard-check",title:"Field operations",desc:"Checklists, job states, notes and quality review"},
          {icon:"receipt",title:"Quoting & finance",desc:"Versioned price decisions, invoices and balances"},
          {icon:"workflow",title:"Automation studio",desc:"27 bounded starters, internal attention and exception recovery"},
        ].map(item=><article key={item.title} className={styles.capabilityCard}><span className={styles.capabilityIcon}><Icon name={item.icon}/></span><h3>{item.title}</h3><p>{item.desc}</p><span className={styles.capabilityNotch} aria-hidden="true">↗</span></article>)}
      </div>
    </section>

    <section className={styles.closing} aria-labelledby="closing-title">
      <div className={styles.closingOrbit} aria-hidden="true"><Icon name="workflow"/></div>
      <p>THE NEXT GENERATION OF SERVICE OPERATIONS</p><h2 id="closing-title">Less noise.<br /><em>More time for the work.</em></h2>
      <div className={styles.closingActions}><Link href="/demo" className={styles.primaryCta}>Launch guided dashboard <span aria-hidden="true">↗</span></Link><Link href="/work/business-automation" className={styles.secondaryCta}>Read the full case study <span aria-hidden="true">→</span></Link></div>
      <small>Portfolio prototype · all event data, AI outputs, failures and financial actions are fictional · no external API calls from this experience.</small>
    </section>
  </div>;
}
