"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { searchStaffDestinations } from "@/features/operations/staff-command-search";
import styles from "./StaffCommandPalette.module.css";

/**
 * The native modal dialog traps focus, restores it on close and supports
 * Escape. The palette navigates ONLY to existing operational routes.
 * It intentionally makes no assertion about customer data or global search.
 */
export function StaffCommandPalette({ workspace }: { workspace: string }) {
  const [query, setQuery] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const pathname = usePathname();
  const open = useCallback(() => {
    const element = dialog.current;
    if (!element || element.open) return;
    setQuery("");
    element.showModal();
    input.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || (!event.metaKey && !event.ctrlKey) ||
          event.altKey || event.shiftKey) return;
      event.preventDefault();
      open();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    // A route change must dismiss stale navigation and leave focus in the
    // newly active page rather than trapping it behind a modal.
    dialog.current?.close();
  }, [pathname]);

  const matches = searchStaffDestinations(workspace, query);
  const close = () => dialog.current?.close();

  return (
    <>
      <button className={styles.trigger} type="button" onClick={open} aria-haspopup="dialog">
        <span className={styles.searchIcon} aria-hidden="true">⌕</span>
        <span className={styles.triggerLabel}>Jump to a workspace page</span>
        <kbd className={styles.shortcut}>⌘ / Ctrl K</kbd>
      </button>
      <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} onClose={() => setQuery("")}>
        <div className={styles.dialogHeader}>
          <div>
            <p className={styles.eyebrow}>Workspace navigation</p>
            <h2 id={titleId}>Where do you want to go?</h2>
          </div>
          <button className={styles.close} type="button" onClick={close} aria-label="Close workspace navigation">×</button>
        </div>
        <label className={styles.searchField}>
          <span className={styles.srOnly}>Filter workspace pages</span>
          <input
            ref={input}
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Try inbox, dispatch, customers…"
            autoComplete="off"
          />
        </label>
        <div className={styles.results} aria-live="polite" aria-label="Workspace destinations">
          {matches.length ? matches.map(destination => (
            <Link
              key={destination.module}
              href={destination.href}
              onClick={close}
              className={styles.result}
              aria-current={pathname === destination.href ? "page" : undefined}
            >
              <span className={styles.resultName}>{destination.label}</span>
              <span className={styles.resultDescription}>{destination.description}</span>
              <span className={styles.resultArrow} aria-hidden="true">↗</span>
            </Link>
          )) : (
            <p className={styles.empty}>No matching pages. Try a workflow name such as “quotes” or “jobs”.</p>
          )}
        </div>
        <p className={styles.dialogFooter}>Press Esc to close · Results are navigation links, not customer records</p>
      </dialog>
    </>
  );
}
