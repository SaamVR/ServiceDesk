import type { DispatchVisitRecommendation } from "./recommendations";
import type { DispatchCrewDayLane } from "./timeline";
import styles from "./DispatcherIntelligence.module.css";

function formatTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}

function readable(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

export function DispatcherIntelligence({
  recommendations,
  timeline = [],
  approvalCommandAvailable = false,
  approvalAction,
  timeZone = "UTC",
  crewLabels = {},
}: {
  recommendations: readonly DispatchVisitRecommendation[];
  timeline?: readonly DispatchCrewDayLane[];
  approvalCommandAvailable?: boolean;
  approvalAction?: (formData: FormData) => Promise<void>;
  timeZone?: string;
  crewLabels?: Record<string, string>;
}) {
  return (
    <section className={styles.shell} aria-labelledby="dispatch-intelligence-heading">
      <header className={styles.summary}>
        <div>
          <p className={styles.meta}>Dispatch</p>
          <h2 id="dispatch-intelligence-heading">Crew suggestions</h2>
          <p className={styles.muted}>Suggestions use current workload, availability and schedule conflicts. Review a suggestion before assigning the job.</p>
        </div>
        <strong>{recommendations.length} unassigned visit{recommendations.length === 1 ? "" : "s"}</strong>
      </header>

      <div className={styles.grid}>
        {recommendations.map((visit) => (
          <article className={styles.visit} key={visit.visitId}>
            <div>
              <p className={styles.meta}>Visit {visit.visitId}</p>
              <h3>Choose a crew</h3>
              {visit.attentionReasons.length > 0 ? <ul className={styles.reasons}>{visit.attentionReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : null}
            </div>
            {visit.candidates.map((candidate) => (
              <div className={styles.candidate} key={candidate.candidateCrewId}>
                <span className={styles.rank}>#{candidate.rank}</span>
                <div>
                  <strong>{crewLabels[candidate.candidateCrewId] ?? candidate.candidateCrewId}</strong>
                  <p className={styles.meta}>{candidate.confidence.toLowerCase()} confidence · {candidate.currentWorkloadMinutes}m scheduled</p>
                  <ul className={styles.reasons}>{candidate.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                  {candidate.conflicts.length > 0 ? <p className={styles.conflict}>Conflicts: {candidate.conflicts.map(readable).join(", ")}</p> : null}
                </div>
                {approvalAction && approvalCommandAvailable && candidate.eligible ? (
                  <form action={approvalAction}>
                    <input type="hidden" name="visitId" value={visit.visitId} />
                    <input type="hidden" name="crewId" value={candidate.candidateCrewId} />
                    <input type="hidden" name="expectedVersion" value={visit.visitVersion} />
                    <button className={styles.button} type="submit">Assign crew</button>
                  </form>
                ) : (
                  <button className={styles.button} type="button" disabled>
                    {candidate.eligible ? "Assignment unavailable" : "Conflict blocked"}
                  </button>
                )}
              </div>
            ))}
          </article>
        ))}
      </div>

      {timeline.length > 0 ? (
        <section className={styles.timeline} aria-labelledby="crew-day-timeline-heading">
          <div>
            <p className={styles.meta}>Crew/day timeline</p>
            <h3 id="crew-day-timeline-heading">Persisted assignment workload</h3>
          </div>
          <div className={styles.lanes}>
            {timeline.map((lane) => (
              <article className={styles.lane} key={lane.crewId}>
                <div className={styles.laneHead}>
                  <div><strong>{crewLabels[lane.crewId] ?? lane.crewId}</strong><p className={styles.meta}>{lane.active ? "Active" : "Inactive"} · {lane.workloadMinutes}m scheduled</p></div>
                  <span className={lane.conflictCount > 0 ? styles.conflict : styles.meta}>{lane.conflictCount} conflict{lane.conflictCount === 1 ? "" : "s"}</span>
                </div>
                <div className={styles.laneVisits}>
                  {lane.visits.length === 0 ? <p className={styles.muted}>No assigned visits.</p> : lane.visits.map((visit) => (
                    <div className={styles.laneVisit} key={visit.visitId}>
                      <span>{formatTime(visit.startAt, timeZone)}–{formatTime(visit.endAt, timeZone)}</span>
                      <strong>{visit.visitId}</strong>
                      <span className={styles.meta}>{readable(visit.status)}</span>
                      {visit.conflictWithVisitIds.length > 0 ? <span className={styles.conflict}>Overlaps {visit.conflictWithVisitIds.join(", ")}</span> : null}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {!approvalCommandAvailable ? <p className={styles.muted}>Crew assignments are currently read-only.</p> : null}
    </section>
  );
}
