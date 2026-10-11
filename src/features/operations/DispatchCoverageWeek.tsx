import { scheduleCoverageHref, type DispatchCoverageDay } from "./dispatch-coverage-week";
import styles from "./DispatchCoverageWeek.module.css";

/**
 * Read-only workload counts. A day with visits does NOT imply free capacity;
 * crew recommendations and real capacity slots remain their own evidence.
 */
export function DispatchCoverageWeek({
  days,
  selectedDay,
  queue,
  timeZone,
}: {
  days: readonly DispatchCoverageDay[];
  selectedDay?: string;
  queue?: string;
  timeZone: string;
}) {
  if (!days.length) return null;
  return (
    <section className={styles.container} aria-label="Seven-day crew coverage">
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Workload overview</p>
          <h3>Seven-day crew coverage</h3>
          <p>Visit counts from the schedule · {timeZone} · not available capacity</p>
        </div>
        <div className={styles.legend} aria-label="Coverage legend">
          <span><i className={styles.assigned} aria-hidden="true" /> Assigned</span>
          <span><i className={styles.unassigned} aria-hidden="true" /> Needs crew</span>
        </div>
      </div>
      <nav className={styles.grid} aria-label="Filter scheduled visits by day">
        <a
          href={scheduleCoverageHref(queue)}
          className={styles.allDays}
          aria-current={!selectedDay ? "date" : undefined}
        >
          <span>Full week</span>
          <strong>{days.reduce((sum, day) => sum + day.total, 0)}</strong>
          <small>7 days</small>
        </a>
        {days.map((day) => (
          <a
            href={scheduleCoverageHref(queue, day.key)}
            aria-label={day.weekday + " " + day.monthDay + ": " + day.total + " visits, " + day.unassigned + " unassigned"}
            aria-current={selectedDay === day.key ? "date" : undefined}
            key={day.key}
          >
            <span>{day.weekday}</span>
            <strong>{day.total}</strong>
            <small>{day.monthDay}</small>
            <span className={styles.meter} aria-hidden="true">
              {day.total > 0 ? (
                <>
                  <i className={styles.meterAssigned} style={{ flexGrow: Math.max(day.total - day.unassigned, 0) }} />
                  <i className={styles.meterUnassigned} style={{ flexGrow: day.unassigned }} />
                </>
              ) : null}
            </span>
            {day.unassigned > 0 ? <em>{day.unassigned} need crew</em> : day.total ? <em>{day.underway} underway</em> : <em>No visits</em>}
          </a>
        ))}
      </nav>
    </section>
  );
}
