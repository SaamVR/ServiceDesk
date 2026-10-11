import type { JobsQueue } from "./jobs-queue";
import { filterJobsQueue, jobsQueueHref, jobsQueueOptions } from "./jobs-queue";
import styles from "./JobQueueFilters.module.css";

export function JobQueueFilters({
  queue,
  visits,
}: {
  queue: JobsQueue;
  visits: readonly { status: string; crewId?: string }[];
}) {
  return (
    <nav className={styles.nav} aria-label="Job status filters">
      {jobsQueueOptions.map((option) => (
        <a
          href={jobsQueueHref(option.key)}
          aria-current={queue === option.key ? "page" : undefined}
          key={option.key}
        >
          {option.label}
          <strong>{filterJobsQueue(visits, option.key).length}</strong>
        </a>
      ))}
    </nav>
  );
}
