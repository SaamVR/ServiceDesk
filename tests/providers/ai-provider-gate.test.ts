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

  test("refuses to promote provider verification from self-reported booleans alone", () => {
    const readiness = evaluateAiProviderReadiness({
      workspaceId: "ws-clearnest",
      modelApiKeyConfigured: true,
      approvedKnowledgeIndexConfigured: true,
      toolAllowlistConfigured: true,
      controlledExtractionObserved: true,
      controlledKnowledgeCitationObserved: true,
      handoverRoutingObserved: true,
    });

    expect(readiness.status).toBe("CONTRACT_TESTED");
    expect(readiness.evidence.verification).toBe("CONTRACT_TESTED");
    expect(readiness.pendingControlledProof).toEqual(["persisted_authenticated_provider_receipt"]);
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
      status: "CONTRACT_TESTED",
      missing: [],
      pendingControlledProof: ["persisted_authenticated_provider_receipt"],
    });
  });
  test("refuses string or numeric spoofing of provider readiness switches", () => {
    const spoofed = {
      workspaceId: "workspace-fictional",
      modelApiKeyConfigured: "false",
      approvedKnowledgeIndexConfigured: 1,
      toolAllowlistConfigured: "true",
      controlledExtractionObserved: "yes",
      controlledKnowledgeCitationObserved: "true",
      handoverRoutingObserved: "true",
    } as unknown as Parameters<typeof evaluateAiProviderReadiness>[0];
    const readiness = evaluateAiProviderReadiness(spoofed);
    expect(readiness.status).toBe("CONFIGURATION_BLOCKED");
    expect(readiness.missing).toEqual(["model_api_key","approved_knowledge_index","tool_allowlist"]);
    expect(readiness.pendingControlledProof).toContain("persisted_authenticated_provider_receipt");
    expect(readiness.pendingControlledProof).toContain("controlled_extraction_observation");
  });

  test("does not invent persisted provider receipts when everything is configured", () => {
    const readiness=evaluateAiProviderReadiness({
      workspaceId:"workspace-fictional",modelApiKeyConfigured:true,
      approvedKnowledgeIndexConfigured:true,toolAllowlistConfigured:true,
      controlledExtractionObserved:true,controlledKnowledgeCitationObserved:true,
      handoverRoutingObserved:true,
      now:"2026-10-19T14:00:00.000Z",
    });
    expect(readiness.evidence.notes.join(" ")).toContain("persisted_authenticated_provider_receipt");
    expect(readiness.evidence.verification).not.toBe("PROVIDER_VERIFIED");
    expect(JSON.stringify(readiness)).not.toMatch(/Bearer\s+[A-Za-z0-9_-]+/i);
  });

});
