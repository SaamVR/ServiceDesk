"use client";

import { useState } from "react";
import styles from "./BrightProductPages.module.css";

type FeatureStep = "enquiry" | "quote" | "dispatch" | "quality";
const workflowSteps: ReadonlyArray<{
  id: FeatureStep; index: string; label: string; title: string; detail: string; left: string; right: string; tag: string;
}> = [
  { id: "enquiry", index: "01", label: "Enquiry", title: "One request. All the context.", detail: "A question from a customer becomes a structured service request. Missing details stay visible for the team to check.", left: "Inbound enquiry", right: "Request needs review", tag: "Human review" },
  { id: "quote", index: "02", label: "Quote", title: "Pricing with a clear reason.", detail: "Configured rate rules establish amounts, duration and deposits. A team member remains responsible for approving and sending.", left: "Saved request", right: "Versioned quote", tag: "Rule-based" },
  { id: "dispatch", index: "03", label: "Dispatch", title: "A shared plan for the day.", detail: "Schedule freshness and capacity checks help dispatchers avoid double-booking and premature promises.", left: "Accepted service", right: "Crew and visit plan", tag: "Capacity review" },
  { id: "quality", index: "04", label: "Follow-up", title: "The job doesn't end at the door.", detail: "Completion proof, invoices, feedback and unresolved issues stay connected to the same customer record.", left: "Completed visit", right: "Owned follow-up", tag: "Operator action" },
];

type Provider = "whatsapp" | "calendar" | "payments" | "ai";
const providers: ReadonlyArray<{ id: Provider; label: string; name: string; category: string; state: string; detail: string; steps: readonly string[] }> = [
  { id: "whatsapp", label: "Messaging", name: "WhatsApp Cloud API", category: "CUSTOMER CONVERSATIONS", state: "Provider verification pending", detail: "Save the conversation and distinguish queued, provider-accepted, delivered and read outcomes. Never assume that queueing equals delivery.", steps: ["Verify webhook signatures", "Confirm opt-in and role", "Inspect the delivery receipt"] },
  { id: "calendar", label: "Scheduling", name: "Google Calendar", category: "CALENDAR AWARENESS", state: "Provider verification pending", detail: "Calendar freshness, external-busy conflicts and source timestamps matter before a service slot is confirmed.", steps: ["Connect the authorized calendar", "Check freshness and conflicts", "Review the final booking"] },
  { id: "payments", label: "Payments", name: "Stripe sandbox", category: "CHECKOUT AND RECONCILIATION", state: "Sandbox verification required", detail: "Deposit and invoice states are reconciled from verified payment events. A checkout screen is not proof of money received.", steps: ["Test sandbox checkout", "Verify webhook and idempotency", "Reconcile invoice allocation"] },
  { id: "ai", label: "AI assistant", name: "Human-reviewed AI", category: "ASSISTED OPERATIONS", state: "Opt-in and bounded", detail: "Drafts and summaries can help staff move faster, but AI never grants permissions, sets authoritative prices or sends without explicit review.", steps: ["Read persisted context", "Draft a suggestion", "Require operator approval"] },
];

const discussionOptions = [
  "Customer enquiries and follow-up",
  "Pricing and quoting",
  "Scheduling and crew coordination",
  "Invoices and collections",
  "Integrations and AI assistance",
] as const;

export function WorkflowExplorer() {
  const [chosen, setChosen] = useState<FeatureStep>("enquiry");
  const current = workflowSteps.find((step) => step.id === chosen) ?? workflowSteps[0];

  return (
    <div className={styles.explorer} aria-label="Explore the cleaning workflow">
      <div className={styles.explorerTabs} role="group" aria-label="Choose a workflow stage">
        {workflowSteps.map((step) => (
          <button
            className={styles.explorerTab}
            type="button"
            key={step.id}
            aria-pressed={chosen === step.id}
            onClick={() => setChosen(step.id)}
          ><span>{step.index}</span>{step.label}</button>
        ))}
      </div>
      <div className={styles.explorerResult} aria-live="polite" aria-atomic="true">
        <div className={styles.explorerCopy}>
          <span className={styles.miniEyebrow}>THE HANDOFF · {current.index}</span>
          <h3>{current.title}</h3>
          <p>{current.detail}</p>
          <span className={styles.boundaryLabel}>Example sequence · {current.tag}</span>
        </div>
        <div className={styles.explorerDiagram} aria-label="Illustrative operational transition">
          <span className={styles.diagramCard}>{current.left}</span>
          <span className={styles.diagramArrow} aria-hidden="true">→</span>
          <span className={styles.diagramCardStrong}>{current.right}</span>
        </div>
      </div>
      <p className={styles.demoDisclosure}>Interactive explanation only. This does not load customer records or make operational changes.</p>
    </div>
  );
}

export function IntegrationExplorer() {
  const [selected, setSelected] = useState<Provider>("whatsapp");
  const current = providers.find((p) => p.id === selected) ?? providers[0];

  return (
    <div className={styles.integrationExplorer} aria-label="Explore provider readiness">
      <div className={styles.providerTabs} role="group" aria-label="Choose an integration">
        {providers.map((provider) => (
          <button
            className={styles.providerTab}
            key={provider.id}
            type="button"
            aria-pressed={selected === provider.id}
            onClick={() => setSelected(provider.id)}
          >{provider.label}</button>
        ))}
      </div>
      <div className={styles.providerDetail} aria-live="polite" aria-atomic="true">
        <div className={styles.providerInfo}>
          <span className={styles.miniEyebrow}>{current.category}</span>
          <h3>{current.name}</h3>
          <span className={styles.providerState}><span aria-hidden="true" />{current.state}</span>
          <p>{current.detail}</p>
        </div>
        <ol className={styles.providerSteps}>
          {current.steps.map((step, index) => <li key={step}><span>0{index + 1}</span>{step}</li>)}
        </ol>
      </div>
      <p className={styles.demoDisclosure}>Readiness descriptions are product policy, not live connected-provider telemetry.</p>
    </div>
  );
}

export function QuoteExplorer() {
  const [tab, setTab] = useState<"quote" | "safeguards">("quote");
  return (
    <div className={styles.quoteWidget} aria-label="Illustrative cleaning quote">
      <div className={styles.quoteWidgetHead}>
        <div>
          <span className={styles.miniEyebrow}>SAMPLE SERVICE QUOTE</span>
          <strong>Move-out clean</strong>
        </div>
        <span className={styles.sampleTag}>EXAMPLE · NOT LIVE</span>
      </div>
      <div className={styles.quoteTabs} role="group" aria-label="Quote details">
        <button type="button" aria-pressed={tab === "quote"} onClick={() => setTab("quote")}>Quote breakdown</button>
        <button type="button" aria-pressed={tab === "safeguards"} onClick={() => setTab("safeguards")}>Review controls</button>
      </div>
      <div className={styles.quoteBody} aria-live="polite" aria-atomic="true">
        {tab === "quote" ? (
          <>
            <dl className={styles.quoteFacts}>
              <div><dt>Bedrooms / bathrooms</dt><dd>3 / 2</dd></div>
              <div><dt>Add-on</dt><dd>Oven clean</dd></div>
              <div><dt>Service + buffer</dt><dd>240 + 30 min</dd></div>
            </dl>
            <dl className={styles.quoteTotals}>
              <div><dt>Illustrative total</dt><dd>$340</dd></div>
              <div><dt>Deposit example</dt><dd>$85</dd></div>
              <div><dt>Balance example</dt><dd>$255</dd></div>
            </dl>
          </>
        ) : (
          <ul className={styles.reviewControls}>
            <li><span>01</span>Pricing comes from configured, versioned rate rules</li>
            <li><span>02</span>Quote revisions retain explicit approval boundaries</li>
            <li><span>03</span>Payment status requires verified transaction events</li>
            <li><span>04</span>AI suggestions cannot set or charge a price</li>
          </ul>
        )}
      </div>
      <p className={styles.demoDisclosure}>Example cleaning-service pricing only—not a ServiceDesk subscription plan, customer offer or payment receipt.</p>
    </div>
  );
}

export function ConsultationPlanner() {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (value: string, checked: boolean) => {
    setSelected((items) => checked ? [...items, value].slice(0, 5) : items.filter((item) => item !== value));
  };
  return (
    <div className={styles.consultationWidget}>
      <span className={styles.miniEyebrow}>PREPARE YOUR WALKTHROUGH</span>
      <h3>What would you like to improve?</h3>
      <p>Choose the parts of your operation you&apos;d like to examine. The selection stays on this page.</p>
      <div className={styles.consultationChoices}>
        {discussionOptions.map((item) => (
          <label className={styles.consultationChoice} key={item}>
            <input type="checkbox" checked={selected.includes(item)} onChange={(event) => toggle(item, event.currentTarget.checked)}/>
            <span>{item}</span>
          </label>
        ))}
      </div>
      <div className={styles.consultationSummary} aria-live="polite">
        <strong>{selected.length ? `${selected.length} topic${selected.length === 1 ? "" : "s"} selected` : "Start with a real workflow"}</strong>
        <p>{selected.length ? selected.join(" · ") : "Your first enquiry, quote, schedule or payment handoff is a useful starting point."}</p>
      </div>
      <p className={styles.demoDisclosure}>No details are submitted or stored. Visit the tour to explore sample workflows.</p>
    </div>
  );
}
