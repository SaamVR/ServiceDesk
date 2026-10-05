import type { AttentionItemDTO, VisitDTO, VisitEvidenceDTO } from "@/contracts";
import type { CrewSyncState } from "@/features/crew/sync-state";

export type FieldOperationalExceptionCode =
  | "SCHEDULE_COLLISION"
  | "STALE_VERSION"
  | "MISSING_EVIDENCE"
  | "LATE_UNSTARTED"
  | "SYNC_CONFLICT"
  | "ASSIGNMENT_NO_LONGER_VALID"
  | "QUALITY_ESCALATION";

export interface FieldOperationalException {
  code: FieldOperationalExceptionCode;
  severity: "INFO" | "WARNING" | "CRITICAL";
  message: string;
  source: "DERIVED" | "EXISTING_ATTENTION";
  attentionItemId?: string;
}

function hasEvidence(evidence: readonly VisitEvidenceDTO[], kind: VisitEvidenceDTO["kind"]) {
  return evidence.some((item) => item.kind === kind);
}

export function buildFieldOperationalExceptions(input: {
  visit: VisitDTO;
  evidence: readonly VisitEvidenceDTO[];
  sync: CrewSyncState;
  attentionItems: readonly AttentionItemDTO[];
  now: string;
  scheduleCollision?: boolean;
}): FieldOperationalException[] {
  const exceptions: FieldOperationalException[] = [];

  if (input.scheduleCollision) {
    exceptions.push({
      code: "SCHEDULE_COLLISION",
      severity: "CRITICAL",
      message: "The assigned visit overlaps another persisted crew schedule item.",
      source: "DERIVED",
    });
  }

  if (input.sync.status === "VERSION_CONFLICT") {
    exceptions.push({
      code: "STALE_VERSION",
      severity: "WARNING",
      message: "The local action used a stale visit version. Refresh authoritative state before deciding what to do next.",
      source: "DERIVED",
    });
  } else if (input.sync.status === "SYNC_FAILED") {
    exceptions.push({
      code: "SYNC_CONFLICT",
      severity: "WARNING",
      message: input.sync.issue?.message ?? "A local action failed to sync.",
      source: "DERIVED",
    });
  } else if (input.sync.status === "ACTION_NO_LONGER_VALID") {
    exceptions.push({
      code: "ASSIGNMENT_NO_LONGER_VALID",
      severity: "CRITICAL",
      message: input.sync.issue?.message ?? "The queued field action is no longer valid against server state.",
      source: "DERIVED",
    });
  }

  if (
    ["IN_PROGRESS", "PENDING_REVIEW"].includes(input.visit.status)
    && (!hasEvidence(input.evidence, "BEFORE_PHOTO") || !hasEvidence(input.evidence, "AFTER_PHOTO"))
  ) {
    exceptions.push({
      code: "MISSING_EVIDENCE",
      severity: "WARNING",
      message: "Required before/after evidence is incomplete for the review handoff.",
      source: "DERIVED",
    });
  }

  if (
    ["CONFIRMED", "ASSIGNED"].includes(input.visit.status)
    && new Date(input.visit.startAt).getTime() < new Date(input.now).getTime()
  ) {
    exceptions.push({
      code: "LATE_UNSTARTED",
      severity: "WARNING",
      message: "The visit start time has passed and work has not started.",
      source: "DERIVED",
    });
  }

  for (const item of input.attentionItems) {
    if (
      item.status !== "RESOLVED"
      && item.resourceId === input.visit.id
      && (item.type.includes("QUALITY") || item.type === "FIELD_INCIDENT")
    ) {
      exceptions.push({
        code: "QUALITY_ESCALATION",
        severity: item.severity,
        message: item.summary,
        source: "EXISTING_ATTENTION",
        attentionItemId: item.id,
      });
    }
  }

  const severityRank = { CRITICAL: 0, WARNING: 1, INFO: 2 } as const;
  return exceptions.sort((a, b) =>
    severityRank[a.severity] - severityRank[b.severity]
    || a.code.localeCompare(b.code)
    || (a.attentionItemId ?? "").localeCompare(b.attentionItemId ?? ""),
  );
}
