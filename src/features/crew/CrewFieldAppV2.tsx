import type { ReactNode } from "react";
import { StatusBadge } from "@/components/product/PagePrimitives";
import type { VisitChecklistItemDTO } from "@/contracts";
import type { CrewJobDetailInput, CrewTodayJobInput } from "./v2-field-models";
import { buildCrewJobDetailView, buildCrewTodayJobs } from "./v2-field-models";
import { crewOfflineCapabilityNotice } from "./sync-state";
import styles from "./CrewFieldAppV2.module.css";

function exceptionLabel(value: "LATE_UNSTARTED" | "SYNC_CONFLICT") {
  return value === "LATE_UNSTARTED" ? "Start time passed" : "Refresh needed";
}

function compactDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Today";
  return new Intl.DateTimeFormat("en", { weekday: "long", month: "short", day: "numeric" }).format(date);
}

function FieldNotice({ children }: { children: ReactNode }) {
  return (
    <div className={styles.fieldNotice}>
      <span aria-hidden="true">i</span>
      <p>{children}</p>
    </div>
  );
}

export function CrewTodayV2({ jobs, now }: { jobs: readonly CrewTodayJobInput[]; now: string }) {
  const view = buildCrewTodayJobs(jobs, now);
  const underway = view.filter((job) => ["En route", "In progress"].includes(job.statusLabel)).length;
  const needsAttention = view.filter((job) => Boolean(job.operationalException)).length;

  return (
    <div className={styles.shell}>
      <header className={styles.todayHeader}>
        <div>
          <p className={styles.eyebrow}>Crew workspace</p>
          <h1>Today</h1>
          <p>{compactDate(now)}</p>
        </div>
        <div className={styles.todaySummary} aria-label="Shift summary">
          <span><strong>{view.length}</strong><small>jobs</small></span>
          <span><strong>{underway}</strong><small>underway</small></span>
          <span className={needsAttention ? styles.summaryWarning : undefined}><strong>{needsAttention}</strong><small>attention</small></span>
        </div>
      </header>

      {view.length === 0 ? (
        <section className={styles.emptyState}>
          <span aria-hidden="true">✓</span>
          <div>
            <h2>No jobs today</h2>
            <p>There are no assigned jobs to show for this workday.</p>
          </div>
        </section>
      ) : (
        <div className={styles.jobs}>
          {view.map((job, index) => (
            <article className={styles.job} key={job.visitId} aria-label={job.serviceLabel}>
              <div className={styles.jobRail} aria-hidden="true">
                <span className={styles.sequence}>{index + 1}</span>
                {index < view.length - 1 ? <span className={styles.sequenceLine} /> : null}
              </div>

              <div className={styles.jobBody}>
                <div className={styles.jobHead}>
                  <div>
                    <p className={styles.time}>{job.timeWindowLabel}</p>
                    <h2>{job.serviceLabel}</h2>
                    <p className={styles.customer}>{job.customerLabel ?? "Customer"}</p>
                    <p className={styles.location}>{job.locationLabel}</p>
                  </div>
                  <div className={styles.badges}>
                    <StatusBadge tone={job.sync.tone}>{job.sync.label}</StatusBadge>
                    <StatusBadge tone="info">{job.statusLabel}</StatusBadge>
                  </div>
                </div>

                {job.operationalException ? (
                  <div className={styles.alert} role="status">
                    <span aria-hidden="true">!</span>
                    <strong>{exceptionLabel(job.operationalException)}</strong>
                  </div>
                ) : null}

                {job.accessNote || job.serviceNote || job.highPriorityNotes.length > 0 ? (
                  <div className={styles.jobNotes}>
                    {job.accessNote ? <p><strong>Access</strong><span>{job.accessNote}</span></p> : null}
                    {job.serviceNote ? <p><strong>Service</strong><span>{job.serviceNote}</span></p> : null}
                    {job.highPriorityNotes.map((note) => <p key={note}><strong>Important</strong><span>{note}</span></p>)}
                  </div>
                ) : null}

                <div className={styles.progressBlock}>
                  <div className={styles.progressHead}>
                    <span>Job progress</span>
                    <strong>{job.progressPercent}%</strong>
                  </div>
                  <progress max={100} value={job.progressPercent} aria-label={`${job.progressPercent}% job progress`} />
                  <div className={styles.progressMeta}>
                    <span>{job.checklistProgressLabel}</span>
                    <span>{job.evidenceProgressLabel}</span>
                  </div>
                </div>

                {job.sync.guidance ? <p className={styles.guidance}>{job.sync.guidance}</p> : null}

                <a className={`${styles.jobAction} app-button-primary`} href={`/crew/jobs/${encodeURIComponent(job.visitId)}`}>
                  <span>{job.nextActionLabel}</span>
                  <span aria-hidden="true">→</span>
                </a>
              </div>
            </article>
          ))}
        </div>
      )}

      <FieldNotice>{crewOfflineCapabilityNotice}</FieldNotice>
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
      <header className={styles.jobDetailHeader}>
        <a className={styles.backLink} href="/crew/today">← Today</a>
        <div className={styles.jobDetailTitle}>
          <div>
            <p className={styles.eyebrow}>Assigned job</p>
            <h1>{view.serviceLabel}</h1>
            <p>{view.customerLabel ?? "Customer"} · {view.timeWindowLabel}</p>
          </div>
          <div className={styles.badges}>
            <StatusBadge tone={view.sync.tone}>{view.sync.label}</StatusBadge>
            <StatusBadge tone="info">{view.statusLabel}</StatusBadge>
          </div>
        </div>
        <div className={styles.addressBar}>
          <span aria-hidden="true">⌖</span>
          <strong>{view.locationLabel}</strong>
        </div>
      </header>

      {view.sync.guidance ? (
        <section className={styles.syncNotice} role={view.sync.refreshRequired ? "alert" : "status"}>
          <div>
            <strong>{view.sync.label}</strong>
            <p>{view.sync.guidance}</p>
          </div>
          <div>{view.sync.refreshRequired ? controls.refresh : view.sync.retryAvailable ? controls.retry : null}</div>
        </section>
      ) : null}

      {(view.accessNotes || view.serviceNotes || view.highPriorityNotes.length > 0) ? (
        <section className={styles.instructionsCard} aria-labelledby="job-instructions-heading">
          <div className={styles.sectionTitle}>
            <p className={styles.sectionEyebrow}>Before you start</p>
            <h2 id="job-instructions-heading">Job instructions</h2>
          </div>
          <div className={styles.instructionsGrid}>
            {view.accessNotes ? <div><span>Access</span><p>{view.accessNotes}</p></div> : null}
            {view.serviceNotes ? <div><span>Service notes</span><p>{view.serviceNotes}</p></div> : null}
            {view.highPriorityNotes.map((note) => <div className={styles.priorityInstruction} key={note}><span>Important</span><p>{note}</p></div>)}
          </div>
        </section>
      ) : null}

      <div className={styles.detailGrid}>
        <section className={styles.fieldCard} aria-labelledby="progress-heading">
          <div className={styles.sectionTitle}>
            <p className={styles.sectionEyebrow}>Progress</p>
            <h2 id="progress-heading">Job status</h2>
          </div>
          <ol className={styles.timeline}>
            {view.timeline.map((step) => (
              <li className={step.current ? styles.currentStep : step.reached ? styles.reachedStep : ""} key={step.status}>
                <span aria-hidden="true" />
                <strong>{step.label}</strong>
              </li>
            ))}
          </ol>
          <dl className={styles.detailList}>
            <div><dt>Time</dt><dd>{view.dateLabel} · {view.timeWindowLabel}</dd></div>
            <div><dt>Time zone</dt><dd>{view.timeZoneLabel}</dd></div>
          </dl>
        </section>

        <section className={styles.fieldCard} aria-labelledby="checklist-heading">
          <div className={styles.sectionTitleWithMeta}>
            <div>
              <p className={styles.sectionEyebrow}>Checklist</p>
              <h2 id="checklist-heading">Work to complete</h2>
            </div>
            <span>{view.checklistProgressLabel}</span>
          </div>
          {view.checklist.length === 0 ? (
            <p className={styles.muted}>No checklist items have been saved yet.</p>
          ) : (
            <ul className={styles.checklist}>
              {view.checklist.map((item) => (
                <li className={item.completed ? styles.checklistDone : undefined} key={item.id}>
                  <span className={styles.checkMark} aria-hidden="true">{item.completed ? "✓" : ""}</span>
                  <span className={styles.checkCopy}>
                    <strong>{item.itemKey}</strong>
                    {item.note ? <small>{item.note}</small> : null}
                  </span>
                  {controls.renderChecklistControl ? controls.renderChecklistControl(item) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.fieldCard} aria-labelledby="evidence-heading">
          <div className={styles.sectionTitleWithMeta}>
            <div>
              <p className={styles.sectionEyebrow}>Evidence</p>
              <h2 id="evidence-heading">Before & after</h2>
            </div>
            {controls.evidence}
          </div>
          <div className={styles.evidenceGrid}>
            <div className={view.evidenceGate.beforeEvidencePresent ? styles.evidenceDone : undefined}>
              <span className={styles.evidenceIcon} aria-hidden="true">{view.evidenceGate.beforeEvidencePresent ? "✓" : "1"}</span>
              <span><strong>Before photo</strong><small>{view.evidenceGate.beforeEvidencePresent ? "Added" : "Required"}</small></span>
            </div>
            <div className={view.evidenceGate.afterEvidencePresent ? styles.evidenceDone : undefined}>
              <span className={styles.evidenceIcon} aria-hidden="true">{view.evidenceGate.afterEvidencePresent ? "✓" : "2"}</span>
              <span><strong>After photo</strong><small>{view.evidenceGate.afterEvidencePresent ? "Added" : "Required"}</small></span>
            </div>
          </div>
          <p className={styles.muted}>{view.uploadState}</p>
        </section>

        <section className={styles.fieldCard} aria-labelledby="issues-heading">
          <div className={styles.sectionTitleWithMeta}>
            <div>
              <p className={styles.sectionEyebrow}>Help</p>
              <h2 id="issues-heading">Issues</h2>
            </div>
            {controls.reportIssue}
          </div>
          {view.issues.length === 0 ? (
            <p className={styles.muted}>No open issues for this job.</p>
          ) : (
            <ul className={styles.issueList}>
              {view.issues.map((issue) => <li key={issue.id}>{issue.summary}</li>)}
            </ul>
          )}
        </section>
      </div>

      <section className={styles.actionDock} aria-label="Next job action">
        <div>
          <span>Next action</span>
          <strong>{view.nextActionLabel}</strong>
          {view.evidenceGate.blocker ? <small>{view.evidenceGate.blocker}</small> : null}
        </div>
        <div className={styles.actionControl}>
          {controls.transition ?? <span className={styles.muted}>No action available right now.</span>}
        </div>
      </section>

      <FieldNotice>{crewOfflineCapabilityNotice}</FieldNotice>
    </div>
  );
}
