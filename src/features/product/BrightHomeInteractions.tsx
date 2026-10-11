"use client";

import { useState, type ReactNode } from "react";
import styles from "./BrightHomeExperience.module.css";

type Story = "inbox" | "schedule" | "followup";
const stories: ReadonlyArray<{ id: Story; label: string; number: string }> = [
  { id: "inbox", label: "Smart inbox", number: "01" },
  { id: "schedule", label: "Scheduling", number: "02" },
  { id: "followup", label: "Follow-ups", number: "03" },
];

const examples: Record<Story, {
  eyebrow: string;
  title: string;
  description: string;
  source: string;
  sourceLabel: string;
  action: string;
  outcome: string;
  status: string;
}> = {
  inbox: {
    eyebrow: "NEW ENQUIRY · INBOX",
    title: "From a message to a clear next step.",
    description: "An assistant can draft context from an inbound enquiry. A team member still checks the details and approves any reply.",
    sourceLabel: "CUSTOMER REQUEST",
    source: "“Can I book a move-out clean for Friday? Two bedrooms, one bathroom.”",
    action: "AI prepares a structured request",
    outcome: "Staff reviews the quote and response",
    status: "Human approval required",
  },
  schedule: {
    eyebrow: "DISPATCH · CAPACITY",
    title: "See the schedule before you promise.",
    description: "Capacity checks and calendar freshness are surfaced to a dispatcher before a slot becomes a real commitment.",
    sourceLabel: "BOOKING REQUEST",
    source: "Friday · Move-out clean · Two bedrooms",
    action: "System checks available capacity",
    outcome: "Dispatcher confirms an eligible slot",
    status: "Availability review required",
  },
  followup: {
    eyebrow: "QUALITY · RECOVERY",
    title: "Nothing important disappears after the clean.",
    description: "Completion, feedback and unsettled invoice states remain visible, with safe follow-up workflows for the team.",
    sourceLabel: "SERVICE RECORD",
    source: "Clean completed · Feedback pending",
    action: "System detects an unresolved follow-up",
    outcome: "Staff chooses the appropriate next action",
    status: "Operator decision required",
  },
};

function Sparkle({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m12 2 1.9 7.1L21 11l-7.1 1.9L12 20l-1.9-7.1L3 11l7.1-1.9L12 2Z" fill="currentColor" />
      <path d="m19 18 .65 2.35L22 21l-2.35.65L19 24l-.65-2.35L16 21l2.35-.65L19 18Z" fill="currentColor" />
    </svg>
  );
}

function FlowCard({ label, children, order, className = "" }: {
  label: string; children: ReactNode; order: string; className?: string;
}) {
  return (
    <div className={styles.interactiveRow + " " + className}>
      <span className={styles.interactiveOrder}>{order}</span>
      <div>
        <span className={styles.interactiveLabel}>{label}</span>
        <div className={styles.interactiveRowText}>{children}</div>
      </div>
    </div>
  );
}

export function BrightHomeInteractions() {
  const [selected, setSelected] = useState<Story>("inbox");
  const example = examples[selected];

  return (
    <section className={styles.aiSection} id="intelligence" aria-labelledby="intelligence-heading">
      <div className={styles.wrap}>
        <div className={styles.aiIntro}>
          <span className={styles.eyebrowLight}><Sparkle size={17} /> AI-ASSISTED OPERATIONS</span>
          <h2 id="intelligence-heading">The smart part should feel <em>effortless.</em></h2>
          <p>Technology works in the background. Your team stays in control of the decisions that matter.</p>
          <div className={styles.aiSafeguard}>
            <span className={styles.safeguardDot} aria-hidden="true" />
            AI assists. People approve. The system records what happened.
          </div>
        </div>

        <div className={styles.interactivePanel}>
          <div className={styles.interactiveTopbar}>
            <span className={styles.windowDots} aria-hidden="true"><i /><i /><i /></span>
            <span>ServiceDesk / Workflow explorer</span>
            <span className={styles.interactivePreview}>INTERACTIVE EXAMPLE</span>
          </div>
          <div className={styles.interactiveTabs} role="group" aria-label="Explore AI-assisted workflow examples">
            {stories.map((story) => (
              <button
                key={story.id}
                type="button"
                aria-pressed={selected === story.id}
                className={styles.interactiveTab}
                onClick={() => setSelected(story.id)}
              >
                <span>{story.number}</span> {story.label}
              </button>
            ))}
          </div>
          <div className={styles.interactiveBody} key={selected} aria-live="polite" aria-atomic="true">
            <div className={styles.interactiveHeading}>
              <div>
                <span className={styles.interactiveEyebrow}>{example.eyebrow}</span>
                <h3>{example.title}</h3>
                <p>{example.description}</p>
              </div>
              <div className={styles.interactiveStatus}><Sparkle size={14} /> Assistant ready</div>
            </div>
            <FlowCard order="01" label={example.sourceLabel}>
              <p>{example.source}</p>
            </FlowCard>
            <div className={styles.flowArrow} aria-hidden="true">↓</div>
            <FlowCard order="02" label="ASSISTED STEP" className={styles.interactiveHighlighted}>
              <span className={styles.assistedIcon}><Sparkle size={17} /></span>
              <strong>{example.action}</strong>
            </FlowCard>
            <div className={styles.flowArrow} aria-hidden="true">↓</div>
            <FlowCard order="03" label="HUMAN CHECK">
              <strong>{example.outcome}</strong>
              <span className={styles.reviewPill}>{example.status}</span>
            </FlowCard>
            <p className={styles.interactiveDisclaimer}>Illustrative interaction. No AI request, booking, message or payment is sent.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
