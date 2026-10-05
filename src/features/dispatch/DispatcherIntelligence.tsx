import type { DispatchVisitRecommendation } from "./recommendations";
import styles from "./DispatcherIntelligence.module.css";

export function DispatcherIntelligence({
  recommendations,
  approvalCommandAvailable = false,
}: {
  recommendations: readonly DispatchVisitRecommendation[];
  approvalCommandAvailable?: boolean;
}) {
  return (
    <section className={styles.shell} aria-labelledby="dispatch-intelligence-heading">
      <header className={styles.summary}>
        <div>
          <p className={styles.meta}>Advisory dispatch intelligence</p>
          <h2 id="dispatch-intelligence-heading">Unassigned → suggested crew → approval</h2>
          <p className={styles.muted}>Ranking uses persisted schedule/workload/availability inputs only. Geography is not fabricated, and no recommendation mutates assignment truth.</p>
        </div>
        <strong>{recommendations.length} unassigned visit{recommendations.length === 1 ? "" : "s"}</strong>
      </header>

      <div className={styles.grid}>
        {recommendations.map((visit) => (
          <article className={styles.visit} key={visit.visitId}>
            <div>
              <p className={styles.meta}>Visit {visit.visitId} · version {visit.visitVersion}</p>
              <h3>Human approval required</h3>
              {visit.attentionReasons.length > 0 ? <ul className={styles.reasons}>{visit.attentionReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : null}
            </div>
            {visit.candidates.map((candidate) => (
              <div className={styles.candidate} key={candidate.candidateCrewId}>
                <span className={styles.rank}>#{candidate.rank}</span>
                <div>
                  <strong>{candidate.candidateCrewId}</strong>
                  <p className={styles.meta}>Score {candidate.score} · {candidate.confidence.toLowerCase()} confidence · workload {candidate.currentWorkloadMinutes}m</p>
                  <ul className={styles.reasons}>{candidate.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                  {candidate.conflicts.length > 0 ? <p className={styles.conflict}>Conflicts: {candidate.conflicts.join(", ")}</p> : null}
                  <p className={styles.meta}>Route efficiency: not scored because authoritative geography/routing data is unavailable.</p>
                </div>
                <button className={styles.button} type="button" disabled={!approvalCommandAvailable || !candidate.eligible}>
                  {candidate.eligible ? "Approve assignment" : "Conflict blocked"}
                </button>
              </div>
            ))}
          </article>
        ))}
      </div>
      {!approvalCommandAvailable ? <p className={styles.muted}>Approval UI is intentionally non-mutating until an authoritative crew-assignment command accepting crewId + expectedVersion is available.</p> : null}
    </section>
  );
}
