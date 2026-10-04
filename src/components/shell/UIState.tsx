import type { UiStateScenario } from "@/features/product/story-model";

export function UIStateCard({ scenario }: { scenario: UiStateScenario }) {
  const toneClass = scenario.tone === "failure" ? "failure" : scenario.tone === "pending" ? "pending" : "neutral";

  return (
    <article className={`state-card ${toneClass}`} aria-live={scenario.ariaLive} aria-atomic="true">
      <div>
        <p className="label">{scenario.state} state</p>
        <h3>{scenario.title}</h3>
        <p>{scenario.detail}</p>
      </div>
      {scenario.actionLabel ? (
        <button className="button-secondary" type="button">
          {scenario.actionLabel}
        </button>
      ) : null}
    </article>
  );
}
