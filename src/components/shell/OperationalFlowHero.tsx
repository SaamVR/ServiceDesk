import styles from "./MarketingHeroV3.module.css";

const steps = [
  { number: "01", category: "CUSTOMER INTAKE", title: "Never lose the enquiry.", description: "Keep the request, customer and conversation together." },
  { number: "02", category: "PRICING & APPROVAL", title: "Quote with clarity.", description: "Review prices, changes and approvals before sending." },
  { number: "03", category: "SCHEDULING & FIELD WORK", title: "Put the right crew on it.", description: "Connect confirmed visits with a job and its checklist." },
  { number: "04", category: "COLLECTION & FOLLOW-UP", title: "Close the loop.", description: "Follow invoice state, quality issues and next steps." },
] as const;

/**
 * Product capability journey, never fixture customer data or implied provider
 * activity. Domain/payment status remains inside the authenticated workspace.
 */
export function OperationalFlowHero() {
  return (
    <aside className={styles.flowCard} aria-label="Four stages of the cleaning operations workflow">
      <div className={styles.flowHead}>
        <div className={styles.flowProduct}>
          <span className={styles.flowMark} aria-hidden="true">S</span>
          <span>ServiceDesk <strong>Flow</strong></span>
        </div>
        <span className={styles.flowTag}>WORKFLOW OVERVIEW</span>
      </div>

      <p className={styles.flowIntro}>From customer request to completed work.</p>

      <ol className={styles.flowSteps}>
        {steps.map((step, index) => (
          <li className={styles.flowStep} key={step.number}>
            <div className={styles.stepRail} aria-hidden="true">
              <span className={styles.stepNumber}>{step.number}</span>
              {index !== steps.length - 1 ? <span className={styles.stepConnector} /> : null}
            </div>
            <div className={styles.stepBody}>
              <p className={styles.stepCategory}>{step.category}</p>
              <h2>{step.title}</h2>
              <p>{step.description}</p>
            </div>
            <span className={styles.stepArrow} aria-hidden="true">↗</span>
          </li>
        ))}
      </ol>

      <footer className={styles.flowFooter}>
        <span className={styles.flowFooterIcon} aria-hidden="true">✓</span>
        <span>One connected operational journey. Human-approved decisions stay in control.</span>
      </footer>
    </aside>
  );
}
