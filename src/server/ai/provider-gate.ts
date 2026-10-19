import type { ProviderVerificationState, RedactedProviderEvidence } from "../integrations/types";

export interface AiProviderReadinessInput {
  workspaceId: string;
  modelApiKeyConfigured: boolean;
  approvedKnowledgeIndexConfigured: boolean;
  toolAllowlistConfigured: boolean;
  controlledExtractionObserved: boolean;
  controlledKnowledgeCitationObserved: boolean;
  handoverRoutingObserved: boolean;
  now?: string;
}

export interface AiProviderReadiness {
  workspaceId: string;
  provider: "AI";
  status: ProviderVerificationState;
  missing: string[];
  pendingControlledProof: string[];
  evidence: RedactedProviderEvidence;
}

export interface AiProviderReadinessSummary {
  workspaceId: string;
  provider: "AI";
  status: ProviderVerificationState;
  missing: string[];
  pendingControlledProof: string[];
}

function missingConfig(input: AiProviderReadinessInput): string[] {
  const missing: string[] = [];
  if (input.modelApiKeyConfigured !== true) missing.push("model_api_key");
  if (input.approvedKnowledgeIndexConfigured !== true) missing.push("approved_knowledge_index");
  if (input.toolAllowlistConfigured !== true) missing.push("tool_allowlist");
  return missing;
}

function pendingProof(input: AiProviderReadinessInput): string[] {
  const pending: string[] = [];
  if (input.controlledExtractionObserved !== true) pending.push("controlled_extraction_observation");
  if (input.controlledKnowledgeCitationObserved !== true) pending.push("controlled_knowledge_citation_observation");
  if (input.handoverRoutingObserved !== true) pending.push("controlled_handover_routing_observation");
  // Configuration flags and caller-asserted observations are not a signed,
  // provider-issued inference receipt. No such verified receipt is loaded
  // here; claiming PROVIDER_VERIFIED from three booleans would falsely
  // promote an untested merchant connector into a functioning AI agent.
  pending.push("persisted_authenticated_provider_receipt");
  return pending;
}

function statusFor(missing: string[], pendingControlledProof: string[]): ProviderVerificationState {
  if (missing.length > 0) return "CONFIGURATION_BLOCKED";
  if (pendingControlledProof.length > 0) return "CONTRACT_TESTED";
  return "PROVIDER_VERIFIED";
}

export function evaluateAiProviderReadiness(input: AiProviderReadinessInput): AiProviderReadiness {
  // An operator diagnostic is not allowed to become a token/PII reflector.
  // Only an opaque workspace scope and an actual civil-valid UTC clock
  // belong in any redacted provider evidence record.
  const validWorkspace = typeof input.workspaceId === "string" &&
    /^[A-Za-z0-9:_-]{3,128}$/.test(input.workspaceId);
  const capturedAt = input.now ?? new Date().toISOString();
  const validClock = typeof capturedAt === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(capturedAt) &&
    Number.isFinite(Date.parse(capturedAt)) &&
    new Date(Date.parse(capturedAt)).toISOString() === capturedAt;
  const missing = missingConfig(input);
  if (!validWorkspace) missing.push("workspace_identity");
  if (!validClock) missing.push("evidence_clock");
  const pendingControlledProof = pendingProof(input);
  const status = statusFor(missing, pendingControlledProof);

  return {
    workspaceId: validWorkspace ? input.workspaceId : "unverified-workspace",
    provider: "AI",
    status,
    missing,
    pendingControlledProof,
    evidence: {
      provider: "AI",
      mode: "SANDBOX",
      verification: status,
      capturedAt: validClock ? capturedAt : "unverified-time",
      notes: [
        "AI provider readiness is based on configuration and controlled observations only.",
        "Prompts, customer text, API keys, and raw model payloads are intentionally omitted.",
        ...missing.map((item) => `Missing configuration: ${item}.`),
        ...pendingControlledProof.map((item) => `Pending controlled proof: ${item}.`),
      ],
    },
  };
}

export function summarizeAiProviderReadiness(readiness: AiProviderReadiness): AiProviderReadinessSummary {
  return {
    workspaceId: readiness.workspaceId,
    provider: readiness.provider,
    status: readiness.status,
    missing: [...readiness.missing],
    pendingControlledProof: [...readiness.pendingControlledProof],
  };
}
