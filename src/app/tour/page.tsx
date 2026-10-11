import Link from "next/link";
import type { Metadata } from "next";
import { MarketingShell } from "@/components/shell/MarketingShell";
import { tourScenarios } from "@/features/product/story-model";
import styles from "./tour.module.css";

export const metadata: Metadata = {
  title: "See how a little clarity changes the whole workday.",
  description: "See how ServiceDesk connects cleaning enquiries, quotes, schedules, field work and aftercare through transparent, human-reviewed workflows and a local sample sandbox.",
  robots: { index: false, follow: false },
};

const stages = [
  { number: "01", label: "Enquiry", detail: "A customer's cleaning request arrives with context." },
  { number: "02", label: "Quote", detail: "Clear scope, versioned rules and staff review." },
  { number: "03", label: "Schedule", detail: "A real capacity check before a slot is promised." },
  { number: "04", label: "Clean", detail: "Crew instructions, completion notes and proof." },
  { number: "05", label: "Aftercare", detail: "Invoice, feedback and open items stay connected." },
] as const;

const boundaries = [
  ["Real decisions", "Pricing, permissions and send authority belong to verified rules and responsible people."],
  ["Transparent states", "A queued message is not delivered; a checkout is not a paid invoice."],
  ["Respectful automation", "AI can prepare context for staff without quietly booking, charging or replying."],
] as const;

export default function TourPage() {
  return (
    <MarketingShell
      brightEdition
      eyebrow="Explore ServiceDesk AI"
      title="A clearer day for the people behind every clean."
      description="Understand the service journey and explore sample workflows at your own pace."
    >
      <div className={styles.tour}>
        <section className={styles.hero} id="public-main-content" tabIndex={-1} aria-labelledby="tour-title">
          <div className={styles.heroText}>
            <span className={styles.eyebrow}><span aria-hidden="true">✳</span> A SELF-GUIDED LOOK INSIDE SERVICEDESK</span>
            <h1 id="tour-title">See how a little clarity changes <em>the whole workday.</em></h1>
            <p>From a new enquiry to the final follow-up, discover how your cleaning team can keep every detail, decision and handoff in one place.</p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryAction} href="/sandbox">Try the interactive sandbox <span aria-hidden="true">↗</span></Link>
              <Link className={styles.secondaryAction} href="#journey">Explore the journey <span aria-hidden="true">→</span></Link>
            </div>
            <div className={styles.heroDisclosure}><span className={styles.dot} /> Demonstration uses sample data. No real charges, messages or bookings.</div>
          </div>
          <div data-tour-hero className={styles.heroVisual} aria-label="Bright cleaning workspace and illustrative service journey">
            <div className={styles.heroPhoto} role="img" aria-label="A clean, naturally lit white kitchen" />
            <div className={styles.heroCard}>
              <div className={styles.cardHeader}><span className={styles.cardIcon}>✳</span><span><strong>One connected job</strong><small>Illustrative service overview</small></span><span className={styles.cardSample}>SAMPLE</span></div>
              <div className={styles.cardStage}><span>01</span><strong>Request captured</strong><small>Human review</small></div>
              <div className={styles.cardStage}><span>02</span><strong>Quote prepared</strong><small>Versioned pricing</small></div>
              <div className={styles.cardStage}><span>03</span><strong>Team scheduled</strong><small>Capacity checked</small></div>
              <div className={styles.cardNote}><span className={styles.dot}/> Clear ownership at every step</div>
            </div>
          </div>
        </section>

        <section className={styles.stepSection} id="journey" aria-labelledby="journey-heading">
          <div className={styles.container}>
            <span className={styles.eyebrow}>01 / THE CLEANING JOURNEY</span>
            <div className={styles.sectionLead}><h2 id="journey-heading">One lovely clean. <em>Five connected steps.</em></h2><p>For your customers it should feel effortless. Behind the scenes, the right people and information make that possible.</p></div>
            <ol className={styles.stages}>
              {stages.map((item) => (
                <li key={item.number}>
                  <span>{item.number}</span><strong>{item.label}</strong><p>{item.detail}</p><span className={styles.stageArrow} aria-hidden="true">↗</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={styles.scenarios} id="promise" aria-labelledby="scenarios-heading">
          <div className={styles.container}>
            <span className={styles.eyebrow}>02 / SEE THE DIFFERENCE</span>
            <div className={styles.sectionLead}><h2 id="scenarios-heading">The best workflows keep the <em>human touch.</em></h2><p>Three reviewable examples show what the platform is designed to coordinate, and where a person must remain in control.</p></div>
            <div className={styles.scenarioGrid}>
              {tourScenarios.map((scenario, index) => (
                <article key={scenario.id} className={styles.scenarioCard} id={scenario.id}>
                  <span className={styles.scenarioCount}>0{index + 1} / WORKFLOW</span>
                  <h3>{scenario.title}</h3>
                  <p>{scenario.summary}</p>
                  <details>
                    <summary>Explore example steps <span aria-hidden="true">＋</span></summary>
                    <ol>
                      {scenario.steps.map((step) => (
                        <li key={step.label}><strong>{step.label}</strong><p>{step.detail}</p><small>{step.proofBoundary.replaceAll("_", " ")}</small></li>
                      ))}
                    </ol>
                  </details>
                  <span className={styles.scenarioDisclaimer}>Illustrative scenario · no live provider evidence</span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.priceStrip} id="pricing" aria-labelledby="quote-tour-heading">
          <div className={styles.container + " " + styles.quoteInner}>
            <div><span className={styles.eyebrow}>A LITTLE TECHNICAL CLARITY</span><h2 id="quote-tour-heading">A quote you can explain. <em>A job you can trust.</em></h2><p>The example move-out clean uses configured pricing rules and human review. It is not a live price, subscription fee or payment receipt.</p></div>
            <div className={styles.quoteSample} aria-label="Illustrative move-out cleaning quote">
              <small>EXAMPLE SERVICE QUOTE</small><strong>$340</strong><span>Deposit $85 <span aria-hidden="true">·</span> Balance $255</span><small>3 bedrooms · 2 bathrooms · oven add-on</small>
            </div>
          </div>
        </section>

        <section className={styles.trustSection} id="pain" aria-labelledby="trust-title">
          <div className={styles.container}>
            <div className={styles.sectionLead}><div><span className={styles.eyebrow}>THE INTELLIGENCE BEHIND THE SCENES</span><h2 id="trust-title">Smarter assistance. <em>Clearer boundaries.</em></h2></div><p>Being AI-integrated shouldn't mean making promises the system cannot prove.</p></div>
            <div className={styles.boundaryGrid}>
              {boundaries.map(([title,detail],index)=><article key={title}><span>0{index+1}</span><h3>{title}</h3><p>{detail}</p></article>)}
            </div>
          </div>
        </section>

        <section className={styles.close} id="contact" aria-labelledby="tour-close-heading">
          <span className={styles.eyebrow}>EXPLORE IT YOUR WAY</span>
          <h2 id="tour-close-heading">Your next clean day starts with <em>a clearer picture.</em></h2>
          <p>Step through a complete sample job yourself—quote, deposit, visit, invoice and message recovery—without a production account.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/sandbox">Open the interactive sandbox <span aria-hidden="true">↗</span></Link>
            <Link className={styles.secondaryAction} href="/contact">Explore your workflow <span aria-hidden="true">→</span></Link>
          </div>
        </section>
      </div>
    </MarketingShell>
  );
}
