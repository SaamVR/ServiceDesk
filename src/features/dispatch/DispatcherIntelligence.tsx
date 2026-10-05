import type { ReactNode } from "react";
import { MetricStrip, Panel, StatusBadge } from "@/components/product/PagePrimitives";
import { formatOperationalTime, resolveOperationalTimeZone } from "@/features/crew/time-format";
import type { DispatchAssignmentAvailability } from "./assignment-boundary";
import type { DispatchStaffDataQualityIssue } from "./staff-integration";
import type {
  DispatchCandidateRecommendation,
  DispatchConflictCode,
  DispatchVisitRecommendation,
} from "./recommendations";
import type { DispatchCrewDayLane } from "./timeline";
import styles from "./DispatcherIntelligence.module.css";

const conflictLabel: Record<DispatchConflictCode, string> = {
  CREW_WORKSPACE_MISMATCH: "Wrong workspace",
  CREW_INACTIVE: "Crew inactive",
  OUTSIDE_AVAILABILITY: "Outside availability",
  SERVICE_CONSTRAINT_MISMATCH: "Service mismatch",
  SCHEDULE_OVERLAP: "Schedule overlap",
};

function confidenceTone(confidence: DispatchCandidateRecommendation["confidence"]) {
  if (confidence === "HIGH") return "success" as const;
  if (confidence === "MEDIUM") return "info" as const;
  return "warning" as const;
}

function shortJobReference(visitId: string) {
  return visitId.length > 12 ? `…${visitId.slice(-8)}` : visitId;
}

export interface DispatcherApprovalControlInput {
  recommendation: DispatchVisitRecommendation;
  candidate: DispatchCandidateRecommendation;
}

export function DispatcherIntelligence({
  recommendations,
  timeline = [],
  workspaceTimeZone,
  assignmentAvailability = {
    enabled: false,
    label: "Assignment unavailable",
    disabledReason: "Crew changes are not available from this screen yet.",
  },
  dataQualityIssues = [],
  crewLabels = {},
  visitLabels = {},
  visitMeta = {},
  renderApprovalControl,
}: {
  recommendations: readonly DispatchVisitRecommendation[];
  timeline?: readonly DispatchCrewDayLane[];
  workspaceTimeZone?: string;
  assignmentAvailability?: DispatchAssignmentAvailability;
  dataQualityIssues?: readonly DispatchStaffDataQualityIssue[];
  crewLabels?: Readonly<Record<string, string>>;
  visitLabels?: Readonly<Record<string, string>>;
  visitMeta?: Readonly<Record<string, string>>;
  renderApprovalControl?: (input: DispatcherApprovalControlInput) => ReactNode;
}) {
  const resolvedTimeZone = resolveOperationalTimeZone(workspaceTimeZone);
  const eligible = recommendations.filter((recommendation) =>
    recommendation.candidates.some((candidate) => candidate.eligible),
  ).length;
  const collisions = timeline.reduce((sum, lane) => sum + lane.conflictCount, 0);
  const activeCrews = timeline.filter((lane) => lane.active).length;

  return (
    <section className={styles.shell} aria-labelledby="dispatch-intelligence-heading">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Dispatch intelligence</p>
          <h2 id="dispatch-intelligence-heading">Crew assignment board</h2>
          <p>Compare workload and scheduling constraints before committing an assignment.</p>
        </div>
        <StatusBadge tone="info">Human approval required</StatusBadge>
      </header>

      <MetricStrip items={[
        { label: "Unassigned", value: recommendations.length, detail: "Jobs needing crew" },
        { label: "Ready to assign", value: eligible, detail: "At least one eligible crew" },
        { label: "Active crews", value: activeCrews, detail: "Shown in crew day" },
        { label: "Conflicts", value: collisions, detail: "Schedule overlaps", tone: collisions > 0 ? "attention" : "default" },
        ...(dataQualityIssues.length > 0
          ? [{ label: "Needs data", value: dataQualityIssues.length, detail: "Excluded from suggestions", tone: "attention" as const }]
          : []),
      ]} />

      <div className={styles.board}>
        <div className={styles.recommendationColumn}>
          {dataQualityIssues.length > 0 ? (
            <Panel className={styles.dataQualityPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelEyebrow}>Incomplete scheduling data</p>
                  <h3>Jobs needing schedule data</h3>
                  <p>These jobs are excluded from crew suggestions until their scheduling data is complete.</p>
                </div>
                <StatusBadge tone="warning">{dataQualityIssues.length} blocked</StatusBadge>
              </div>
              <ul className={styles.dataQualityList}>
                {dataQualityIssues.map((item) => (
                  <li key={item.visitId + ":" + item.code}>
                    <span>{visitLabels[item.visitId] ?? `Job ${shortJobReference(item.visitId)}`}</span>
                    <small>{item.message}</small>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {recommendations.length === 0 ? (
            <Panel className={styles.emptyPanel}>
              <span className={styles.emptyIcon} aria-hidden="true">✓</span>
              <div>
                <strong>No unassigned jobs</strong>
                <p>Every schedulable job currently has a crew assignment.</p>
              </div>
            </Panel>
          ) : (
            <div className={styles.recommendationList}>
              {recommendations.map((recommendation) => {
                const bestCandidate = recommendation.candidates.find((candidate) => candidate.eligible);
                return (
                  <Panel className={styles.visit} key={recommendation.visitId} ariaLabel={`Dispatch suggestions for ${recommendation.visitId}`}>
                    <div className={styles.visitHead}>
                      <div className={styles.visitTitle}>
                        <p>{visitMeta[recommendation.visitId] ?? `Job ${shortJobReference(recommendation.visitId)}`}</p>
                        <h3>{visitLabels[recommendation.visitId] ?? "Unassigned service visit"}</h3>
                      </div>
                      <div className={styles.visitStatus}>
                        {bestCandidate ? <StatusBadge tone="success">Candidate ready</StatusBadge> : <StatusBadge tone="warning">Conflict review</StatusBadge>}
                        <StatusBadge tone="info">Approval required</StatusBadge>
                      </div>
                    </div>

                    {recommendation.attentionReasons.length > 0 ? (
                      <div className={styles.attentionBlock}>
                        <strong>Operational context</strong>
                        <ul>
                          {recommendation.attentionReasons.map((reason) => <li key={reason}>{reason}</li>)}
                        </ul>
                      </div>
                    ) : null}

                    <div className={styles.candidates}>
                      {recommendation.candidates.slice(0, 4).map((candidate) => (
                        <article className={`${styles.candidate} ${candidate.eligible ? styles.candidateEligible : styles.candidateBlocked}`} key={candidate.candidateCrewId}>
                          <div className={styles.rank} aria-label={`Rank ${candidate.rank}`}>{candidate.rank}</div>
                          <div className={styles.candidateBody}>
                            <div className={styles.candidateHead}>
                              <div>
                                <strong>{crewLabels[candidate.candidateCrewId] ?? candidate.candidateCrewId}</strong>
                                <span>{candidate.currentWorkloadMinutes} min scheduled</span>
                              </div>
                              <StatusBadge tone={confidenceTone(candidate.confidence)}>
                                {candidate.confidence.toLowerCase()} confidence
                              </StatusBadge>
                            </div>
                            <div className={styles.reasonChips}>
                              {candidate.reasons.slice(0, 3).map((reason) => <span key={reason}>{reason}</span>)}
                            </div>
                            {candidate.conflicts.length > 0 ? (
                              <div className={styles.conflicts}>
                                {candidate.conflicts.map((conflict) => (
                                  <StatusBadge tone="danger" key={conflict}>{conflictLabel[conflict]}</StatusBadge>
                                ))}
                              </div>
                            ) : (
                              <p className={styles.routingNote}>Travel time isn’t scored because routing data isn’t available.</p>
                            )}
                          </div>
                          <div className={styles.approval}>
                            {candidate.eligible && assignmentAvailability.enabled && renderApprovalControl
                              ? renderApprovalControl({ recommendation, candidate })
                              : (
                                <button className="app-button-secondary" type="button" disabled>
                                  {candidate.eligible ? "Assign crew" : "Resolve conflict"}
                                </button>
                              )}
                          </div>
                        </article>
                      ))}
                    </div>
                  </Panel>
                );
              })}
            </div>
          )}
        </div>

        <Panel className={styles.timelinePanel} ariaLabel="Crew day schedule">
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelEyebrow}>Crew day</p>
              <h3>Assigned workload</h3>
              <p>Times shown in {resolvedTimeZone.timeZone}. Conflicts stay visible until resolved.</p>
            </div>
          </div>
          <div className={styles.lanes}>
            {timeline.length === 0 ? (
              <div className={styles.timelineEmpty}>No crew schedule is available.</div>
            ) : timeline.map((lane) => (
              <article className={styles.lane} key={lane.crewId}>
                <div className={styles.laneHead}>
                  <div>
                    <strong>{crewLabels[lane.crewId] ?? lane.crewId}</strong>
                    <p>{lane.active ? "Active" : "Inactive"} · {lane.workloadMinutes} min scheduled</p>
                  </div>
                  <StatusBadge tone={lane.conflictCount > 0 ? "danger" : "success"}>
                    {lane.conflictCount > 0 ? `${lane.conflictCount} conflicts` : "Clear"}
                  </StatusBadge>
                </div>
                <div className={styles.laneVisits}>
                  {lane.visits.length === 0 ? (
                    <p className={styles.laneEmpty}>No assigned jobs.</p>
                  ) : lane.visits.map((visit) => (
                    <div className={styles.laneVisit} key={visit.visitId}>
                      <span className={styles.laneTime}>{formatOperationalTime(visit.startAt, workspaceTimeZone)}–{formatOperationalTime(visit.endAt, workspaceTimeZone)}</span>
                      <span className={styles.laneJob}>
                        <strong>{visitLabels[visit.visitId] ?? `Job ${shortJobReference(visit.visitId)}`}</strong>
                        <small>{visit.status.replaceAll("_", " ").toLowerCase()}</small>
                      </span>
                      {visit.conflictWithVisitIds.length > 0 ? (
                        <span className={styles.conflictText}>Overlaps another assigned job</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </Panel>
      </div>

      {!assignmentAvailability.enabled ? (
        <p className={styles.footer}>{assignmentAvailability.disabledReason}</p>
      ) : null}
    </section>
  );
}
