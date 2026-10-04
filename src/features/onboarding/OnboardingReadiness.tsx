import type { IntegrationStatusDTO, OwnerSettingsSnapshotDTO } from "@/contracts";
import { buildOnboardingReadinessView, buildOnboardingSetupView } from "./view-models";

export function OnboardingReadiness({ settings, integrations = [] }: { settings?: OwnerSettingsSnapshotDTO; integrations?: IntegrationStatusDTO[] }) {
  const readiness = buildOnboardingReadinessView({ settings, integrations });
  const setup = buildOnboardingSetupView({ settings, integrations });
  return <section className="onboarding-readiness" aria-label="Provider onboarding readiness"><div><p className="eyebrow">Readiness · {readiness.overallState}</p><h2>Setup status stays separate from provider proof.</h2><p>{readiness.releaseNote}</p><span className="status-pill attention">{setup.launchLabel}</span></div><div className="card-grid three" aria-label="Owner setup steps">{setup.steps.map((step, index) => <article className="plain-card" key={step.key}><span className={`status-pill ${step.state === "COMPLETE" ? "success" : step.state === "CONFIGURATION_BLOCKED" ? "attention" : "pending"}`}>{index + 1}. {step.state.replaceAll("_", " ")}</span><h3>{step.label}</h3><p>{step.detail}</p></article>)}</div><div className="card-grid two" aria-label="Provider readiness details">{readiness.items.map((item) => <article className="plain-card" key={item.provider}><span className={`status-pill ${item.canClaimLive ? "success" : "pending"}`}>{item.stateLabel}</span><h3>{item.label}</h3><p>{item.detail}</p></article>)}</div></section>;
}
