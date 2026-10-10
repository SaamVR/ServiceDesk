import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./RegistrationShell.module.css";

export function RegistrationShell({
  eyebrow, title, description, asideTitle, asideItems, children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  asideTitle: string;
  asideItems: string[];
  children: ReactNode;
}) {
  return (
    <main className={styles.root}>
      <div className={styles.pageHeader}>
        <Link href="/" className={styles.brand} aria-label="ServiceDesk AI home">
          <span className={styles.brandMark} aria-hidden="true">s<span>.</span></span>
          <span>ServiceDesk<span className={styles.brandAi}> AI</span></span>
        </Link>
        <Link className={styles.backLink} href="/">Back to website <span aria-hidden="true">↗</span></Link>
      </div>
      <div className={styles.columns}>
        <aside className={styles.story} aria-label="ServiceDesk at a glance">
          <div className={styles.storyInner}>
            <p className={styles.storyKicker}>THE OPERATIONS DESK</p>
            <h2>{asideTitle}</h2>
            <div className={styles.storyRule} />
            <div className={styles.storySteps}>
              {asideItems.map((item, index) => (
                <div className={styles.storyStep} key={item}>
                  <span className={styles.stepIndex}>0{index + 1}</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className={styles.storyBottom}>
              <span className={styles.storyEmblem} aria-hidden="true">↗</span>
              <p>A workspace built for real cleaning operations.</p>
            </div>
          </div>
        </aside>
        <section className={styles.formSide} aria-labelledby="registration-heading">
          <div className={styles.formInner}>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h1 id="registration-heading">{title}</h1>
            <p className={styles.description}>{description}</p>
            <div className={styles.formBody}>{children}</div>
          </div>
        </section>
      </div>
      <footer className={styles.footer}>
        <span>© ServiceDesk AI</span>
        <nav aria-label="Legal">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/help">Help</Link>
        </nav>
      </footer>
    </main>
  );
}
