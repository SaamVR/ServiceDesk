import Link from "next/link";
import { integrationCards, moveOutFixture } from "@/features/product/story-model";
import styles from "./ProductStoryHero.module.css";

/**
 * Page-specific product explanations, not account fixtures. No live customer,
 * payment, provider or workspace state is fetched or inferred here.
 */
export type ProductStoryHeroKind = "features" | "pricing" | "integrations" | "contact";

const featureLanes = [
  {
    ordinal: "01",
    title: "Capture & qualify",
    summary: "Conversation → saved service request",
    steps: ["Customer identity", "Service details", "Human handover"],
  },
  {
    ordinal: "02",
    title: "Price & approve",
    summary: "Rate rules → versioned quote",
    steps: ["Pricing snapshot", "Staff review", "Quote revision"],
  },
  {
    ordinal: "03",
    title: "Schedule & deliver",
    summary: "Accepted work → field job",
    steps: ["Fresh capacity", "Crew assignment", "Completion evidence"],
  },
  {
    ordinal: "04",
    title: "Collect & recover",
    summary: "Invoice → reconciliation → quality",
    steps: ["Actual balance", "Payment state", "Issue follow-up"],
  },
] as const;

const visitAgenda = [
  {
    step: "01",
    title: "Map your current work",
    description: "Where enquiries arrive, who approves quotes and who schedules the crew",
  },
  {
    step: "02",
    title: "Identify operational friction",
    description: "Lost follow-ups, booking collisions, outstanding invoices and callbacks",
  },
  {
    step: "03",
    title: "Review launch requirements",
    description: "Roles, tenant boundaries, providers and data readiness before activation",
  },
] as const;

function StoryHeader({
  overline,
  title,
  tag,
}: {
  overline: string;
  title: string;
  tag: string;
}) {
  return (
    <div className={styles.header}>
      <span className={styles.brandMark} aria-hidden="true">S</span>
      <div className={styles.brandText}>
        <span className={styles.overline}>{overline}</span>
        <strong>{title}</strong>
      </div>
      <span className={styles.tag}>{tag}</span>
    </div>
  );
}

function FeaturesStory() {
  return (
    <aside className={styles.story} aria-label="Feature workflow from intake through quality">
      <StoryHeader overline="OPERATOR WORKSPACE" title="Work follows one record" tag="WORKFLOW MAP" />
      <p className={styles.intro}>Know what happens next, and who owns it.</p>
      <ol className={styles.featureList}>
        {featureLanes.map((lane) => (
          <li className={styles.featureLane} key={lane.ordinal}>
            <span className={styles.ordinal} aria-hidden="true">{lane.ordinal}</span>
            <div className={styles.featureText}>
              <strong>{lane.title}</strong>
              <span>{lane.summary}</span>
              <div className={styles.chips}>
                {lane.steps.map((step) => <span key={step}>{step}</span>)}
              </div>
            </div>
            <span className={styles.laneArrow} aria-hidden="true">↗</span>
          </li>
        ))}
      </ol>
      <p className={styles.footnote}>Decisions and statuses are stored by the application, not inferred from this illustration.</p>
    </aside>
  );
}

function PricingStory() {
  const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: moveOutFixture.currency, maximumFractionDigits: 0 });
  const amount = (minor: number) => currency.format(minor / 100);
  return (
    <aside className={styles.story} aria-label="Illustrative service quote breakdown, not subscription prices">
      <StoryHeader overline="CONFIGURED RATE RULES" title="Quote preview" tag="EXAMPLE ONLY" />
      <div className={styles.quoteTop}>
        <p className={styles.intro}>Move-out clean</p>
        <span className={styles.quoteSample}>Illustrative · not a live offer</span>
      </div>
      <dl className={styles.quoteBreakdown}>
        <div><dt>Bedrooms</dt><dd>{moveOutFixture.bedrooms}</dd></div>
        <div><dt>Bathrooms</dt><dd>{moveOutFixture.bathrooms}</dd></div>
        <div><dt>Add-on</dt><dd>{moveOutFixture.addOns.join(", ")}</dd></div>
        <div><dt>Service + buffer</dt><dd>{moveOutFixture.serviceMinutes} + {moveOutFixture.bufferMinutes} min</dd></div>
      </dl>
      <dl className={styles.quoteSummary}>
        <div className={styles.quoteTotal}><dt>Illustrative customer quote</dt><dd>{amount(moveOutFixture.totalMinor)}</dd></div>
        <div><dt>Deposit example</dt><dd>{amount(moveOutFixture.depositMinor)}</dd></div>
        <div><dt>Balance example</dt><dd>{amount(moveOutFixture.balanceMinor)}</dd></div>
      </dl>
      <p className={styles.quoteRule}><span aria-hidden="true">✓</span> Actual customer quotes require configured pricing rules and staff authorization.</p>
      <p className={styles.footnote}>Example amounts only. Not ServiceDesk subscription pricing, a payment request or a customer record.</p>
    </aside>
  );
}

function IntegrationsStory() {
  const badges: Record<string, string> = {
    "WhatsApp Cloud API": "Verification pending",
    "Google Calendar": "Verification pending",
    Payments: "Sandbox only",
    "AI assistant": "Human reviewed",
  };
  return (
    <aside className={styles.story} aria-label="Integration readiness categories, not live provider status">
      <StoryHeader overline="PROVIDER READINESS" title="Connection control" tag="STATUS EXPLAINER" />
      <p className={styles.intro}>Configured is not the same as verified.</p>
      <div className={styles.integrationGrid}>
        {integrationCards.map((card) => (
          <div className={styles.integrationItem} key={card.title}>
            <div className={styles.providerName}>
              <span className={styles.providerDot} aria-hidden="true" />
              <strong>{card.title}</strong>
            </div>
            <span className={card.title === "Payments" ? styles.sandbox : styles.pending}>
              {badges[card.title] ?? "Review required"}
            </span>
          </div>
        ))}
      </div>
      <div className={styles.integrationPrinciple}>
        <strong>Release policy</strong>
        <p>Provider receipts, permissions, sandbox boundaries and delivery evidence must be verified before live activation.</p>
      </div>
      <p className={styles.footnote}>Readiness categories are illustrative product policy, not connected provider health telemetry.</p>
    </aside>
  );
}

function ContactStory() {
  return (
    <aside className={styles.story} aria-label="ServiceDesk walkthrough preparation agenda">
      <StoryHeader overline="OPERATIONS WALKTHROUGH" title="A practical conversation" tag="PREPARATION" />
      <p className={styles.intro}>Start with the operation you run today.</p>
      <ol className={styles.agendaList}>
        {visitAgenda.map((item) => (
          <li className={styles.agendaItem} key={item.step}>
            <span className={styles.agendaStep}>{item.step}</span>
            <div>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </div>
          </li>
        ))}
      </ol>
      <Link className={styles.tourLink} href="/tour">
        Explore the product tour <span aria-hidden="true">↗</span>
      </Link>
      <p className={styles.footnote}>This is a preparation guide, not a submitted booking or contact request.</p>
    </aside>
  );
}

export function ProductStoryHero({ kind }: { kind: ProductStoryHeroKind }) {
  switch (kind) {
    case "features": return <FeaturesStory />;
    case "pricing": return <PricingStory />;
    case "integrations": return <IntegrationsStory />;
    case "contact": return <ContactStory />;
  }
}
