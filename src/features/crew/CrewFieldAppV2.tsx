import type { CrewJobDetailInput, CrewTodayJobInput } from "./v2-field-models";
import { buildCrewJobDetailView, buildCrewTodayJobs } from "./v2-field-models";
import { crewOfflineCapabilityNotice } from "./sync-state";
import styles from "./CrewFieldAppV2.module.css";

export function CrewTodayV2({
  jobs,
  now,
  timeZone,
  workspaceSlug,
  workspaceName,
}: {
  jobs: readonly CrewTodayJobInput[];
  now: string;
  timeZone: string;
  workspaceSlug?: string;
  workspaceName?: string;
}) {
  const view = buildCrewTodayJobs(jobs, now, timeZone);
  return (
    <section className={styles.shell} aria-labelledby="crew-today-heading">
      <header className={styles.topbar}>
        <div>
          <p className={styles.eyebrow}>{workspaceName ?? "Crew"} · assigned jobs</p>
          <h1 id="crew-today-heading">Today</h1>
          <p className={styles.muted}>Your assigned work for today. Changes are confirmed once they sync.</p>
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
            <a
              className={styles.action}
              href={
                "/crew/jobs/" +
                encodeURIComponent(job.visitId) +
                (workspaceSlug ? "?workspace=" + encodeURIComponent(workspaceSlug) : "")
              }
            >
              {job.nextActionLabel}
            </a>
          </article>
        ))}
      </div>
      <p className={styles.footer}>{crewOfflineCapabilityNotice}</p>
    </section>
  );
}

export function CrewJobDetailV2({
  job,
  timeZone,
  workspaceName,
  transitionAction,
  checklistAction,
  noteAction,
  notice,
  error,
}: {
  job: CrewJobDetailInput;
  timeZone: string;
  workspaceName?: string;
  transitionAction?: (formData: FormData) => Promise<void>;
  checklistAction?: (formData: FormData) => Promise<void>;
  noteAction?: (formData: FormData) => Promise<void>;
  notice?: string;
  error?: string;
}) {
  const view = buildCrewJobDetailView(job, timeZone);
  return (
    <section className={styles.shell} aria-labelledby="crew-job-heading">
      <header className={styles.topbar}>
        <div>
          <p className={styles.eyebrow}>{workspaceName ?? "Crew job"} · Visit {view.visitId}</p>
          <h1 id="crew-job-heading">{view.serviceLabel}</h1>
          <p>{view.timeWindowLabel} · {view.locationLabel}</p>
          {view.customerLabel ? <p className={styles.muted}>{view.customerLabel}</p> : null}
        </div>
        <span className={styles.sync}>{view.syncLabel}</span>
      </header>

      {notice ? <p className={styles.panel} role="status">{notice}</p> : null}
      {error ? <p className={styles.panel} role="alert"><strong>{error}</strong></p> : null}

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
            {view.checklist.map((item) => (
              <li key={item.id}>
                <span>{item.completed ? "Done" : "Pending"} · {item.itemKey}{item.note ? " · " + item.note : ""}</span>
                {checklistAction ? (
                  <form action={checklistAction}>
                    <input type="hidden" name="itemKey" value={item.itemKey} />
                    <input type="hidden" name="completed" value={item.completed ? "false" : "true"} />
                    <input type="hidden" name="expectedVersion" value={view.version} />
                    <button className={styles.action} type="submit">
                      {item.completed ? "Reopen" : "Mark done"}
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
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
          <p>{view.evidenceGate.canSubmitReview ? "Required evidence is ready. You can submit this job for review." : view.evidenceGate.blocker}</p>
          {transitionAction && view.transitionAction ? (
            <form action={transitionAction}>
              <input type="hidden" name="action" value={view.transitionAction} />
              <input type="hidden" name="expectedVersion" value={view.version} />
              <button
                className={styles.action}
                type="submit"
                disabled={view.transitionAction === "SUBMIT_REVIEW" && !view.evidenceGate.canSubmitReview}
              >
                {view.nextActionLabel}
              </button>
            </form>
          ) : null}
          <p className={styles.muted}>After submission, the office reviews and completes the job.</p>
        </article>

        <article className={styles.panel}>
          <p className={styles.label}>Job notes</p>
          {noteAction ? (
            <>
              <form action={noteAction} className={styles.evidence}>
                <input type="hidden" name="kind" value="TIME_MATERIAL_NOTE" />
                <input type="hidden" name="expectedVersion" value={view.version} />
                <label htmlFor="crew-job-note">Add a work note</label>
                <textarea id="crew-job-note" name="note" rows={3} required />
                <button className={styles.action} type="submit">Save note</button>
              </form>
              <form action={noteAction} className={styles.evidence}>
                <input type="hidden" name="kind" value="INCIDENT_NOTE" />
                <input type="hidden" name="expectedVersion" value={view.version} />
                <label htmlFor="crew-incident-note">Report an issue</label>
                <textarea id="crew-incident-note" name="note" rows={3} required />
                <button className={styles.action} type="submit">Report issue</button>
              </form>
            </>
          ) : (
            <p className={styles.muted}>Job notes are unavailable.</p>
          )}
        </article>
      </div>

      <p className={styles.footer}>{crewOfflineCapabilityNotice}</p>
    </section>
  );
}


export function CrewFieldError({ title, message }: { title: string; message: string }) {
  return (
    <section className={styles.shell} aria-labelledby="crew-error-heading">
      <article className={styles.panel}>
        <p className={styles.eyebrow}>Crew workspace</p>
        <h1 id="crew-error-heading">{title}</h1>
        <p>{message}</p>
      </article>
    </section>
  );
}
