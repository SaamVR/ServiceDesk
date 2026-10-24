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
      {counts.unverified > 0 ? <p role="status" style={{
        border:"1px solid #e6d4b0",background:"#fff8eb",borderRadius:8,
        padding:"10px 12px",margin:0,color:"#775221",fontSize:12,lineHeight:1.6
      }}>
        {counts.unverified} unresolved quality case(s) have missing or unverified
        deadline evidence. This does not prove they are overdue or safe to defer.{" "}
        <a href={qualityQueueHref("unverified",search)}>Review unverified timing →</a>
      </p> : null}
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
