import styles from "./StaffRouteBoundary.module.css";

/** Streamed-route fallback; never substitutes fabricated operational data. */
export default function Loading() {
  return (
    <section className={styles.boundary} role="status" aria-busy="true" aria-live="polite">
      <span className={styles.eyebrow}>Workspace</span>
      <h2 className={styles.title}>Preparing your workday</h2>
      <p className={styles.description}>Loading the latest records available to your staff account.</p>
      <span className={styles.srOnly}>Loading authorized workspace information</span>
      <div className={styles.placeholder} aria-hidden="true">
        <div className={styles.placeholderHead} />
        <div className={styles.placeholderLine} />
        <div className={styles.placeholderLine} />
        <div className={styles.placeholderGrid}>
          <div className={styles.placeholderCard} />
          <div className={styles.placeholderCard} />
          <div className={styles.placeholderCard} />
        </div>
      </div>
    </section>
  );
}
