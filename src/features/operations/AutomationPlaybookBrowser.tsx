"use client";

import { useId, useRef, useState } from "react";
import {
  automationPlaybooks, automationPlaybookCategories,
  type AutomationPlaybook,
} from "./automation-playbooks";
import {
  filterAutomationPlaybooks,
  type PlaybookCategoryFilter, type PlaybookSeverityFilter,
} from "./automation-playbook-finder";
import { reviewFictionalPlaybookSignal, type FictionalPlaybookChoice } from "./automation-playbook-event-whatif";
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
  const [previewId, setPreviewId] = useState("");
  const [whatIf, setWhatIf] = useState<FictionalPlaybookChoice>("UNKNOWN");
  const previewTrigger = useRef<HTMLButtonElement | null>(null);
  const prefix = useId();
  const choices = filterAutomationPlaybooks(automationPlaybooks, { search, category, severity });
  const selected = automationPlaybooks.find(item => item.id === selectedId);
  // Never show an exact-effect panel for a starter no longer visible under
  // the current filters. Filter changes also reset previewId below.
  const preview = choices.find(item => item.id === previewId);
  const simulated = preview ? reviewFictionalPlaybookSignal(preview.id, whatIf) : null;
  const reset = () => {
    setSearch(""); setCategory("All"); setSeverity("Any"); setPreviewId("");
  };
  const closePreview = () => {
    setPreviewId("");
    // Return focus to the originating action, not an element removed
    // by React when the review panel collapses.
    previewTrigger.current?.focus();
  };
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
          onChange={event => { setSearch(event.target.value); setPreviewId(""); }}
          placeholder="Try quote, incident, deep clean…" />
      </label>
      <label htmlFor={prefix + "-category"}>Workflow area
        <select id={prefix + "-category"} value={category}
          onChange={event => {
            setCategory(event.target.value as PlaybookCategoryFilter);
            setPreviewId("");
          }}>
          <option value="All">All categories</option>
          {automationPlaybookCategories.map(category =>
            <option key={category} value={category}>{category}</option>)}
        </select>
      </label>
      <label htmlFor={prefix + "-severity"}>Review level
        <select id={prefix + "-severity"} value={severity}
          onChange={event => {
            setSeverity(event.target.value as PlaybookSeverityFilter);
            setPreviewId("");
          }}>
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
        open={Boolean(search || severity !== "Any" ||
          choices.length < automationPlaybooks.length ||
          category === (selected?.category ?? "Intake"))}>
        <summary>{category} <span>{matches.length} matching drafts</span></summary>
        <nav className={styles.cards} aria-label={category + " automation recipes"}>
          {matches.map((item: AutomationPlaybook) => <div key={item.id} className={styles.cardWrap}>
            <a className={item.id === selectedId ? styles.activeCard : styles.card}
              href={"?template=" + encodeURIComponent(item.id)}
              aria-current={item.id === selectedId ? "page" : undefined}>
              <span className={styles.cardTop}>
                <strong>{item.name}</strong><small>{item.severity}</small>
              </span>
              <span>{item.description}</span>
              <span className={styles.cardFoot}>Event: {item.eventType.replaceAll("_", " ")}
                <b>{item.id === selectedId ? "Selected for draft" : "Load draft starter →"}</b>
              </span>
            </a>
            <button type="button" className={styles.inspect}
              aria-expanded={previewId === item.id}
              aria-controls={previewId === item.id ? prefix + "-exact-starter-review" : undefined}
              onClick={event => {
                previewTrigger.current = event.currentTarget;
                setPreviewId(current => current === item.id ? "" : item.id);
                setWhatIf("UNKNOWN");
              }}>
              {previewId === item.id ? "Hide exact effect" : "Inspect exact effect"}
            </button>
          </div>)}
        </nav>
      </details>;
    })}
    {preview ? <section className={styles.previewPanel}
      id={prefix + "-exact-starter-review"} aria-label="Exact starter rule preview">
      <div className={styles.previewHeading}>
        <div><strong>{preview.name}</strong><span>Static catalogue definition · not a live run</span></div>
        <button type="button" className={styles.inspect} onClick={closePreview}>
          Close exact review
        </button>
      </div>
      <dl>
        <div><dt>Event trigger</dt><dd>{preview.eventType.replaceAll("_", " ")}</dd></div>
        <div><dt>Condition</dt><dd>{preview.condition
          ? `${preview.condition.field} ${preview.condition.operator} ${String(preview.condition.value)}`
          : "No condition (every matching event type)"}</dd></div>
        <div><dt>Internal action</dt><dd>CREATE_ATTENTION · {preview.actionDetail}</dd></div>
        <div><dt>Review severity</dt><dd>{preview.severity}</dd></div>
      </dl>
      <div className={styles.fictionalPanel} aria-label="Fictional event preview">
        <label htmlFor={prefix+"-fictional-event"}>Explore a fictional future event (no automation runs)</label>
        <select id={prefix+"-fictional-event"} value={whatIf}
          onChange={event=>setWhatIf(event.target.value as FictionalPlaybookChoice)}>
          <option value="UNKNOWN">No saved event evidence available</option>
          <option value="EXACT">Imagine an event matching the rule condition</option>
          <option value="DIFFERENT">Imagine an event with a different field value</option>
        </select>
        <p role="status" aria-live="polite" aria-atomic="true">
          {simulated?.ok && simulated.value.match==="MATCHED"
            ? "Hypothetical match: this fixed starter would request an internal attention task after separate owner publication and a real saved future event. No task was created."
            : simulated?.ok && simulated.value.match==="NOT_MATCHED"
              ? "Hypothetical mismatch: no internal action would be planned for the different value."
              : "No event evidence. Unknown cannot be treated as a match or a confirmed negative."}
        </p>
        {simulated?.ok ? <small>{simulated.value.conditionSummary}.
          Internal CREATE_ATTENTION only; no model, provider, payment or persistence.</small> : null}
      </div>
      <p>This describes a possible rule only. Selecting this starter pre-fills
        the existing owner draft form; it does not generate a persisted event,
        run an automation, publish a rule or send a customer message.</p>
      <a href={"?template=" + encodeURIComponent(preview.id)} className={styles.previewLoad}>
        Load this exact starter into the draft editor →
      </a>
    </section> : null}
    <p className={styles.disclaimer}>Only internal CREATE_ATTENTION draft actions are offered.
      Selecting a starter does not save, preview, publish, send an email/WhatsApp
      message, create a customer booking or charge money.</p>
  </section>;
}
