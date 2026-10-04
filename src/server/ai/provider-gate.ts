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
  if (!input.modelApiKeyConfigured) missing.push("model_api_key");
  if (!input.approvedKnowledgeIndexConfigured) missing.push("approved_knowledge_index");
  if (!input.toolAllowlistConfigured) missing.push("tool_allowlist");
  return missing;
}

function pendingProof(input: AiProviderReadinessInput): string[] {
  const pending: string[] = [];
  if (!input.controlledExtractionObserved) pending.push("controlled_extraction_observation");
  if (!input.controlledKnowledgeCitationObserved) pending.push("controlled_knowledge_citation_observation");
  if (!input.handoverRoutingObserved) pending.push("controlled_handover_routing_observation");
  return pending;
}

function statusFor(missing: string[], pendingControlledProof: string[]): ProviderVerificationState {
  if (missing.length > 0) return "CONFIGURATION_BLOCKED";
  if (pendingControlledProof.length > 0) return "CONTRACT_TESTED";
  return "PROVIDER_VERIFIED";
}

export function evaluateAiProviderReadiness(input: AiProviderReadinessInput): AiProviderReadiness {
  const missing = missingConfig(input);
  const pendingControlledProof = pendingProof(input);
  const status = statusFor(missing, pendingControlledProof);

  return {
    workspaceId: input.workspaceId,
    provider: "AI",
    status,
    missing,
    pendingControlledProof,
    evidence: {
      provider: "AI",
      mode: "SANDBOX",
      verification: status,
      capturedAt: input.now ?? new Date().toISOString(),
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
