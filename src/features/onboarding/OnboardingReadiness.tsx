import { sampleIntegrations } from "@/features/operations/sample-data";
import { buildOnboardingReadinessView } from "./view-models";

export function OnboardingReadiness() {
  const view = buildOnboardingReadinessView(sampleIntegrations);

  return (
    <section className="onboarding-readiness" aria-label="Provider onboarding readiness">
      <div>
        <p className="eyebrow">Readiness · {view.overallState}</p>
        <h2>Setup status stays separate from provider proof.</h2>
        <p>{view.releaseNote}</p>
      </div>
      <div className="card-grid two">
        {view.items.map((item) => (
          <article className="plain-card" key={item.provider}>
            <span className={`status-pill ${item.canClaimLive ? "success" : "pending"}`}>{item.stateLabel}</span>
            <h3>{item.label}</h3>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
