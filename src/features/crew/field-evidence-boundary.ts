export type CrewFieldEvidencePersistence = "FUTURE_E06_CORE_EVIDENCE";
export type CrewFieldEvidenceSlotKind = "BEFORE_PHOTO" | "AFTER_PHOTO" | "ISSUE_PHOTO";
export type CrewFieldNoteKind = "TIME_MATERIAL_NOTE" | "INCIDENT_NOTE";

export interface CrewFieldEvidenceSlot {
  kind: CrewFieldEvidenceSlotKind;
  label: string;
  required: boolean;
  state: "EMPTY" | "OPTIONAL";
  persistence: CrewFieldEvidencePersistence;
}

export interface CrewFieldEvidenceNote {
  kind: CrewFieldNoteKind;
  label: string;
  required: boolean;
  persistence: CrewFieldEvidencePersistence;
}

export interface CrewFieldEvidenceBoundary {
  sourceLabel: "FIXTURE_UI_ONLY" | "SERVER_SNAPSHOT";
  persistence: CrewFieldEvidencePersistence;
  photoSlots: CrewFieldEvidenceSlot[];
  notes: CrewFieldEvidenceNote[];
  submitEnabled: false;
  disabledReason: string;
}

export function buildCrewFieldEvidenceBoundary(sourceLabel: "FIXTURE_UI_ONLY" | "SERVER_SNAPSHOT" = "FIXTURE_UI_ONLY"): CrewFieldEvidenceBoundary {
  return {
    sourceLabel,
    persistence: "FUTURE_E06_CORE_EVIDENCE",
    submitEnabled: false,
    disabledReason: "Field evidence UI is presentation-only until Core freezes a persisted E06 evidence command.",
    photoSlots: [
      { kind: "BEFORE_PHOTO", label: "Before photo slot", required: true, state: "EMPTY", persistence: "FUTURE_E06_CORE_EVIDENCE" },
      { kind: "AFTER_PHOTO", label: "After photo slot", required: true, state: "EMPTY", persistence: "FUTURE_E06_CORE_EVIDENCE" },
      { kind: "ISSUE_PHOTO", label: "Optional issue photo", required: false, state: "OPTIONAL", persistence: "FUTURE_E06_CORE_EVIDENCE" },
    ],
    notes: [
      { kind: "TIME_MATERIAL_NOTE", label: "Time/material note", required: false, persistence: "FUTURE_E06_CORE_EVIDENCE" },
      { kind: "INCIDENT_NOTE", label: "Incident note", required: false, persistence: "FUTURE_E06_CORE_EVIDENCE" },
    ],
  };
}
