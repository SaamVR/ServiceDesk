import Link from "next/link";
import { OperationalFixtureRoute } from "@/features/operations/OperationalFixtureRoute";
import { TourScenarioList } from "@/features/product/ProductSections";
import styles from "./BrightTour.module.css";

export default function TourPage() {
  return (
    <div className={styles.tour} data-v4-tour>
      <section className={styles.intro} aria-label="Explore ServiceDesk through a guided workflow">
        <div>
          <span className={styles.eyebrow}>AN INSIDE LOOK AT THE WORKDAY</span>
          <p className={styles.introTitle}>Behind every great clean, <em>a more thoughtful workflow.</em></p>
          <p className={styles.introCopy}>
            Take a closer look at how enquiries, quotes, scheduling, crews and follow-ups fit
            together. Explore the connected decisions behind a beautifully run cleaning business.
          </p>
          <div className={styles.introLinks}>
            <Link className={styles.introPrimary} href="/sandbox">Try the interactive sandbox <span aria-hidden="true">↗</span></Link>
            <Link className={styles.introSecondary} href="/features">Explore the platform <span aria-hidden="true">→</span></Link>
          </div>
          <p className={styles.introProof}><span aria-hidden="true" />Sample data throughout · no messages, bookings or payments are sent.</p>
        </div>
        <div data-public-hero className={styles.visual}>
          <div aria-label="Clean Air product tour introduction">
            <span aria-hidden="true" className={styles.visualStar}>✳</span>
            <div className={styles.visualHeading}><small>A MORE CONNECTED DAY</small><strong>One service. Every detail accounted for.</strong></div>
            <div className={styles.stageFlow}>
              <div><span>01 / REQUEST</span><strong>Enquiry captured</strong><small>Needs staff review</small></div>
              <div><span>02 / VISIT</span><strong>Team coordinated</strong><small>Capacity first</small></div>
              <div><span>03 / CARE</span><strong>Follow-up owned</strong><small>Nothing assumed</small></div>
            </div>
            <div className={styles.visualFoot}><span aria-hidden="true" />Real workflow concepts · illustrative example</div>
          </div>
        </div>
      </section>

      <OperationalFixtureRoute
        surface="tour"
        workspaceLabel="ServiceDesk tour"
        title="Controlled tour in an isolated showcase workspace."
        description="The tour uses explicit fixture route data and labels synthetic history. Real-send mode requires a consenting recipient and provider verification."
      />
      <div className="site-shell">
        <section className={"section-card " + styles.sandboxCallout} aria-label="Try the interactive sandbox">
          <div>
            <p className="eyebrow">SELF-GUIDED TEST WORKSPACE</p>
            <h2>Try the entire job lifecycle yourself.</h2>
            <p>Click through a sample quote, deposit, crew assignment, completion and payment. Inject a mock delivery failure and retry without real credentials or customer records.</p>
            <p><strong>Local simulation only:</strong> Nothing is saved or sent to an external provider.</p>
          </div>
          <Link className={styles.introPrimary} href="/sandbox">Open interactive sandbox <span aria-hidden="true">↗</span></Link>
        </section>
        <TourScenarioList />
      </div>
    </div>
  );
}
