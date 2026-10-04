import { describe, expect, test } from "vitest";
import { evaluateAiProviderReadiness, summarizeAiProviderReadiness } from "../../src/server/ai/provider-gate";

describe("AI provider readiness gate", () => {
  test("blocks provider verification when model key is missing", () => {
    const readiness = evaluateAiProviderReadiness({
      workspaceId: "ws-clearnest",
      modelApiKeyConfigured: false,
      approvedKnowledgeIndexConfigured: true,
      toolAllowlistConfigured: true,
      controlledExtractionObserved: true,
      controlledKnowledgeCitationObserved: true,
      handoverRoutingObserved: true,
    });

    expect(readiness.status).toBe("CONFIGURATION_BLOCKED");
    expect(readiness.missing).toContain("model_api_key");
    expect(readiness.evidence.verification).toBe("CONFIGURATION_BLOCKED");
  });

  test("keeps configured AI as contract-tested until controlled observations exist", () => {
    const readiness = evaluateAiProviderReadiness({
      workspaceId: "ws-clearnest",
      modelApiKeyConfigured: true,
      approvedKnowledgeIndexConfigured: true,
      toolAllowlistConfigured: true,
      controlledExtractionObserved: false,
      controlledKnowledgeCitationObserved: false,
      handoverRoutingObserved: false,
    });

    expect(readiness.status).toBe("CONTRACT_TESTED");
    expect(readiness.missing).toEqual([]);
    expect(readiness.pendingControlledProof).toContain("controlled_extraction_observation");
  });

  test("marks AI provider verified only when controlled observations exist", () => {
    const readiness = evaluateAiProviderReadiness({
      workspaceId: "ws-clearnest",
      modelApiKeyConfigured: true,
      approvedKnowledgeIndexConfigured: true,
      toolAllowlistConfigured: true,
      controlledExtractionObserved: true,
      controlledKnowledgeCitationObserved: true,
      handoverRoutingObserved: true,
    });

    expect(readiness.status).toBe("PROVIDER_VERIFIED");
    expect(readiness.evidence.verification).toBe("PROVIDER_VERIFIED");
  });

  test("summary omits prompts, API keys, and customer text", () => {
    const summary = summarizeAiProviderReadiness(
      evaluateAiProviderReadiness({
        workspaceId: "ws-clearnest",
        modelApiKeyConfigured: true,
        approvedKnowledgeIndexConfigured: true,
        toolAllowlistConfigured: true,
        controlledExtractionObserved: true,
        controlledKnowledgeCitationObserved: true,
        handoverRoutingObserved: true,
      }),
    );

    expect(summary).toEqual({
      workspaceId: "ws-clearnest",
      provider: "AI",
      status: "PROVIDER_VERIFIED",
      missing: [],
      pendingControlledProof: [],
    });
  });
});
