"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { buildStaffRecordSearches, searchStaffDestinations } from "@/features/operations/staff-command-search";
import styles from "./StaffCommandPalette.module.css";

/**
 * The native modal dialog traps focus, restores it on close and supports
 * Escape. The palette navigates ONLY to existing operational routes.
 * Directory searches are navigational deep-links; this dialog never fetches customer data.
 */
export function StaffCommandPalette({ workspace }: { workspace: string }) {
  const [query, setQuery] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const results = useRef<HTMLDivElement>(null);
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
  const recordSearches = buildStaffRecordSearches(workspace, query);
  const close = () => dialog.current?.close();

  function handleSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (!["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) return;
    const anchors = results.current?.querySelectorAll<HTMLAnchorElement>("a[href]");
    if (!anchors?.length) return;
    event.preventDefault();
    if (event.key === "Enter") {
      // Existing trusted Next Link handles route change and authorization.
      anchors[0].click();
    } else {
      anchors[event.key === "ArrowUp" ? anchors.length - 1 : 0].focus();
    }
  }

  function handleResultKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const anchors = Array.from(results.current?.querySelectorAll<HTMLAnchorElement>("a[href]") ?? []);
    const current = (event.target as HTMLElement).closest("a");
    const index = anchors.findIndex((item) => item === current);
    if (index < 0 || !anchors.length) return;
    event.preventDefault();
    if (event.key === "ArrowUp" && index === 0) {
      input.current?.focus();
      return;
    }
    const next = event.key === "Home" ? 0
      : event.key === "End" ? anchors.length - 1
      : event.key === "ArrowDown" ? (index + 1) % anchors.length
      : index - 1;
    anchors[next]?.focus();
  }

  return (
    <>
      <button className={styles.trigger} type="button" onClick={open} aria-haspopup="dialog">
        <span className={styles.searchIcon} aria-hidden="true">⌕</span>
        <span className={styles.triggerLabel}>Find pages or records</span>
        <kbd className={styles.shortcut}>⌘ / Ctrl K</kbd>
      </button>
      <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} onClose={() => setQuery("")}>
        <div className={styles.dialogHeader}>
          <div>
            <p className={styles.eyebrow}>Navigation &amp; record lookup</p>
            <h2 id={titleId}>Find your next action</h2>
          </div>
          <button className={styles.close} type="button" onClick={close} aria-label="Close workspace navigation">×</button>
        </div>
        <label className={styles.searchField}>
          <span className={styles.srOnly}>Find workspace pages or search within authorized records</span>
          <input
            ref={input}
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search pages, customer, request or invoice…"
            autoComplete="off"
            maxLength={100}
          />
        </label>
        <div ref={results} className={styles.results} onKeyDown={handleResultKeyDown} aria-live="polite" aria-label="Workspace destinations">
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
            <p className={styles.empty}>{recordSearches.length
              ? "No matching navigation pages. Search a record directory below."
              : "No matching pages. Try a workflow name such as “quotes” or “jobs”."}</p>
          )}
          {recordSearches.length ? (
            <div className={styles.recordSearchGroup} aria-label="Search authorized workspace records">
              <p className={styles.recordSearchCaption}>Search records · opens an authorized workspace view</p>
              {recordSearches.map(target => (
                <Link key={target.module} href={target.href} className={styles.result} onClick={close}>
                  <span className={styles.resultName}>Find in {target.label}</span>
                  <span className={styles.resultDescription}>Open filtered {target.label.toLowerCase()} in this workspace</span>
                  <span className={styles.resultArrow} aria-hidden="true">↗</span>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
        <p className={styles.dialogFooter}>↑ ↓ to navigate · Enter to open · Esc to close · Search results load only after authorization</p>
      </dialog>
    </>
  );
}
