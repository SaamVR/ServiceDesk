import type { CrewJobDetailInput, CrewTodayJobInput } from "./v2-field-models";
import { buildCrewJobDetailView, buildCrewTodayJobs } from "./v2-field-models";
import { crewOfflineCapabilityNotice } from "./sync-state";
import styles from "./CrewFieldAppV2.module.css";

export function CrewTodayV2({ jobs, now }: { jobs: readonly CrewTodayJobInput[]; now: string }) {
  const view = buildCrewTodayJobs(jobs, now);
  return (
    <section className={styles.shell} aria-labelledby="crew-today-heading">
      <header className={styles.topbar}>
        <div>
          <p className={styles.eyebrow}>Crew field app · assigned work only</p>
          <h1 id="crew-today-heading">Today</h1>
          <p className={styles.muted}>Authoritative visit status stays on the server. Local changes are never treated as confirmed until sync succeeds.</p>
        </div>
      </header>
      <div className={styles.jobs}>
        {view.length === 0 ? <article className={styles.panel}><h2>No assigned jobs</h2><p>There are no authorized visit snapshots to show.</p></article> : null}
        {view.map((job) => (
          <article className={styles.job} key={job.visitId}>
            <div className={styles.jobHead}>
              <div><p className={styles.eyebrow}>{job.timeWindowLabel}</p><h2>{job.serviceLabel}</h2></div>
              <span className={styles.sync}>{job.syncLabel}</span>
            </div>
            <p><strong>{job.locationLabel}</strong>{job.customerLabel ? " · " + job.customerLabel : ""}</p>
            <p className={styles.muted}>Status: {job.statusLabel}</p>
            {job.operationalException ? <p className={styles.danger}>Attention: {job.operationalException.replaceAll("_", " ").toLowerCase()}</p> : null}
            {job.highPriorityNotes.length > 0 ? <ul className={styles.notes}>{job.highPriorityNotes.map((note) => <li key={note}>{note}</li>)}</ul> : null}
            <div className={styles.progress} aria-label={job.progressPercent + "% visit progress"}><span style={{ width: job.progressPercent + "%" }} /></div>
            <a className={styles.action} href={"/crew/jobs/" + encodeURIComponent(job.visitId)}>{job.nextActionLabel}</a>
          </article>
        ))}
      </div>
      <p className={styles.footer}>{crewOfflineCapabilityNotice}</p>
    </section>
  );
}

export function CrewJobDetailV2({ job }: { job: CrewJobDetailInput }) {
  const view = buildCrewJobDetailView(job);
  return (
    <section className={styles.shell} aria-labelledby="crew-job-heading">
      <header className={styles.topbar}>
        <div>
          <p className={styles.eyebrow}>Visit {view.visitId} · version {view.version}</p>
          <h1 id="crew-job-heading">{view.serviceLabel}</h1>
          <p>{view.timeWindowLabel} · {view.locationLabel}</p>
          {view.customerLabel ? <p className={styles.muted}>{view.customerLabel}</p> : null}
        </div>
        <span className={styles.sync}>{view.syncLabel}</span>
      </header>

      <div className={styles.grid}>
        <article className={styles.panel}>
          <p className={styles.label}>Job context</p>
          <p>{view.authorizationLabel}</p>
          {view.accessNotes ? <p><strong>Access:</strong> {view.accessNotes}</p> : null}
          {view.serviceNotes ? <p><strong>Service:</strong> {view.serviceNotes}</p> : null}
          {view.highPriorityNotes.length > 0 ? <ul className={styles.notes}>{view.highPriorityNotes.map((note) => <li key={note}>{note}</li>)}</ul> : null}
        </article>

        <article className={styles.panel}>
          <p className={styles.label}>Checklist</p>
          <h2>{view.checklistProgressLabel}</h2>
          <ul className={styles.notes}>
            {view.checklist.map((item) => <li key={item.id}>{item.completed ? "Done" : "Pending"} · {item.itemKey}{item.note ? " · " + item.note : ""}</li>)}
          </ul>
        </article>

        <article className={styles.panel}>
          <p className={styles.label}>Evidence</p>
          <div className={styles.evidence}>
            <div className={styles.statusRow}><span>Before evidence</span><strong>{view.evidenceGate.beforeEvidencePresent ? "Recorded" : "Required"}</strong></div>
            <div className={styles.statusRow}><span>After evidence</span><strong>{view.evidenceGate.afterEvidencePresent ? "Recorded" : "Required"}</strong></div>
          </div>
          <p className={styles.muted}>{view.uploadState}</p>
        </article>

        <article className={styles.panel}>
          <p className={styles.label}>Review handoff</p>
          <h2>{view.nextActionLabel}</h2>
          <p>{view.evidenceGate.canSubmitReview ? "Required evidence is present; server transition may be submitted." : view.evidenceGate.blocker}</p>
          <p className={styles.muted}>Crew cannot mark a visit complete. Dispatcher/owner completion remains authoritative after review.</p>
        </article>
      </div>

      <p className={styles.footer}>{crewOfflineCapabilityNotice}</p>
    </section>
  );
}
