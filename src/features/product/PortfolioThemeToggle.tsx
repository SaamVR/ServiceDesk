"use client";

import { useSyncExternalStore } from "react";
import {
  oppositePortfolioTheme, PORTFOLIO_THEME_EVENT, PORTFOLIO_THEME_KEY,
  type PortfolioTheme,
} from "./portfolio-theme";
import styles from "./PortfolioThemeToggle.module.css";

function subscribe(callback: () => void) {
  window.addEventListener(PORTFOLIO_THEME_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(PORTFOLIO_THEME_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getClientTheme(): PortfolioTheme {
  return document.documentElement.dataset.portfolioTheme === "dark" ? "dark" : "light";
}

function getServerTheme(): PortfolioTheme {
  return "light";
}

export function PortfolioThemeToggle({ compact = false }: { compact?: boolean }) {
  const theme = useSyncExternalStore(subscribe, getClientTheme, getServerTheme);
  const dark = theme === "dark";

  function toggleTheme() {
    const next = oppositePortfolioTheme(theme);
    document.documentElement.dataset.portfolioTheme = next;
    try { window.localStorage.setItem(PORTFOLIO_THEME_KEY, next); } catch { /* Private mode: session-only theme. */ }
    window.dispatchEvent(new Event(PORTFOLIO_THEME_EVENT));
  }

  return (
    <button
      className={styles.toggle}
      data-compact={compact}
      type="button"
      onClick={toggleTheme}
      aria-pressed={dark}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
    >
      <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {dark ? <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
        </> : <path d="M20.9 13.3A9 9 0 0 1 10.7 3.1 9 9 0 1 0 20.9 13.3Z" />}
      </svg>
      <span>{dark ? "Light" : "Dark"}</span>
    </button>
  );
}
