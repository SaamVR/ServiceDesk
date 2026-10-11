"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import styles from "./StaffRouteBoundary.module.css";

/**
 * The failure route never prints exception messages, digests or customer data.
 * Retry re-runs the protected server boundary; it cannot bypass authentication.
 */
export default function WorkspaceError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { workspace } = useParams<{ workspace: string }>();
  const overviewHref = workspace
    ? "/app/" + encodeURIComponent(workspace) + "/overview"
    : "/auth/select-workspace";

  return (
    <section className={styles.boundary} role="alert" aria-live="assertive">
      <span className={styles.eyebrow}>Workspace interruption</span>
      <h2 className={styles.title}>This workspace did not load</h2>
      <p className={styles.description}>
        This view could not confirm its latest state. If you just submitted a
        payment, crew assignment, or another change, check the saved record
        before repeating that action. Retry the view or return to the overview.
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.action} onClick={() => reset()}>
          Retry this view
        </button>
        <Link className={styles.secondary} href={overviewHref}>Back to overview</Link>
      </div>
    </section>
  );
}
