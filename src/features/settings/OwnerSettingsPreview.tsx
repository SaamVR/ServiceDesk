import type { RecurrenceRuleDTO } from "@/contracts";
import { sampleIntegrations, sampleRequest, sampleVisit } from "@/features/operations/sample-data";
import { RecurrenceRulePreview } from "@/features/recurrence/RecurrenceRulePreview";
import {
  buildOwnerSettingsView,
  type ServiceSettingFixture,
  type TeamInviteFixture,
} from "./view-models";

const services: ServiceSettingFixture[] = [
  { code: "MOVE_OUT", label: "Move-out clean", enabled: true, rateVersion: "move-out-v1" },
  { code: "DEEP", label: "Deep clean", enabled: false, rateVersion: "deep-draft" },
];

const invites: TeamInviteFixture[] = [
  { id: "invite_dispatcher_1", role: "DISPATCHER", state: "PENDING", label: "Dispatcher invite" },
  { id: "invite_crew_1", role: "CREW", state: "ACCEPTED", label: "Crew member" },
];

const settingsRecurrenceRule: RecurrenceRuleDTO = {
  id: "rule_settings_monthly_001",
  workspaceId: sampleRequest.workspaceId,
  requestId: sampleRequest.id,
  propertyId: sampleRequest.propertyId ?? "prop_sample",
  frequency: "MONTHLY",
  timezone: "America/New_York",
  localStartTime: "09:00",
  startsOn: "2026-11-01",
  maxOccurrences: 12,
  generatedOccurrences: 1,
  status: "ACTIVE",
  nextOccurrenceOn: "2026-11-01",
  version: 3,
  createdAt: "2026-10-04T06:30:00.000Z",
  updatedAt: "2026-10-04T06:45:00.000Z",
};

export function OwnerSettingsPreview({ embedded = false }: { embedded?: boolean }) {
  const view = buildOwnerSettingsView({ services, invites, integrations: sampleIntegrations });

  const content = (
    <section className="plain-card" aria-label="Owner settings preview">
      <div className="section-heading compact">
        <p className="eyebrow">Owner settings · fixture UI</p>
        <h2>Services, team and provider health stay visible without exposing secrets</h2>
        <p>This preview models owner-controlled configuration only. Credentials, provider secrets and business truth remain server-side.</p>
        <span className="status-pill attention">{view.releaseLabel}</span>
      </div>

      <div className="card-grid three">
        <article className="mini-panel">
          <p className="label">Service catalog</p>
          {view.services.map((service) => (
            <div key={service.code}><h3>{service.label}</h3><p>{service.stateLabel} · {service.rateVersion}</p></div>
          ))}
        </article>

        <article className="mini-panel">
          <p className="label">Team</p>
          {view.team.map((member) => (
            <div key={member.id}><h3>{member.label}</h3><p>{member.role} · {member.stateLabel}</p></div>
          ))}
        </article>

        <article className="mini-panel">
          <p className="label">Integration health</p>
          {view.integrationHealth.map((integration) => (
            <div key={integration.provider}>
              <span className={`status-pill ${integration.ready ? "success" : "pending"}`}>{integration.stateLabel}</span>
              <h3>{integration.provider.replaceAll("_", " ")}</h3>
              <p>{integration.message}</p>
            </div>
          ))}
        </article>
      </div>

      <RecurrenceRulePreview
        rule={settingsRecurrenceRule}
        materializedVisits={[sampleVisit]}
        audience="staff"
        actionsInjected={false}
        sourceLabel="FIXTURE_UI_ONLY"
      />

      <p>Data source: {view.dataSource}. Secrets exposed: {view.exposesSecrets ? "yes" : "no"}.</p>
    </section>
  );

  return embedded ? content : <div className="site-shell">{content}</div>;
}
