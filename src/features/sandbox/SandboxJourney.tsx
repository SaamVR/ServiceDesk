"use client";

import { useReducer } from "react";
import {
  createSandboxState,
  sandboxAllocatedMinor,
  sandboxOutstandingMinor,
  sandboxQuote,
  sandboxReducer,
  sandboxStages,
  type SandboxAction,
} from "./sandbox-engine";
import styles from "./SandboxJourney.module.css";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
function amount(minor: number): string { return money.format(minor / 100); }

const actionLabels: Record<Exclude<SandboxAction, "RESET">, string> = {
  CREATE_QUOTE: "Prepare sample quote",
  ACCEPT_QUOTE: "Simulate quote acceptance",
  HOLD_SLOT: "Hold a sample crew slot",
  PAY_DEPOSIT: "Simulate deposit payment",
  ASSIGN_CREW: "Assign Crew Alpha",
  START_JOB: "Start sample job",
  COMPLETE_JOB: "Complete and review job",
  PAY_BALANCE: "Simulate balance payment",
  QUEUE_CONFIRMATION: "Queue mock confirmation",
  FAIL_DELIVERY: "Simulate transport failure",
  RETRY_DELIVERY: "Retry mock confirmation",
  ACKNOWLEDGE_DELIVERY: "Simulate provider acceptance",
};

export function SandboxJourney() {
  const [state, dispatch] = useReducer(sandboxReducer, createSandboxState());
  const current = sandboxStages.findIndex(step => step.id === state.stage);
  const next = sandboxStages[current + 1];
  const canNotify = current >= sandboxStages.findIndex(step => step.id === "DEPOSIT_PAID");
  const deliveryStatus = {
    UNSENT: "No confirmation queued",
    QUEUED: "Simulated queue · not sent",
    FAILED: "Mock provider failure",
    SIMULATED_PROVIDER_ACCEPTED: "Mock provider accepted · not delivered",
  }[state.delivery];

  return (
    <main className={styles.page} id="sandbox-main">
      <header className={styles.nav}>
        <a className={styles.logo} href="/" aria-label="ServiceDesk AI home">
          <span className={styles.logoMark} aria-hidden="true">S</span>
          <span>ServiceDesk <b>AI</b></span>
        </a>
        <nav aria-label="Sandbox navigation" className={styles.navLinks}>
          <a href="/tour">Guided tour</a>
          <a href="/">Website</a>
        </nav>
      </header>

      <section className={styles.hero} aria-labelledby="sandbox-heading">
        <div>
          <p className={styles.eyebrow}><span className={styles.dot} /> INTERACTIVE PRODUCT SANDBOX</p>
          <h1 id="sandbox-heading">One job. Every step. Your decisions.</h1>
          <p className={styles.intro}>Follow a sample cleaning request from enquiry to paid invoice. Advance the workflow, inspect the ledger and test message recovery—all in your browser.</p>
          <div className={styles.modeNotice} role="note">
            <strong>Simulation, not a connected account.</strong> All customers, transactions, messages and provider states here are synthetic. Actions use local memory only; refresh resets everything. No emails, messages, API requests or payments are sent.
          </div>
        </div>
        <aside className={styles.heroAside} aria-label="Sample business">
          <span className={styles.asideLabel}>SAMPLE WORKSPACE · ISOLATED</span>
          <h2>BrightRoom Cleaning</h2>
          <p>Residential services · New enquiry</p>
          <div className={styles.customer}>
            <span className={styles.avatar} aria-hidden="true">AM</span>
            <div><strong>Alex Morgan</strong><span>Synthetic customer · Move-out cleaning</span></div>
          </div>
          <div className={styles.property}>
            <span>Property</span><strong>3 bedrooms · 2 bathrooms</strong>
            <span>Add-on</span><strong>Oven cleaning</strong>
          </div>
        </aside>
      </section>

      <section className={styles.metrics} aria-label="Live simulation totals">
        <article><span>Quote total</span><strong>{amount(sandboxQuote.totalMinor)}</strong><small>Actual pricing formula · sample rates</small></article>
        <article><span>Simulated paid</span><strong>{amount(sandboxAllocatedMinor(state))}</strong><small>Never charged</small></article>
        <article><span>Outstanding balance</span><strong>{amount(sandboxOutstandingMinor(state))}</strong><small>Deposit + final payment</small></article>
        <article><span>Current status</span><strong className={styles.stageValue}>{sandboxStages[current].label}</strong><small>Step {current + 1} of {sandboxStages.length}</small></article>
      </section>

      <div className={styles.workbench}>
        <section className={styles.workflow} aria-labelledby="journey-heading">
          <div className={styles.sectionTitle}>
            <div><span className={styles.eyebrow}>01 / OPERATIONS</span><h2 id="journey-heading">Job lifecycle</h2></div>
            <span className={styles.stepIndicator}>{current + 1} / {sandboxStages.length}</span>
          </div>
          <ol className={styles.steps}>
            {sandboxStages.map((step, index) => {
              const completed = index < current;
              const active = index === current;
              return (
                <li key={step.id} className={completed ? styles.completed : active ? styles.active : styles.upcoming}>
                  <span className={styles.stepNumber} aria-hidden="true">{completed ? "✓" : index + 1}</span>
                  <div><strong>{step.label}</strong><p>{step.description}</p></div>
                  {active ? <span className={styles.currentTag}>Current</span> : null}
                </li>
              );
            })}
          </ol>
          <div className={styles.nextAction}>
            {next && next.action ? (
              <>
                <span className={styles.eyebrow}>NEXT ACTION</span>
                <strong>{next.label}</strong>
                <p>{next.description}</p>
                <button type="button" className={styles.primaryButton} onClick={() => dispatch(next.action as SandboxAction)}>
                  {actionLabels[next.action]} <span aria-hidden="true">→</span>
                </button>
              </>
            ) : (
              <>
                <span className={styles.eyebrow}>WORKFLOW COMPLETE</span>
                <strong>Sample job fully reconciled.</strong>
                <p>All simulated payments are allocated once. Reset to try another complete run.</p>
              </>
            )}
            <button type="button" className={styles.resetButton} onClick={() => dispatch("RESET")}>Reset sandbox</button>
            <p className={styles.liveNotice} role="status" aria-live="polite">{state.notice}</p>
          </div>
        </section>

        <div className={styles.rightColumn}>
          <section className={styles.panel} aria-labelledby="ledger-heading">
            <div className={styles.sectionTitle}>
              <div><span className={styles.eyebrow}>02 / FINANCE</span><h2 id="ledger-heading">Invoice ledger</h2></div>
              <span className={styles.syntheticPill}>TEST DATA</span>
            </div>
            <div className={styles.ledgerRows}>
              <div><span>Move-out service</span><strong>{amount(sandboxQuote.subtotalMinor)}</strong></div>
              <div><span>Tax (illustrative 0%)</span><strong>{amount(sandboxQuote.taxMinor)}</strong></div>
              <div className={styles.total}><span>Quote total</span><strong>{amount(sandboxQuote.totalMinor)}</strong></div>
              <div><span>Deposit allocation</span><strong>{amount(state.depositAllocatedMinor)}</strong></div>
              <div><span>Balance allocation</span><strong>{amount(state.balanceAllocatedMinor)}</strong></div>
              <div className={styles.outstanding}><span>Remaining</span><strong>{amount(sandboxOutstandingMinor(state))}</strong></div>
            </div>
            <p className={styles.caption}>Amounts are calculated using the application’s real move-out pricing function. Payment events are synthetic; no Stripe request or transaction exists.</p>
          </section>

          <section className={styles.panel} aria-labelledby="delivery-heading">
            <div className={styles.sectionTitle}>
              <div><span className={styles.eyebrow}>03 / COMMUNICATIONS</span><h2 id="delivery-heading">Delivery recovery</h2></div>
              <span className={styles.syntheticPill}>MOCK ADAPTER</span>
            </div>
            <div className={styles.deliveryStatus}><span className={styles.deliveryIcon} aria-hidden="true">↗</span><div><strong>{deliveryStatus}</strong><p>Provider acceptance never implies delivered or read.</p></div></div>
            <div className={styles.deliveryActions}>
              {state.delivery === "UNSENT" ? <button type="button" disabled={!canNotify} onClick={() => dispatch("QUEUE_CONFIRMATION")}>Queue confirmation</button> : null}
              {state.delivery === "QUEUED" ? (
                <>
                  <button type="button" onClick={() => dispatch("FAIL_DELIVERY")}>Inject mock failure</button>
                  <button type="button" onClick={() => dispatch("ACKNOWLEDGE_DELIVERY")}>Accept in mock transport</button>
                </>
              ) : null}
              {state.delivery === "FAILED" ? <button type="button" onClick={() => dispatch("RETRY_DELIVERY")}>Retry failed send</button> : null}
              {state.delivery === "SIMULATED_PROVIDER_ACCEPTED" ? <p className={styles.caption}>No real delivery receipt is possible in this sandbox.</p> : null}
              {!canNotify && state.delivery === "UNSENT" ? <p className={styles.caption}>Complete the simulated deposit before queuing a message.</p> : null}
            </div>
          </section>

          <section className={styles.panel} aria-labelledby="history-heading">
            <div className={styles.sectionTitle}>
              <div><span className={styles.eyebrow}>04 / AUDIT TRAIL</span><h2 id="history-heading">Activity</h2></div>
              <span className={styles.counter}>{state.events.length} events</span>
            </div>
            <ol className={styles.history} aria-live="polite">
              {[...state.events].reverse().map(event => (
                <li key={event.id}><span className={styles.eventIndex}>{String(event.id).padStart(2, "0")}</span><div><strong>{event.title}</strong><p>{event.detail}</p></div></li>
              ))}
            </ol>
          </section>
        </div>
      </div>
      <footer className={styles.footer}><span>ServiceDesk AI · interactive demo data</span><a href="/tour">Explore the full guided product tour <span aria-hidden="true">→</span></a></footer>
    </main>
  );
}
