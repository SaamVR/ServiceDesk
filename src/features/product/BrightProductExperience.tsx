import Link from "next/link";
import type { StaticProductPageKind } from "./StaticProductPage";
import { ConsultationPlanner, IntegrationExplorer, QuoteExplorer, WorkflowExplorer } from "./BrightPageInteractions";
import styles from "./BrightProductPages.module.css";

type Page = "features" | "cleaning" | "integrations" | "pricing" | "contact" | "help" | "privacy" | "terms";

const pageIdentity: Record<Page, { overline: string; tagline: string; note: string; accent: string }> = {
  features: {
    overline: "ONE CLEANER WAY TO WORK",
    tagline: "Everything connected. Nothing lost between the handoffs.",
    note: "Explore the operational flow",
    accent: "FEATURES / 01",
  },
  cleaning: {
    overline: "BUILT AROUND THE REAL CLEAN",
    tagline: "The details behind a beautifully delivered service.",
    note: "A practical cleaning workflow",
    accent: "SOLUTIONS / 02",
  },
  integrations: {
    overline: "YOUR TOOLS, WITH CLEAR BOUNDARIES",
    tagline: "Connections should make work feel simpler—not more uncertain.",
    note: "See the readiness approach",
    accent: "INTEGRATIONS / 03",
  },
  pricing: {
    overline: "CLEAR QUOTES, CLEAR EXPECTATIONS",
    tagline: "A better way to price the work, with every decision explained.",
    note: "Explore an illustrative quote",
    accent: "SERVICE PRICING / 04",
  },
  contact: {
    overline: "LET'S TALK ABOUT YOUR WORKDAY",
    tagline: "Better systems start with understanding the real work.",
    note: "Prepare your conversation",
    accent: "LET'S CONNECT / 05",
  },
  help: {
    overline: "SERVICE, SUPPORT & CLARITY",
    tagline: "Find the next step without getting lost in the system.",
    note: "Explore practical help topics",
    accent: "HELP / 06",
  },
  privacy: {
    overline: "PEOPLE. DATA. TRUST.",
    tagline: "A cleaner operational record needs clearer boundaries.",
    note: "Understand data and authority",
    accent: "PRIVACY / 07",
  },
  terms: {
    overline: "HONEST PRODUCT BOUNDARIES",
    tagline: "Know what's included, verified and still being prepared.",
    note: "Understand the product's limits",
    accent: "TERMS / 08",
  },
};

function RightArrow() {
  return <span aria-hidden="true">↗</span>;
}

function SectionTitle({ label, title, description, id }: { label: string; title: string; description: string; id?: string }) {
  return (
    <div className={styles.sectionHeading}>
      <span className={styles.eyebrow}>{label}</span>
      <h2 id={id}>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function FeaturesVisual() {
  const rows = [
    ["New request", "Needs review", "01"],
    ["Quote prepared", "Staff approval", "02"],
    ["Visit scheduled", "Capacity check", "03"],
  ] as const;
  return (
    <div className={styles.featureVisual} aria-label="Illustrative request-to-visit workboard">
      <div className={styles.visualToolbar}>
        <span className={styles.visualLogo}>✳</span>
        <div><strong>Today&apos;s workspace</strong><small>Connected operations · example</small></div>
        <span className={styles.exampleBadge}>SAMPLE</span>
      </div>
      <div className={styles.visualTitle}><span>WORK THAT NEEDS ATTENTION</span><strong>Know the next step.</strong></div>
      <div className={styles.visualRows}>
        {rows.map(([title, state, num]) => (
          <div className={styles.visualRow} key={num}>
            <span className={styles.visualNumber}>{num}</span>
            <span><strong>{title}</strong><small>{state}</small></span>
            <span aria-hidden="true">↗</span>
          </div>
        ))}
      </div>
      <div className={styles.visualFooter}><span className={styles.indicator} /> Every handoff has an owner</div>
    </div>
  );
}

function CleaningVisual() {
  return (
    <div className={styles.cleaningVisual} aria-label="Bright, tidy home illustrating cleaning-service operations">
      <div className={styles.cleaningPhoto} role="img" aria-label="Naturally lit, spotless contemporary kitchen"/>
      <div className={styles.cleaningPhotoLabel}>A fresh space starts with a clear plan. <RightArrow/></div>
      <div className={styles.cleaningInset} aria-label="Illustrative day-of-service update">
        <span className={styles.eyebrow}>VISIT CONTEXT</span>
        <strong>Team ready for the day</strong>
        <span>Schedule · Checklist · Job notes</span>
      </div>
    </div>
  );
}

function IntegrationsVisual() {
  return (
    <div className={styles.integrationVisual} aria-label="Illustrative integration control system">
      <div className={styles.networkCentre}><span>✳</span><strong>ServiceDesk</strong><small>THE OPERATIONS DESK</small></div>
      <div className={styles.networkNodes}>
        <div className={styles.networkNode}><span>01</span><strong>Messages</strong><small>Verified delivery</small></div>
        <div className={styles.networkNode}><span>02</span><strong>Calendar</strong><small>Fresh availability</small></div>
        <div className={styles.networkNode}><span>03</span><strong>Payments</strong><small>Reconciled state</small></div>
        <div className={styles.networkNode}><span>04</span><strong>AI drafts</strong><small>Human control</small></div>
      </div>
      <p className={styles.networkDisclaimer}>Illustrative provider architecture · live connection proof not implied</p>
    </div>
  );
}

function PricingVisual() {
  return (
    <div className={styles.pricingVisual} aria-label="Example service quote with transparent total and deposit">
      <div className={styles.pricingVisualTop}><span>✳</span><span>ILLUSTRATIVE SERVICE QUOTE</span></div>
      <span className={styles.pricingMini}>MOVE-OUT CLEAN · EXAMPLE ONLY</span>
      <strong className={styles.pricingVisualTotal}>$340<span> / sample quote</span></strong>
      <div className={styles.pricingVisualLine}><span>Deposit example</span><strong>$85</strong></div>
      <div className={styles.pricingVisualLine}><span>Remaining balance</span><strong>$255</strong></div>
      <div className={styles.pricingVisualBottom}>Rule-based quote <span>→</span> Human review</div>
      <p>Not a subscription plan, real customer price or payment receipt.</p>
    </div>
  );
}

function ContactVisual() {
  const prompts = ["How do enquiries arrive?", "Who approves your quotes?", "Where do your handoffs slow down?"] as const;
  return (
    <div className={styles.contactVisual} aria-label="An illustrative cleaning workflow conversation">
      <span className={styles.eyebrow}>A WORKFLOW CONVERSATION</span>
      <h3>Let&apos;s start with a day in your business.</h3>
      <ol>{prompts.map((prompt, i) => <li key={prompt}><span>0{i + 1}</span><strong>{prompt}</strong><span aria-hidden="true">↗</span></li>)}</ol>
      <p>We&apos;ll use these questions as a guide—not pretend a meeting is already booked.</p>
    </div>
  );
}

function SimpleVisual({ kind }: { kind: "help" | "privacy" | "terms" }) {
  const items = kind === "help"
    ? ["Find your starting point", "Understand a status", "See the next safe action"]
    : kind === "privacy"
      ? ["Workspace isolation", "Role-controlled access", "Provider data boundaries"]
      : ["Defined product scope", "Clear provider states", "Verified before launch"];
  return (
    <div className={styles.simpleVisual} aria-label={kind + " overview"}>
      <span className={styles.simpleVisualMark} aria-hidden="true">✳</span>
      <div className={styles.simpleVisualRule}/>
      <ol>{items.map((item, i) => <li key={item}><span>0{i + 1}</span>{item}<span aria-hidden="true">✓</span></li>)}</ol>
      <p>Clear information matters as much as a clear interface.</p>
    </div>
  );
}

function HeroArt({ kind }: { kind: Page }) {
  switch (kind) {
    case "features": return <FeaturesVisual />;
    case "cleaning": return <CleaningVisual />;
    case "integrations": return <IntegrationsVisual />;
    case "pricing": return <PricingVisual />;
    case "contact": return <ContactVisual />;
    default: return <SimpleVisual kind={kind} />;
  }
}

function Hero({ kind, title, description }: { kind: Page; title: string; description: string }) {
  const identity = pageIdentity[kind];
  return (
    <section className={styles.hero + " " + styles["hero_" + kind]} id="public-main-content" tabIndex={-1} aria-labelledby="bright-product-heading">
      <div className={styles.heroText}>
        <div className={styles.eyebrow}><span className={styles.heroStar} aria-hidden="true">✳</span>{identity.overline}</div>
        <h1 id="bright-product-heading">{title}</h1>
        <p className={styles.heroLead}>{description}</p>
        <div className={styles.heroActions}>
          <Link data-public-primary className={styles.primaryCta} href={kind === "contact" ? "/tour" : kind === "help" ? "/contact" : "#details"}>{identity.note}<RightArrow/></Link>
          <Link data-public-secondary className={styles.secondaryCta} href={kind === "contact" ? "/features" : "/tour"}>{kind === "contact" ? "Explore the platform" : "Product tour"} <span aria-hidden="true">→</span></Link>
        </div>
        <div className={styles.heroFoot}><span className={styles.smallCircles} aria-hidden="true"><i/><i/><i/></span>{identity.accent} · Thoughtfully intelligent, human-controlled.</div>
      </div>
      <div data-public-hero className={styles.heroArt}><HeroArt kind={kind}/></div>
    </section>
  );
}

function FeaturesSections() {
  const capabilities = [
    ["01 / INBOX", "Good conversations make great service.", "Every customer request, missing detail and follow-up stays in one place."],
    ["02 / QUOTES", "Give every price its reason.", "Keep configured rates, quote versions, deposits and review responsibilities clear."],
    ["03 / DISPATCH", "A calmer, better-coordinated day.", "Give the office and field team the schedule, context and next action they need."],
    ["04 / QUALITY", "Care continues after the clean.", "Capture job proof, customer feedback, invoice status and recovery work together."],
  ] as const;
  return (
    <>
      <section className={styles.section + " " + styles.whiteSection} id="details" aria-labelledby="features-workflow-title">
        <div className={styles.sectionContainer}>
          <SectionTitle id="features-workflow-title" label="A CONNECTED WORKDAY" title="From the first hello to the finishing touch." description="Explore the responsibilities and decisions behind one beautifully run cleaning operation." />
          <WorkflowExplorer />
        </div>
      </section>
      <section className={styles.section + " " + styles.softSection} aria-labelledby="features-benefits-title">
        <div className={styles.sectionContainer}>
          <div className={styles.splitTitle}><h2 id="features-benefits-title">More clarity at every handoff.</h2><p>Not four disconnected apps. One thoughtful way to stay on top of the work that matters.</p></div>
          <div className={styles.capabilityGrid}>
            {capabilities.map(([eyebrow, title, description]) => (
              <article className={styles.capabilityCard} key={eyebrow}>
                <span className={styles.eyebrow}>{eyebrow}</span><h3>{title}</h3><p>{description}</p><span aria-hidden="true" className={styles.cardArrow}>↗</span>
              </article>
            ))}
          </div>
        </div>
      </section>
      <WideCallout label="SMART, WITH GUARDRAILS" title="AI helps with the routine. Your team makes the calls." description="Drafting, organizing and surfacing context can be assisted. Pricing, permissions, customer sends and bookings remain controlled by verified rules and human approval." href="/integrations" link="How integrations work" />
    </>
  );
}

function CleaningSections() {
  const steps = [
    ["Enquiry", "An actual service request, captured clearly"],
    ["Quote", "Pricing and timing ready for staff review"],
    ["Schedule", "Capacity and calendar freshness checked"],
    ["On site", "Checklist, notes and completion proof"],
    ["Aftercare", "Invoice, feedback and recurring work"],
  ] as const;
  return (
    <>
      <section className={styles.section + " " + styles.whiteSection} id="details" aria-labelledby="cleaning-story-title">
        <div className={styles.sectionContainer + " " + styles.cleaningStory}>
          <div className={styles.photoFrame} role="img" aria-label="Naturally lit, freshly cleaned home interior"/>
          <div className={styles.cleaningStoryText}>
            <SectionTitle id="cleaning-story-title" label="MADE FOR REAL CLEANING TEAMS" title="A thoughtful service needs a thoughtful system." description="Every detail—from arrival notes to customer preferences—deserves to move smoothly between the office, the cleaner and the customer."/>
            <p>Instead of losing context across messages and calendars, the people doing the work can focus on delivering it well.</p>
            <Link className={styles.textLink} href="/features">Explore the operations platform <RightArrow/></Link>
          </div>
        </div>
      </section>
      <section className={styles.section + " " + styles.turquoiseSection} aria-labelledby="cleaning-flow-title">
        <div className={styles.sectionContainer}>
          <div className={styles.splitTitle}><h2 id="cleaning-flow-title">How a clean moves from enquiry to aftercare.</h2><p>Each step is connected to a record and a human decision, not an invisible automatic promise.</p></div>
          <ol className={styles.verticalSteps}>
            {steps.map(([title, detail], i) => <li key={title}><span>0{i + 1}</span><strong>{title}</strong><p>{detail}</p><span aria-hidden="true">↗</span></li>)}
          </ol>
        </div>
      </section>
      <WideCallout label="BETTER SERVICE, BEHIND THE SCENES" title="Give your team more room to do great work." description="One view of the customer, one schedule to coordinate and clear follow-through when the service is complete." href="/tour" link="Take a product tour" />
    </>
  );
}

function IntegrationsSections() {
  return (
    <>
      <section className={styles.section + " " + styles.whiteSection} id="details" aria-labelledby="integration-explore-title">
        <div className={styles.sectionContainer}>
          <SectionTitle id="integration-explore-title" label="CLEAR CONNECTIONS" title="Know exactly what a connection is doing." description="Explore how messaging, calendars, payment events and AI assistance fit into cleaning operations without overstating their release status." />
          <IntegrationExplorer />
        </div>
      </section>
      <section className={styles.section + " " + styles.softSection} aria-labelledby="integration-honesty-title">
        <div className={styles.sectionContainer + " " + styles.integrationPrinciples}>
          <div><span className={styles.eyebrow}>VERIFIED BEFORE RELIED ON</span><h2 id="integration-honesty-title">Confidence comes from real receipts.</h2></div>
          <div className={styles.principleRows}>
            <p><strong>Connected</strong><span>Credentials and permissions are configured for the right workspace.</span></p>
            <p><strong>Verified</strong><span>Callbacks, delivery and failure paths have actual tested evidence.</span></p>
            <p><strong>Ready</strong><span>Operators have approved a safe, auditable launch mode.</span></p>
          </div>
        </div>
      </section>
      <WideCallout label="THOUGHTFUL AUTOMATION" title="Let systems coordinate. Keep people in charge." description="External provider states remain explicit, and AI recommendations never become unreviewed business decisions." href="/features" link="Explore platform features" />
    </>
  );
}

function PricingSections() {
  return (
    <>
      <section className={styles.section + " " + styles.whiteSection} id="details" aria-labelledby="pricing-example-heading">
        <div className={styles.sectionContainer + " " + styles.pricingBreakdown}>
          <div><SectionTitle id="pricing-example-heading" label="A QUOTE YOU CAN EXPLAIN" title="Thoughtful pricing, without the guesswork." description="Your cleaning business sets the rates. ServiceDesk keeps the service, scope, timing, deposit and balance visible for staff review."/>
            <p className={styles.smallCopy}>This is a cleaning-service quote illustration—not a ServiceDesk subscription offer. No real charge or account is created when exploring it.</p>
          </div>
          <QuoteExplorer />
        </div>
      </section>
      <section className={styles.section + " " + styles.softSection} aria-labelledby="pricing-safeguards-title">
        <div className={styles.sectionContainer}>
          <div className={styles.splitTitle}><h2 id="pricing-safeguards-title">Designed for consistency and care.</h2><p>Keep a transparent record of what was priced, what changed and who approved it.</p></div>
          <div className={styles.threeGrid}>
            <article><span>01</span><h3>Configured rates</h3><p>Actual amounts come from each business&apos;s approved rules—not AI-generated prices.</p></article>
            <article><span>02</span><h3>Visible revisions</h3><p>Changes and approvals are versioned so the team has a clear source of truth.</p></article>
            <article><span>03</span><h3>Reconciled payments</h3><p>A payment is complete only when a verified event supports that status.</p></article>
          </div>
        </div>
      </section>
      <WideCallout label="FROM QUOTE TO CLEAN" title="Make the whole journey feel easier." description="A predictable service quote is just the beginning. Explore how the request, booking, crew and invoice remain connected." href="/tour" link="Explore the product tour" />
    </>
  );
}

function ContactSections() {
  return (
    <>
      <section className={styles.section + " " + styles.whiteSection} id="details" aria-labelledby="contact-discussion-title">
        <div className={styles.sectionContainer + " " + styles.contactLayout}>
          <div className={styles.contactCopy}>
            <SectionTitle id="contact-discussion-title" label="A USEFUL FIRST CONVERSATION" title="Tell us about the work—not a sales pitch." description="A meaningful product review starts with the channels, teams and processes you already have."/>
            <div className={styles.contactTopics}>
              <p><span>01</span> Your core cleaning services and pricing rules</p>
              <p><span>02</span> Your dispatch, crew and customer handoffs</p>
              <p><span>03</span> The places follow-up and payment work gets stuck</p>
            </div>
            <Link className={styles.textLink} href="/tour">Explore the self-guided product tour <RightArrow/></Link>
          </div>
          <ConsultationPlanner />
        </div>
      </section>
      <section className={styles.section + " " + styles.softSection} aria-labelledby="contact-first-heading">
        <div className={styles.sectionContainer + " " + styles.smallFeatureBanner}>
          <div><span className={styles.eyebrow}>START ANYWHERE</span><h2 id="contact-first-heading">Your best next step can be a simple walkthrough.</h2><p>The interactive tour uses only sample records and does not require payment, provider credentials or a production workspace.</p></div>
          <Link className={styles.primaryCta} href="/tour">Open the product tour <RightArrow/></Link>
        </div>
      </section>
    </>
  );
}

const helpTopics = [
  ["Getting started", "Workspace identity, staff roles, services and your first request."],
  ["Daily operations", "Inbox, quotes, scheduling, jobs, invoices, quality and recovery queues."],
  ["Connected services", "Configuration, sandbox, verification and operator-required actions."],
  ["Account access", "Existing-user sign-in, invitations and safe password recovery."],
] as const;

function HelpSections() {
  return (
    <section className={styles.section + " " + styles.whiteSection} id="details" aria-labelledby="help-topics-heading">
      <div className={styles.sectionContainer}>
        <SectionTitle id="help-topics-heading" label="HELP WITHOUT THE HUNT" title="Find the operational answer quickly." description="Practical starting points for teams running a real cleaning operation." />
        <div className={styles.faqList}>
          {helpTopics.map(([title, description]) => <details key={title}><summary>{title}<span aria-hidden="true">＋</span></summary><p>{description}</p></details>)}
        </div>
        <Link className={styles.textLink} href="/contact">Bring your workflow to a walkthrough <RightArrow/></Link>
      </div>
    </section>
  );
}

function LegalSections({ kind }: { kind: "privacy" | "terms" }) {
  return (
    <section className={styles.section + " " + styles.whiteSection} id="details" aria-labelledby="legal-boundaries-heading">
      <div className={styles.sectionContainer + " " + styles.legalLayout}>
        <div>
          <span className={styles.eyebrow}>PRODUCT POLICY & RELEASE CONTROLS</span>
          <h2 id="legal-boundaries-heading">Tenant isolation and clear operational authority.</h2>
          <p>ServiceDesk is designed to keep customer, property, payment and provider records within an authorized workspace. Business actions require appropriate staff permissions and verified underlying state.</p>
        </div>
        <div className={styles.legalNotice}>
          <strong>{kind === "privacy" ? "Privacy and access" : "Product terms and readiness"}</strong>
          <p>{kind === "privacy"
            ? "Records are intended to be scoped by tenant, role and branch, while provider integrations respect consent and identity boundaries."
            : "An advertised integration or workflow is not proof of a verified provider connection, real payment, accepted quote or delivered message."}</p>
          <p>Final legal notices must be reviewed against the deploying business entity, jurisdiction, privacy policy and actual operating practices before public launch.</p>
          <Link href="/contact">Product questions <RightArrow/></Link>
        </div>
      </div>
    </section>
  );
}

function WideCallout({ label, title, description, href, link }: {
  label: string; title: string; description: string; href: string; link: string;
}) {
  return (
    <section className={styles.wideCallout} aria-label={label}>
      <div className={styles.sectionContainer + " " + styles.calloutInner}>
        <div><span className={styles.eyebrow}>{label}</span><h2>{title}</h2><p>{description}</p></div>
        <Link className={styles.primaryCta} href={href}>{link}<RightArrow/></Link>
      </div>
    </section>
  );
}

export function BrightProductExperience({
  kind, title, description,
}: { kind: StaticProductPageKind; title: string; description: string }) {
  const page = kind as Page;
  return (
    <div className={styles.experience} data-bright-page={page}>
      <Hero kind={page} title={title} description={description} />
      {page === "features" && <FeaturesSections />}
      {page === "cleaning" && <CleaningSections />}
      {page === "integrations" && <IntegrationsSections />}
      {page === "pricing" && <PricingSections />}
      {page === "contact" && <ContactSections />}
      {page === "help" && <HelpSections />}
      {(page === "privacy" || page === "terms") && <LegalSections kind={page} />}
    </div>
  );
}
