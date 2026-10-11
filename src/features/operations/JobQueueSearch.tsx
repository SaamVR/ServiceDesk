import { jobsQueueHref, normalizeJobsSearch, type JobsQueue } from "./jobs-queue";
import styles from "./JobQueueSearch.module.css";

export function JobQueueSearch({ queue, search, visible, total }: {
  queue: JobsQueue; search: string; visible: number; total: number;
}) {
  const normalized = normalizeJobsSearch(search);
  return (
    <div className={styles.toolbar}>
      <form method="get" role="search" className={styles.form}>
        <label htmlFor="staff-jobs-search">Find a job</label>
        {queue !== "all" ? <input type="hidden" name="queue" value={queue} /> : null}
        <input id="staff-jobs-search" name="search" type="search"
          defaultValue={normalized} maxLength={90}
          placeholder="Customer, service, crew or status" autoComplete="off" />
        <button type="submit">Search</button>
        {normalized ? <a href={jobsQueueHref(queue)}>Clear</a> : null}
      </form>
      <p role="status">
        {normalized ? `${visible} matching ${visible === 1 ? "job" : "jobs"}` : `${visible} jobs shown`}
        <span> · {total} in this status queue</span>
      </p>
    </div>
  );
}
