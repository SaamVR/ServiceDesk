export type V2ReleaseEvidenceState =
  | "IMPLEMENTED"
  | "CONTRACT_TESTED"
  | "PROVIDER_VERIFIED"
  | "OPERATIONS_VERIFIED"
  | "CONFIGURATION_BLOCKED"
  | "BUYER_EVIDENCE_BLOCKED";

export type V2ReleaseGateId =
  | "CANONICAL_EXECUTABLE"
  | "RESPONSIVE_BROWSER"
  | "WHATSAPP_PROVIDER"
  | "GOOGLE_CALENDAR_PROVIDER"
  | "EMAIL_PROVIDER"
  | "N8N_PROVIDER"
  | "AI_PROVIDER"
  | "PAYMENT_SANDBOX"
  | "EMAIL_INBOUND"
  | "VOICE_INBOUND"
  | "PHOTO_ASSISTED_INTAKE"
  | "SECOND_VERTICAL"
  | "MIGRATION_REHEARSAL"
  | "OPERATOR_RUNBOOK";

export interface V2ReleaseEvidenceReference {
  kind: "BUILD_RECEIPT" | "CONTROLLED_PROVIDER_RECEIPT" | "BROWSER_RECEIPT" | "REHEARSAL_RECEIPT" | "DOCUMENTED_RUNBOOK" | "BUYER_EVIDENCE";
  reference: string;
  capturedAt?: string;
  buildSha?: string;
}

export interface V2ReleaseGate {
  id: V2ReleaseGateId;
  label: string;
  state: V2ReleaseEvidenceState;
  releaseBlocking: boolean;
  evidence?: V2ReleaseEvidenceReference;
  blockers: string[];
  noClaimNotes: string[];
}

export interface V2ReleaseReadinessRegistry {
  generatedAt: string;
  buildSha?: string;
  gates: V2ReleaseGate[];
  productionReleaseReady: boolean;
  blockingGateIds: V2ReleaseGateId[];
}

export interface V2ReleaseEvidenceInput {
  buildSha?: string;
  generatedAt: string;
  canonicalExecutable?: V2ReleaseEvidenceReference;
  responsiveBrowser?: V2ReleaseEvidenceReference;
  providerEvidence?: Partial<Record<
    "WHATSAPP_PROVIDER" | "GOOGLE_CALENDAR_PROVIDER" | "EMAIL_PROVIDER" | "N8N_PROVIDER" | "AI_PROVIDER" | "EMAIL_INBOUND" | "VOICE_INBOUND",
    V2ReleaseEvidenceReference
  >>;
  migrationRehearsal?: V2ReleaseEvidenceReference;
  operatorRunbook?: V2ReleaseEvidenceReference;
  secondVerticalBuyerEvidence?: V2ReleaseEvidenceReference;
}

const providerGate = (
  id: Extract<V2ReleaseGateId, "WHATSAPP_PROVIDER" | "GOOGLE_CALENDAR_PROVIDER" | "EMAIL_PROVIDER" | "N8N_PROVIDER" | "AI_PROVIDER" | "EMAIL_INBOUND" | "VOICE_INBOUND">,
  label: string,
  evidence: V2ReleaseEvidenceReference | undefined,
): V2ReleaseGate => ({
  id,
  label,
  state: evidence?.kind === "CONTROLLED_PROVIDER_RECEIPT" ? "PROVIDER_VERIFIED" : "CONFIGURATION_BLOCKED",
  releaseBlocking: true,
  evidence,
  blockers: evidence ? [] : ["CONTROLLED_PROVIDER_PROOF_REQUIRED"],
  noClaimNotes: evidence
    ? ["Provider verification is limited to the exact operation/build represented by the receipt."]
    : ["Implementation, configuration, fixtures and authored tests do not imply provider verification."],
});

function buildBoundEvidence(
  evidence: V2ReleaseEvidenceReference | undefined,
  expectedBuildSha: string | undefined,
  expectedKind: V2ReleaseEvidenceReference["kind"],
): V2ReleaseEvidenceReference | undefined {
  if (!evidence || evidence.kind !== expectedKind) return undefined;
  if (expectedBuildSha && evidence.buildSha !== expectedBuildSha) return undefined;
  return evidence;
}

export function buildV2ReleaseReadinessRegistry(
  input: V2ReleaseEvidenceInput,
): V2ReleaseReadinessRegistry {
  const build = input.buildSha?.trim() || undefined;
  const executable = buildBoundEvidence(input.canonicalExecutable, build, "BUILD_RECEIPT");
  const browser = buildBoundEvidence(input.responsiveBrowser, build, "BROWSER_RECEIPT");
  const migration = buildBoundEvidence(input.migrationRehearsal, build, "REHEARSAL_RECEIPT");
  const secondVertical = input.secondVerticalBuyerEvidence?.kind === "BUYER_EVIDENCE"
    ? input.secondVerticalBuyerEvidence
    : undefined;

  const gates: V2ReleaseGate[] = [
    {
      id: "CANONICAL_EXECUTABLE",
      label: "Canonical executable gate",
      state: executable ? "CONTRACT_TESTED" : "IMPLEMENTED",
      releaseBlocking: true,
      evidence: executable,
      blockers: executable ? [] : ["EXACT_BUILD_RECEIPT_REQUIRED"],
      noClaimNotes: ["Source implementation alone is not executable release evidence."],
    },
    {
      id: "RESPONSIVE_BROWSER",
      label: "Responsive browser acceptance",
      state: browser ? "OPERATIONS_VERIFIED" : "CONFIGURATION_BLOCKED",
      releaseBlocking: true,
      evidence: browser,
      blockers: browser ? [] : ["DESKTOP_TABLET_MOBILE_BROWSER_RECEIPT_REQUIRED"],
      noClaimNotes: ["Unit/e2e source tests do not substitute for the requested real-browser acceptance matrix."],
    },
    providerGate("WHATSAPP_PROVIDER", "WhatsApp controlled provider proof", input.providerEvidence?.WHATSAPP_PROVIDER),
    providerGate("GOOGLE_CALENDAR_PROVIDER", "Google Calendar controlled provider proof", input.providerEvidence?.GOOGLE_CALENDAR_PROVIDER),
    providerGate("EMAIL_PROVIDER", "Email controlled provider proof", input.providerEvidence?.EMAIL_PROVIDER),
    providerGate("N8N_PROVIDER", "Webhook / n8n controlled provider proof", input.providerEvidence?.N8N_PROVIDER),
    providerGate("AI_PROVIDER", "AI provider/model controlled proof", input.providerEvidence?.AI_PROVIDER),
    {
      id: "PAYMENT_SANDBOX",
      label: "Payment sandbox authority",
      state: "CONTRACT_TESTED",
      releaseBlocking: false,
      blockers: [],
      noClaimNotes: ["Payments remain sandbox/demo only. This gate never promotes to live-payment verification."],
    },
    providerGate("EMAIL_INBOUND", "Email inbound controlled proof", input.providerEvidence?.EMAIL_INBOUND),
    providerGate("VOICE_INBOUND", "Voice inbound controlled proof", input.providerEvidence?.VOICE_INBOUND),
    {
      id: "PHOTO_ASSISTED_INTAKE",
      label: "Photo-assisted intake authority",
      state: "CONTRACT_TESTED",
      releaseBlocking: false,
      blockers: [],
      noClaimNotes: ["Photo AI suggestions remain advisory and require human review; they cannot author quote/payment truth."],
    },
    {
      id: "SECOND_VERTICAL",
      label: "Second vertical buyer evidence",
      state: secondVertical ? "OPERATIONS_VERIFIED" : "BUYER_EVIDENCE_BLOCKED",
      releaseBlocking: false,
      evidence: secondVertical,
      blockers: secondVertical ? [] : ["TWO_REAL_BUYERS_WITH_SHARED_MODEL_REQUIRED"],
      noClaimNotes: ["Only Cleaning is released. Do not claim or activate a second vertical without real buyer evidence."],
    },
    {
      id: "MIGRATION_REHEARSAL",
      label: "V2 migration upgrade / rollback rehearsal",
      state: migration ? "OPERATIONS_VERIFIED" : "CONFIGURATION_BLOCKED",
      releaseBlocking: true,
      evidence: migration,
      blockers: migration ? [] : ["NON_PRODUCTION_REHEARSAL_RECEIPT_REQUIRED"],
      noClaimNotes: ["Migration source/tests do not prove an operational upgrade/rollback rehearsal."],
    },
    {
      id: "OPERATOR_RUNBOOK",
      label: "Operator/support release runbook",
      state: input.operatorRunbook?.kind === "DOCUMENTED_RUNBOOK" ? "CONTRACT_TESTED" : "IMPLEMENTED",
      releaseBlocking: true,
      evidence: input.operatorRunbook?.kind === "DOCUMENTED_RUNBOOK" ? input.operatorRunbook : undefined,
      blockers: input.operatorRunbook?.kind === "DOCUMENTED_RUNBOOK" ? [] : ["RELEASE_RUNBOOK_REQUIRED"],
      noClaimNotes: ["A runbook documents procedure; it does not substitute for provider or browser proof."],
    },
  ];

  const blockingGateIds = gates.filter((gate) =>
    gate.releaseBlocking
    && !["CONTRACT_TESTED", "PROVIDER_VERIFIED", "OPERATIONS_VERIFIED"].includes(gate.state))
    .map((gate) => gate.id);

  return {
    generatedAt: input.generatedAt,
    buildSha: build,
    gates,
    productionReleaseReady: blockingGateIds.length === 0,
    blockingGateIds,
  };
}
