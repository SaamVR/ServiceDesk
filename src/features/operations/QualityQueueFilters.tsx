import { qualityQueueHref, qualityQueueOptions, type QualityQueue } from "./quality-queue";
import styles from "./QualityQueueFilters.module.css";
export function QualityQueueFilters({
  queue, search, counts, visible,
}: {
  queue: QualityQueue;
  search: string;
  counts: Record<QualityQueue, number>;
  visible: number;
}) {
  return (
    <div className={styles.controls}>
      <nav className={styles.tabs} aria-label="Quality case filters">
        {qualityQueueOptions.map(option => (
          <a
            key={option.key}
            href={qualityQueueHref(option.key, search)}
            aria-current={queue === option.key ? "page" : undefined}
          >
            {option.label} <span aria-hidden="true">{counts[option.key]}</span>
          </a>
        ))}
      </nav>
      <form action="" method="get" role="search" className={styles.searchForm}>
        {queue !== "all" ? <input name="queue" type="hidden" value={queue} /> : null}
        <label htmlFor="quality-case-search">Find a quality case</label>
        <div className={styles.searchControl}>
          <input id="quality-case-search" name="q" type="search" maxLength={100}
            defaultValue={search} placeholder="Case, customer or service" />
          <button type="submit">Search</button>
        </div>
        <div className={styles.count} aria-live="polite">
          <span>{visible} matching case{visible === 1 ? "" : "s"}</span>
          {search ? <a href={qualityQueueHref(queue,"")}>Clear search</a> : null}
        </div>
      </form>
    </div>
  );
}
