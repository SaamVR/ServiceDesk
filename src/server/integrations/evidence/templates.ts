import type { ProviderMode, ProviderVerificationState, RedactedProviderEvidence } from "../types";

export type EvidenceArtifactKey =
  | "controlledProviderAccount"
  | "controlledRecipientOrResource"
  | "redactedReceiptOrEventId"
  | "rawCallbackVerified"
  | "operatorAttestation";

const mandatoryArtifacts: EvidenceArtifactKey[] = [
  "controlledProviderAccount",
  "controlledRecipientOrResource",
  "redactedReceiptOrEventId",
  "rawCallbackVerified",
  "operatorAttestation",
];

export interface ProviderEvidenceTemplateInput {
  provider: RedactedProviderEvidence["provider"];
  mode: ProviderMode;
  scenario: string;
  capturedAt: string;
}

export interface ProviderEvidenceAssessmentInput extends ProviderEvidenceTemplateInput {
  artifacts: Partial<Record<EvidenceArtifactKey, boolean | string>>;
}

export interface ProviderEvidenceTemplate {
  provider: RedactedProviderEvidence["provider"];
  scenario: string;
  mode: ProviderMode;
  status: ProviderVerificationState;
  capturedAt: string;
  requiredArtifacts: EvidenceArtifactKey[];
  missingArtifacts: EvidenceArtifactKey[];
  evidence: RedactedProviderEvidence;
}

function artifactPresent(value: boolean | string | undefined): boolean {
  return typeof value === "string" ? value.trim().length > 0 : value === true;
}

function receipt(input: ProviderEvidenceAssessmentInput): string | undefined {
  const value = input.artifacts.redactedReceiptOrEventId;
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function statusFor(input: ProviderEvidenceAssessmentInput, missingArtifacts: EvidenceArtifactKey[]): ProviderVerificationState {
  if (input.mode === "FIXTURE") return "CONTRACT_TESTED";
  if (missingArtifacts.length > 0) return "CONFIGURATION_BLOCKED";
  return "PROVIDER_VERIFIED";
}

export function buildProviderEvidenceTemplate(input: ProviderEvidenceTemplateInput): ProviderEvidenceTemplate {
  return {
    provider: input.provider,
    scenario: input.scenario,
    mode: input.mode,
    status: "CONFIGURATION_BLOCKED",
    capturedAt: input.capturedAt,
    requiredArtifacts: [...mandatoryArtifacts],
    missingArtifacts: [...mandatoryArtifacts],
    evidence: {
      provider: input.provider,
      mode: input.mode,
      verification: "CONFIGURATION_BLOCKED",
      capturedAt: input.capturedAt,
      notes: [
        `Scenario ${input.scenario} requires controlled provider proof before PROVIDER_VERIFIED.`,
        "Fixture, mocked, or synthetic callbacks remain CONTRACT_TESTED only.",
      ],
    },
  };
}

export function assessProviderEvidence(input: ProviderEvidenceAssessmentInput): ProviderEvidenceTemplate {
  const missingArtifacts = mandatoryArtifacts.filter((key) => !artifactPresent(input.artifacts[key]));
  const status = statusFor(input, missingArtifacts);
  const redactedReceipt = receipt(input);

  return {
    provider: input.provider,
    scenario: input.scenario,
    mode: input.mode,
    status,
    capturedAt: input.capturedAt,
    requiredArtifacts: [...mandatoryArtifacts],
    missingArtifacts: input.mode === "FIXTURE" ? [] : missingArtifacts,
    evidence: {
      provider: input.provider,
      mode: input.mode,
      verification: status,
      capturedAt: input.capturedAt,
      redactedReceipt,
      notes: [
        `Scenario ${input.scenario} assessed as ${status}.`,
        status === "PROVIDER_VERIFIED"
          ? "All mandatory controlled-provider artifacts are present and redacted."
          : "Provider proof is not complete; do not claim PROVIDER_VERIFIED.",
      ],
    },
  };
}
