"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./AutomationCaseStudy.module.css";

const workflow = [
  {
    id: "01",
    label: "Capture",
    title: "Turn a message into a usable service request.",
    trigger: "A customer asks for a move-out clean.",
    system: "Structured intake captures property size, preferred date and extra services in one request.",
    human: "Staff can correct missing details before a quote is drafted.",
    record: "Request · customer context",
  },
  {
    id: "02",
    label: "Price",
    title: "Calculate consistently. Leave approval to people.",
    trigger: "A complete service request is ready for pricing.",
    system: "Branch-scoped rates and selected add-ons create an explainable quote draft.",
    human: "A responsible owner reviews the price, scope and revision before acceptance.",
    record: "Versioned quote · review state",
  },
  {
    id: "03",
    label: "Schedule",
    title: "Move from approved quote to a realistic visit.",
    trigger: "The customer accepts a reviewed quote.",
    system: "Availability checks help coordinate a crew slot and job requirements.",
    human: "Dispatch confirms real capacity and makes the assignment.",
    record: "Visit · crew assignment",
  },
  {
    id: "04",
    label: "Deliver",
    title: "Give field teams the context they need.",
    trigger: "The assigned visit begins.",
    system: "The job view carries scope, checklist, notes and completion status.",
    human: "Crew members report progress; supervisors review exceptions and quality.",
    record: "Job history · quality evidence",
  },
  {
    id: "05",
    label: "Reconcile",
    title: "Close the loop without losing accountability.",
    trigger: "The service has been reviewed.",
    system: "Invoice status, outstanding balance and follow-up remain linked to the work.",
    human: "Only authorized people approve financial and outbound communications.",
    record: "Invoice ledger · communication state",
  },
] as const;

export function AutomationCaseStudy() {
  const [active, setActive] = useState(0);
  const current = workflow[active];

  return (
    <div className={styles.caseStudy}>
      <section className={styles.hero} id="public-main-content" tabIndex={-1} aria-labelledby="portfolio-heading">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><span className={styles.spark} aria-hidden="true">✳</span> SELECTED WORK / BUSINESS AUTOMATION</p>
          <h1 id="portfolio-heading">Less busywork.<br /><em>More business.</em></h1>
          <p className={styles.lead}>A connected operations experience designed for cleaning businesses—from a first enquiry to quoting, team coordination, invoicing and follow-up.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primary} href="/sandbox">Try the interactive demo <span aria-hidden="true">↗</span></Link>
            <a className={styles.secondary} href="#workflow">Explore the automation <span aria-hidden="true">↓</span></a>
          </div>
          <p className={styles.honestNotice}><span aria-hidden="true">●</span> Portfolio case study · interactive prototype · sample data only. Not a claim of a live customer deployment.</p>
          <div className={styles.serviceTags} aria-label="Project disciplines">
            <span>Product strategy</span><span>Workflow design</span><span>Frontend engineering</span><span>AI-assisted operations</span>
          </div>
        </div>
        <div className={styles.heroCanvas} role="img" aria-label="Illustrative business automation dashboard showing a cleaning request, quote review, crew assignment and connected steps">
          <div className={styles.canvasTop}><span className={styles.canvasLogo}>✳</span><span>BRIGHTROOM / SAMPLE WORKSPACE</span><span className={styles.canvasDots} aria-hidden="true">•••</span></div>
          <div className={styles.canvasHeader}><span>OPERATIONS FLOW</span><strong>Every handoff, in focus.</strong><p>One customer request. A connected series of decisions.</p></div>
          <div className={styles.sampleRequest}><span className={styles.requestGlyph} aria-hidden="true">↗</span><div><small>INCOMING REQUEST</small><strong>Move-out cleaning</strong><span>3 bedrooms · 2 bathrooms</span></div><span className={styles.sampleFlag}>SAMPLE</span></div>
          <div className={styles.flowLine} aria-hidden="true" />
          <div className={styles.canvasCards}>
            <div><span className={styles.canvasCardMeta}>01 / STRUCTURE</span><strong>Service details captured</strong><span className={styles.illustratedStatus}>Ready for review</span></div>
            <div><span className={styles.canvasCardMeta}>02 / APPROVAL</span><strong>Quote prepared</strong><span className={styles.humanStatus}>Human decision</span></div>
            <div><span className={styles.canvasCardMeta}>03 / COORDINATE</span><strong>Crew and visit context</strong><span className={styles.illustratedStatus}>Next in flow</span></div>
          </div>
          <div className={styles.canvasFooter}><span><i aria-hidden="true" /> Linked operational context</span><span>CONCEPT VIEW / NOT LIVE</span></div>
        </div>
      </section>

      <section className={styles.definition} aria-label="Project overview">
        <div><span>THE CHALLENGE</span><p>Enquiries, pricing, schedules and field updates often sit in separate conversations and tools.</p></div>
        <div><span>THE APPROACH</span><p>Make each handoff visible, preserve the source record and automate routine preparation—not human authority.</p></div>
        <div><span>THE EXPERIENCE</span><p>A focused workspace with practical journeys, recoverable states and an interactive sample sandbox.</p></div>
      </section>

      <section className={styles.workflowSection} id="workflow" aria-labelledby="workflow-heading">
        <div className={styles.sectionIntro}><p className={styles.eyebrow}>01 / THE SYSTEM</p><h2 id="workflow-heading">Five stages.<br /><em>One connected business.</em></h2><p>Choose a stage to inspect the trigger, designed automation and human approval point. This is an interactive explanation of the product architecture, not a connected account.</p></div>
        <div className={styles.workbench}>
          <div className={styles.stepList} role="group" aria-label="Inspect business workflow stage">
            {workflow.map((item, index) => (
              <button key={item.id} type="button" className={active === index ? styles.stepActive : styles.stepButton} onClick={() => setActive(index)} aria-pressed={active === index}>
                <span className={styles.stepNumber}>{item.id}</span><span className={styles.stepLabel}>{item.label}<small>{item.title}</small></span><span className={styles.stepArrow} aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
          <article className={styles.inspector} aria-label={"Workflow stage " + current.label}>
            <div className={styles.inspectorHeader}><span>STAGE {current.id} / {workflow.length.toString().padStart(2, "0")}</span><span>INTERACTIVE EXPLAINER</span></div>
            <h3>{current.title}</h3>
            <div className={styles.inspectorRows}>
              <div><span className={styles.rowType}>TRIGGER</span><p>{current.trigger}</p></div>
              <div><span className={styles.rowType}>SYSTEM SUPPORT</span><p>{current.system}</p></div>
              <div><span className={styles.rowType}>HUMAN CONTROL</span><p>{current.human}</p></div>
            </div>
            <div className={styles.inspectorFooter}><span>ILLUSTRATIVE RECORD</span><strong>{current.record}</strong></div>
          </article>
        </div>
      </section>

      <section className={styles.simulation} aria-labelledby="simulation-heading">
        <div className={styles.simulationCopy}><p className={styles.eyebrow}>02 / TRY IT YOURSELF</p><h2 id="simulation-heading">Don&apos;t just watch the workflow.<br /><em>Make the decisions.</em></h2><p>Use the browser-only sandbox to move a fictional job through quote approval, crew assignment, delivery, invoice reconciliation and mock communication recovery.</p><Link className={styles.primary} href="/sandbox">Launch interactive sandbox <span aria-hidden="true">↗</span></Link><p className={styles.simulationNote}>No authentication, database writes, payments, third-party sends or real customer records.</p></div>
        <div className={styles.demoPanel} aria-label="Sandbox features">
          <div className={styles.demoTitle}><span className={styles.pulse} /> INTERACTIVE SANDBOX <span>LOCAL ONLY</span></div>
          <ul>
            <li><span>01</span> Prepare a sample quote <strong>→</strong></li>
            <li><span>02</span> Approve and schedule <strong>→</strong></li>
            <li><span>03</span> Assign and complete a job <strong>→</strong></li>
            <li><span>04</span> Reconcile sample balances <strong>→</strong></li>
            <li><span>05</span> Test mock delivery failure <strong>→</strong></li>
          </ul>
          <div className={styles.demoEnd}>Review the activity ledger after each action.</div>
        </div>
      </section>

      <section className={styles.architecture} id="architecture" aria-labelledby="architecture-heading">
        <div className={styles.sectionIntro}><p className={styles.eyebrow}>03 / BEHIND THE EXPERIENCE</p><h2 id="architecture-heading">Designed for clarity.<br /><em>Engineered for control.</em></h2><p>The work spans product design and a functional application codebase. Source-level implementations are not the same as production acceptance.</p></div>
        <div className={styles.archGrid}>
          <article><span className={styles.archIcon} aria-hidden="true">⌘</span><h3>Connected product journeys</h3><p>Customer enquiries, staff requests, reviewed quotes, scheduling, job execution and finance occupy recognizable parts of one system.</p></article>
          <article><span className={styles.archIcon} aria-hidden="true">◇</span><h3>Guarded automation</h3><p>Human approval remains explicit. Drafting, queueing and provider acceptance are never presented as completed customer actions.</p></article>
          <article><span className={styles.archIcon} aria-hidden="true">≋</span><h3>Testable business rules</h3><p>TypeScript domain logic, PostgreSQL migration design and tenant-aware boundaries provide a foundation for reliable behavior.</p></article>
          <article><span className={styles.archIcon} aria-hidden="true">↺</span><h3>Recovery by design</h3><p>Version-aware quoting, audit history and simulated delivery retry paths illustrate how operational mistakes can remain visible.</p></article>
        </div>
        <div className={styles.stackLine}><span>IMPLEMENTATION STACK</span><div><span>Next.js</span><span>React</span><span>TypeScript</span><span>PostgreSQL / Supabase</span><span>CSS motion</span></div></div>
      </section>

      <section className={styles.finish} aria-labelledby="finish-heading"><span className={styles.finishMark} aria-hidden="true">✳</span><p>THE TAKEAWAY</p><h2 id="finish-heading">Automation should make the business <em>more understandable.</em> Not less human.</h2><div><Link className={styles.finishPrimary} href="/sandbox">Explore the working sample <span aria-hidden="true">↗</span></Link><Link className={styles.finishSecondary} href="/tour">View guided product tour <span aria-hidden="true">→</span></Link></div><small>Portfolio demonstration · synthetic customer, financial and delivery events · not a live service</small></section>
    </div>
  );
}
