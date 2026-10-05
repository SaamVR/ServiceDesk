import type { ReactNode } from "react";
import { MetricStrip, Panel, SectionHeader, StatusBadge } from "@/components/product/PagePrimitives";
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
  renderApprovalControl,
}: {
  recommendations: readonly DispatchVisitRecommendation[];
  timeline?: readonly DispatchCrewDayLane[];
  workspaceTimeZone?: string;
  assignmentAvailability?: DispatchAssignmentAvailability;
  dataQualityIssues?: readonly DispatchStaffDataQualityIssue[];
  crewLabels?: Readonly<Record<string, string>>;
  renderApprovalControl?: (input: DispatcherApprovalControlInput) => ReactNode;
}) {
  const resolvedTimeZone = resolveOperationalTimeZone(workspaceTimeZone);
  const eligible = recommendations.filter((recommendation) =>
    recommendation.candidates.some((candidate) => candidate.eligible),
  ).length;
  const collisions = timeline.reduce((sum, lane) => sum + lane.conflictCount, 0);

  return (
    <section className={styles.shell} aria-labelledby="dispatch-intelligence-heading">
      <SectionHeader
        title="Dispatch suggestions"
        description="Review unassigned jobs, crew availability and schedule conflicts before making a crew change."
      />

      <MetricStrip items={[
        { label: "Unassigned", value: recommendations.length },
        { label: "Suggested", value: eligible },
        { label: "Conflicts", value: collisions, tone: collisions > 0 ? "attention" : "default" },
        ...(dataQualityIssues.length > 0
          ? [{ label: "Needs data", value: dataQualityIssues.length, tone: "attention" as const }]
          : []),
      ]} />

      {dataQualityIssues.length > 0 ? (
        <Panel>
          <SectionHeader
            title="Jobs needing schedule data"
            description="These jobs are excluded from crew suggestions until their scheduling data is complete."
          />
          <ul className={styles.attention}>
            {dataQualityIssues.map((item) => (
              <li key={item.visitId + ":" + item.code}>
                <strong>{item.visitId}</strong> · {item.message}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {recommendations.length === 0 ? (
        <Panel>
          <p className={styles.empty}>No unassigned jobs need a crew suggestion.</p>
        </Panel>
      ) : (
        <div className={styles.grid}>
          {recommendations.map((recommendation) => (
            <Panel className={styles.visit} key={recommendation.visitId} ariaLabel={`Dispatch suggestions for ${recommendation.visitId}`}>
              <div className={styles.visitHead}>
                <div>
                  <p className={styles.meta}>Job {recommendation.visitId}</p>
                  <h3>Choose a crew</h3>
                </div>
                <StatusBadge tone="warning">Approval required</StatusBadge>
              </div>

              {recommendation.attentionReasons.length > 0 ? (
                <ul className={styles.attention}>
                  {recommendation.attentionReasons.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
              ) : null}

              <div className={styles.candidates}>
                {recommendation.candidates.map((candidate) => (
                  <article className={styles.candidate} key={candidate.candidateCrewId}>
                    <div className={styles.rank}>#{candidate.rank}</div>
                    <div className={styles.candidateBody}>
                      <div className={styles.candidateHead}>
                        <strong>{crewLabels[candidate.candidateCrewId] ?? candidate.candidateCrewId}</strong>
                        <StatusBadge tone={confidenceTone(candidate.confidence)}>
                          {candidate.confidence.toLowerCase()} confidence
                        </StatusBadge>
                      </div>
                      <p className={styles.meta}>{candidate.currentWorkloadMinutes} min scheduled</p>
                      <ul className={styles.reasons}>
                        {candidate.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                      </ul>
                      {candidate.conflicts.length > 0 ? (
                        <div className={styles.conflicts}>
                          {candidate.conflicts.map((conflict) => (
                            <StatusBadge tone="danger" key={conflict}>{conflictLabel[conflict]}</StatusBadge>
                          ))}
                        </div>
                      ) : null}
                      <p className={styles.meta}>Travel time isn’t scored because routing data isn’t available.</p>
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
          ))}
        </div>
      )}

      <Panel>
        <SectionHeader
          title="Crew day"
          description={`Times shown in ${resolvedTimeZone.timeZone}.`}
        />
        <div className={styles.lanes}>
          {timeline.map((lane) => (
            <article className={styles.lane} key={lane.crewId}>
              <div className={styles.laneHead}>
                <div>
                  <strong>{crewLabels[lane.crewId] ?? lane.crewId}</strong>
                  <p className={styles.meta}>{lane.active ? "Active" : "Inactive"} · {lane.workloadMinutes} min scheduled</p>
                </div>
                <StatusBadge tone={lane.conflictCount > 0 ? "danger" : "success"}>
                  {lane.conflictCount > 0 ? `${lane.conflictCount} conflicts` : "Clear"}
                </StatusBadge>
              </div>
              <div className={styles.laneVisits}>
                {lane.visits.length === 0 ? (
                  <p className={styles.empty}>No assigned jobs.</p>
                ) : lane.visits.map((visit) => (
                  <div className={styles.laneVisit} key={visit.visitId}>
                    <span>{formatOperationalTime(visit.startAt, workspaceTimeZone)}–{formatOperationalTime(visit.endAt, workspaceTimeZone)}</span>
                    <strong>{visit.visitId}</strong>
                    <span className={styles.meta}>{visit.status.replaceAll("_", " ").toLowerCase()}</span>
                    {visit.conflictWithVisitIds.length > 0 ? (
                      <span className={styles.conflictText}>Overlaps {visit.conflictWithVisitIds.join(", ")}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </Panel>

      {!assignmentAvailability.enabled ? (
        <p className={styles.footer}>{assignmentAvailability.disabledReason}</p>
      ) : null}
    </section>
  );
}
