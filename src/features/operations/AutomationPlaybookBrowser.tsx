"use client";

import { useId, useState } from "react";
import {
  automationPlaybooks, automationPlaybookCategories,
  type AutomationPlaybook,
} from "./automation-playbooks";
import {
  filterAutomationPlaybooks,
  type PlaybookCategoryFilter, type PlaybookSeverityFilter,
} from "./automation-playbook-finder";
import styles from "./AutomationPlaybookBrowser.module.css";

const severityOptions: ReadonlyArray<{ value: PlaybookSeverityFilter; label: string }> = [
  { value: "Any", label: "All review levels" },
  { value: "INFO", label: "Informational" },
  { value: "WARNING", label: "Needs review" },
  { value: "CRITICAL", label: "Critical review" },
];

/** Static internal-only recipes. Selecting one pre-fills the existing owner
 * draft; no event is evaluated, published or executed by this component. */
export function AutomationPlaybookBrowser({ selectedId }: { selectedId?: string }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<PlaybookCategoryFilter>("All");
  const [severity, setSeverity] = useState<PlaybookSeverityFilter>("Any");
  const prefix = useId();
  const choices = filterAutomationPlaybooks(automationPlaybooks, { search, category, severity });
  const selected = automationPlaybooks.find(item => item.id === selectedId);
  const reset = () => { setSearch(""); setCategory("All"); setSeverity("Any"); };
  return <section className={styles.panel} aria-label="Cleaning automation starter playbooks"
    data-testid="automation-playbook-finder">
    <header className={styles.heading}>
      <div>
        <span className={styles.eyebrow}>Explore safe workflow starters</span>
        <h3>Find your next internal automation</h3>
        <p>{automationPlaybooks.length} safe, reviewed draft starters across five persisted events.
          Search never invokes a model or triggers a business action.</p>
      </div>
      <span className={styles.stat}>Draft catalogue · not live rules</span>
    </header>
    {selected ? <p className={styles.selected} role="status">
      <strong>Selected starter:</strong> {selected.name}. Its fields are loaded
      into the existing draft editor below; preview and owner publication are separate steps.
    </p> : null}
    <div className={styles.filters}>
      <label htmlFor={prefix + "-search"}>Search starters
        <input id={prefix + "-search"} type="search" autoComplete="off"
          value={search} maxLength={80}
          onChange={event => setSearch(event.target.value)}
          placeholder="Try quote, incident, deep clean…" />
      </label>
      <label htmlFor={prefix + "-category"}>Workflow area
        <select id={prefix + "-category"} value={category}
          onChange={event => setCategory(event.target.value as PlaybookCategoryFilter)}>
          <option value="All">All categories</option>
          {automationPlaybookCategories.map(category =>
            <option key={category} value={category}>{category}</option>)}
        </select>
      </label>
      <label htmlFor={prefix + "-severity"}>Review level
        <select id={prefix + "-severity"} value={severity}
          onChange={event => setSeverity(event.target.value as PlaybookSeverityFilter)}>
          {severityOptions.map(option =>
            <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <button className={styles.reset} type="button" onClick={reset}
        disabled={!search && category === "All" && severity === "Any"}>
        Clear filters
      </button>
    </div>
    <p className={styles.resultCount} aria-live="polite" aria-atomic="true">
      {choices.length} of {automationPlaybooks.length} draft starters match.
    </p>
    {!choices.length ? <div className={styles.empty} role="status">
      <p>No starter matches those filters. This does not mean an automation ran or failed.</p>
      <button type="button" className={styles.reset} onClick={reset}>Show all starters</button>
    </div> : automationPlaybookCategories.map(category => {
      const matches = choices.filter(item => item.category === category);
      if (!matches.length) return null;
      return <details className={styles.group} key={category}
        open={Boolean(search || severity !== "Any" || category ===
          (selected?.category ?? (category === "Intake" ? "Intake" : "")))}>
        <summary>{category} <span>{matches.length} matching drafts</span></summary>
        <nav className={styles.cards} aria-label={category + " automation recipes"}>
          {matches.map((item: AutomationPlaybook) => <a key={item.id}
            className={item.id === selectedId ? styles.activeCard : styles.card}
            href={"?template=" + encodeURIComponent(item.id)}
            aria-current={item.id === selectedId ? "page" : undefined}>
            <span className={styles.cardTop}>
              <strong>{item.name}</strong><small>{item.severity}</small>
            </span>
            <span>{item.description}</span>
            <span className={styles.cardFoot}>Event: {item.eventType.replaceAll("_", " ")}
              <b>{item.id === selectedId ? "Selected for draft" : "Load draft starter →"}</b>
            </span>
          </a>)}
        </nav>
      </details>;
    })}
    <p className={styles.disclaimer}>Only internal CREATE_ATTENTION draft actions are offered.
      Selecting a starter does not save, preview, publish, send an email/WhatsApp
      message, create a customer booking or charge money.</p>
  </section>;
}
