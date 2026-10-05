import type { ReactNode } from "react";
import { EmptyState, PageHeader, Panel, SectionHeader, StatusBadge } from "@/components/product/PagePrimitives";
import type { VisitChecklistItemDTO } from "@/contracts";
import type { CrewJobDetailInput, CrewTodayJobInput } from "./v2-field-models";
import { buildCrewJobDetailView, buildCrewTodayJobs } from "./v2-field-models";
import { crewOfflineCapabilityNotice } from "./sync-state";
import styles from "./CrewFieldAppV2.module.css";

function exceptionLabel(value: "LATE_UNSTARTED" | "SYNC_CONFLICT") {
  return value === "LATE_UNSTARTED" ? "Start time passed" : "Refresh needed";
}

export function CrewTodayV2({ jobs, now }: { jobs: readonly CrewTodayJobInput[]; now: string }) {
  const view = buildCrewTodayJobs(jobs, now);

  return (
    <div className={styles.shell}>
      <PageHeader
        eyebrow="Crew"
        title="Today"
        description="Your assigned jobs for today. Changes are confirmed once saved."
      />

      {view.length === 0 ? (
        <Panel>
          <EmptyState title="No jobs today" description="There are no assigned jobs to show for this workday." />
        </Panel>
      ) : (
        <div className={styles.jobs}>
          {view.map((job) => (
            <Panel className={styles.job} key={job.visitId} ariaLabel={job.serviceLabel}>
              <div className={styles.jobHead}>
                <div>
                  <p className={styles.time}>{job.dateLabel} · {job.timeWindowLabel}</p>
                  <h2>{job.serviceLabel}</h2>
                  <p className={styles.location}>{job.locationLabel}{job.customerLabel ? ` · ${job.customerLabel}` : ""}</p>
                </div>
                <div className={styles.badges}>
                  <StatusBadge tone={job.sync.tone}>{job.sync.label}</StatusBadge>
                  <StatusBadge tone="info">{job.statusLabel}</StatusBadge>
                </div>
              </div>

              {job.operationalException ? (
                <p className={styles.alert}>{exceptionLabel(job.operationalException)}</p>
              ) : null}

              {job.accessNote || job.serviceNote || job.highPriorityNotes.length > 0 ? (
                <ul className={styles.notes}>
                  {job.accessNote ? <li><strong>Access:</strong> {job.accessNote}</li> : null}
                  {job.serviceNote ? <li><strong>Service:</strong> {job.serviceNote}</li> : null}
                  {job.highPriorityNotes.map((note) => <li key={note}>{note}</li>)}
                </ul>
              ) : null}

              <div className={styles.progressRow}>
                <progress max={100} value={job.progressPercent} aria-label={`${job.progressPercent}% job progress`} />
                <span>{job.checklistProgressLabel}</span>
                <span>{job.evidenceProgressLabel}</span>
              </div>

              {job.sync.guidance ? <p className={styles.guidance}>{job.sync.guidance}</p> : null}

              <a className="app-button-primary" href={`/crew/jobs/${encodeURIComponent(job.visitId)}`}>
                {job.nextActionLabel}
              </a>
            </Panel>
          ))}
        </div>
      )}

      <p className={styles.footer}>{crewOfflineCapabilityNotice}</p>
    </div>
  );
}

export interface CrewJobDetailV2Controls {
  transition?: ReactNode;
  renderChecklistControl?: (item: VisitChecklistItemDTO) => ReactNode;
  evidence?: ReactNode;
  reportIssue?: ReactNode;
  retry?: ReactNode;
  refresh?: ReactNode;
}

export function CrewJobDetailV2({
  job,
  controls = {},
}: {
  job: CrewJobDetailInput;
  controls?: CrewJobDetailV2Controls;
}) {
  const view = buildCrewJobDetailView(job);

  return (
    <div className={styles.shell}>
      <PageHeader
        eyebrow="Job"
        title={view.serviceLabel}
        description={`${view.dateLabel} · ${view.timeWindowLabel} · ${view.locationLabel}`}
        actions={<StatusBadge tone={view.sync.tone}>{view.sync.label}</StatusBadge>}
      />

      {view.sync.guidance ? (
        <Panel className={styles.notice}>
          <div className={styles.noticeRow}>
            <p>{view.sync.guidance}</p>
            {view.sync.refreshRequired ? controls.refresh : view.sync.retryAvailable ? controls.retry : null}
          </div>
        </Panel>
      ) : null}

      <div className={styles.grid}>
        <Panel>
          <SectionHeader title="Job details" description={view.customerLabel} />
          <dl className={styles.detailList}>
            <div><dt>Status</dt><dd>{view.statusLabel}</dd></div>
            <div><dt>Address</dt><dd>{view.locationLabel}</dd></div>
            <div><dt>Time zone</dt><dd>{view.timeZoneLabel}</dd></div>
          </dl>
          {view.accessNotes ? <p><strong>Access:</strong> {view.accessNotes}</p> : null}
          {view.serviceNotes ? <p><strong>Service notes:</strong> {view.serviceNotes}</p> : null}
          {view.highPriorityNotes.length > 0 ? (
            <ul className={styles.notes}>{view.highPriorityNotes.map((note) => <li key={note}>{note}</li>)}</ul>
          ) : null}
        </Panel>

        <Panel>
          <SectionHeader title="Progress" description="Follow the job in order." />
          <ol className={styles.timeline}>
            {view.timeline.map((step) => (
              <li className={step.current ? styles.currentStep : step.reached ? styles.reachedStep : ""} key={step.status}>
                <span aria-hidden="true" />
                <strong>{step.label}</strong>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel>
          <SectionHeader title="Checklist" description={view.checklistProgressLabel} />
          {view.checklist.length === 0 ? (
            <p className={styles.muted}>No checklist items have been saved yet.</p>
          ) : (
            <ul className={styles.checklist}>
              {view.checklist.map((item) => (
                <li key={item.id}>
                  <span aria-hidden="true">{item.completed ? "✓" : "○"}</span>
                  <span>{item.itemKey}{item.note ? ` · ${item.note}` : ""}</span>
                  {controls.renderChecklistControl ? controls.renderChecklistControl(item) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <SectionHeader title="Evidence" description="Before and after photos are required before review." action={controls.evidence} />
          <div className={styles.evidenceGrid}>
            <div>
              <span>Before</span>
              <StatusBadge tone={view.evidenceGate.beforeEvidencePresent ? "success" : "warning"}>
                {view.evidenceGate.beforeEvidencePresent ? "Added" : "Required"}
              </StatusBadge>
            </div>
            <div>
              <span>After</span>
              <StatusBadge tone={view.evidenceGate.afterEvidencePresent ? "success" : "warning"}>
                {view.evidenceGate.afterEvidencePresent ? "Added" : "Required"}
              </StatusBadge>
            </div>
          </div>
          <p className={styles.muted}>{view.uploadState}</p>
        </Panel>

        <Panel>
          <SectionHeader title="Issues" description="Problems already flagged for this job." action={controls.reportIssue} />
          {view.issues.length === 0 ? (
            <p className={styles.muted}>No open issues.</p>
          ) : (
            <ul className={styles.notes}>
              {view.issues.map((issue) => <li key={issue.id}>{issue.summary}</li>)}
            </ul>
          )}
        </Panel>

        <Panel className={styles.actionPanel}>
          <SectionHeader title="Next action" description={view.evidenceGate.blocker} />
          <h2>{view.nextActionLabel}</h2>
          {controls.transition ?? <p className={styles.muted}>No action is available on this screen right now.</p>}
          <p className={styles.muted}>After you send the job for review, dispatch handles completion.</p>
        </Panel>
      </div>

      <p className={styles.footer}>{crewOfflineCapabilityNotice}</p>
    </div>
  );
}
