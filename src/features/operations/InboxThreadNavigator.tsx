"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./InboxThreadNavigator.module.css";

/**
 * Lightweight progressive enhancement: previous/next are ordinary links,
 * while J/K add fast triage when focus is not inside an interactive control.
 * No optimistic provider, assignment, or message mutations.
 */
export function InboxThreadNavigator({
  current,
  total,
  previousHref,
  nextHref,
}: {
  current: number;
  total: number;
  previousHref?: string;
  nextHref?: string;
}) {
  const router = useRouter();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key !== "j" && event.key !== "k") return;
      const target = event.target;
      if (target instanceof HTMLElement &&
        (target.isContentEditable || target.closest("input,textarea,select,button,a,summary,[contenteditable],[role=combobox],[role=textbox],[role=dialog]"))) return;
      const href = event.key === "j" ? nextHref : previousHref;
      if (!href) return;
      event.preventDefault();
      router.push(href);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [nextHref, previousHref, router]);

  return (
    <nav className={styles.navigator} aria-label="Conversation navigation">
      <div className={styles.position} aria-live="polite">
        <strong>{current}</strong><span>of {total} in this queue</span>
      </div>
      <span className={styles.hint}>Use J / K to move</span>
      <div className={styles.actions}>
        {previousHref ? (
          <a href={previousHref} aria-keyshortcuts="K" aria-label="Previous conversation (K)">← Previous</a>
        ) : (
          <span className={styles.disabled} aria-label="Beginning of the queue">← Previous</span>
        )}
        {nextHref ? (
          <a href={nextHref} aria-keyshortcuts="J" aria-label="Next conversation (J)">Next →</a>
        ) : (
          <span className={styles.disabled} aria-label="End of the queue">Next →</span>
        )}
      </div>
    </nav>
  );
}
