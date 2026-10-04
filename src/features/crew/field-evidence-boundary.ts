import type { VisitChecklistItemDTO, VisitEvidenceDTO, VisitEvidenceKind } from "@/contracts";

export type CrewFieldEvidencePersistence = "FUTURE_E06_CORE_EVIDENCE";
export type CrewFieldEvidenceSlotKind = Extract<VisitEvidenceKind, "BEFORE_PHOTO" | "AFTER_PHOTO" | "ISSUE_PHOTO">;
export type CrewFieldNoteKind = Extract<VisitEvidenceKind, "TIME_MATERIAL_NOTE" | "INCIDENT_NOTE">;

export interface CrewFieldEvidenceSlot {
  kind: CrewFieldEvidenceSlotKind;
  label: string;
  required: boolean;
  state: "EMPTY" | "OPTIONAL" | "PERSISTED";
  persistence: CrewFieldEvidencePersistence;
  persistedEvidence?: VisitEvidenceDTO;
}

export interface CrewFieldEvidenceNote {
  kind: CrewFieldNoteKind;
  label: string;
  required: boolean;
  persistence: CrewFieldEvidencePersistence;
  persistedEvidence?: VisitEvidenceDTO;
}

export interface CrewFieldEvidenceBoundary {
  sourceLabel: "FIXTURE_UI_ONLY" | "SERVER_SNAPSHOT";
  persistence: CrewFieldEvidencePersistence;
  photoSlots: CrewFieldEvidenceSlot[];
  notes: CrewFieldEvidenceNote[];
  checklistItems: VisitChecklistItemDTO[];
  submitEnabled: false;
  disabledReason: string;
}

export interface BuildCrewFieldEvidenceBoundaryInput {
  sourceLabel?: "FIXTURE_UI_ONLY" | "SERVER_SNAPSHOT";
  evidence?: VisitEvidenceDTO[];
  checklistItems?: VisitChecklistItemDTO[];
}

function findEvidence(evidence: VisitEvidenceDTO[], kind: VisitEvidenceKind) {
  return evidence.find((item) => item.kind === kind);
}

export function buildCrewFieldEvidenceBoundary(input: BuildCrewFieldEvidenceBoundaryInput | "FIXTURE_UI_ONLY" | "SERVER_SNAPSHOT" = {}): CrewFieldEvidenceBoundary {
  const normalized = typeof input === "string" ? { sourceLabel: input } : input;
  const sourceLabel = normalized.sourceLabel ?? "FIXTURE_UI_ONLY";
  const evidence = normalized.evidence ?? [];
  const checklistItems = normalized.checklistItems ?? [];

  const beforePhoto = findEvidence(evidence, "BEFORE_PHOTO");
  const afterPhoto = findEvidence(evidence, "AFTER_PHOTO");
  const issuePhoto = findEvidence(evidence, "ISSUE_PHOTO");
  const timeMaterialNote = findEvidence(evidence, "TIME_MATERIAL_NOTE");
  const incidentNote = findEvidence(evidence, "INCIDENT_NOTE");

  return {
    sourceLabel,
    persistence: "FUTURE_E06_CORE_EVIDENCE",
    submitEnabled: false,
    disabledReason: "Field evidence rendering can consume VisitEvidenceDTO/VisitChecklistItemDTO, but submission remains disabled until Core E06 commands are accepted.",
    photoSlots: [
      { kind: "BEFORE_PHOTO", label: "Before photo slot", required: true, state: beforePhoto ? "PERSISTED" : "EMPTY", persistence: "FUTURE_E06_CORE_EVIDENCE", persistedEvidence: beforePhoto },
      { kind: "AFTER_PHOTO", label: "After photo slot", required: true, state: afterPhoto ? "PERSISTED" : "EMPTY", persistence: "FUTURE_E06_CORE_EVIDENCE", persistedEvidence: afterPhoto },
      { kind: "ISSUE_PHOTO", label: "Optional issue photo", required: false, state: issuePhoto ? "PERSISTED" : "OPTIONAL", persistence: "FUTURE_E06_CORE_EVIDENCE", persistedEvidence: issuePhoto },
    ],
    notes: [
      { kind: "TIME_MATERIAL_NOTE", label: "Time/material note", required: false, persistence: "FUTURE_E06_CORE_EVIDENCE", persistedEvidence: timeMaterialNote },
      { kind: "INCIDENT_NOTE", label: "Incident note", required: false, persistence: "FUTURE_E06_CORE_EVIDENCE", persistedEvidence: incidentNote },
    ],
    checklistItems,
  };
}
