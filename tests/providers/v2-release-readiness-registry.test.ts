import { describe, expect, it } from "vitest";
import {
  buildV2ReleaseReadinessRegistry,
  type V2ReleaseEvidenceReference,
} from "../../src/server/release/v2-release-readiness";

const buildSha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const now = "2026-10-10T00:00:00.000Z";
const ref = (
  kind: V2ReleaseEvidenceReference["kind"],
  reference: string,
): V2ReleaseEvidenceReference => ({
  kind,
  reference,
  buildSha,
  capturedAt: now,
});

describe("V2 release readiness registry", () => {
  it("keeps browser/provider/migration gates blocked when evidence is absent", () => {
    const registry = buildV2ReleaseReadinessRegistry({ buildSha, generatedAt: now });
    expect(registry.productionReleaseReady).toBe(false);
    expect(registry.gates.find((gate) => gate.id === "CANONICAL_EXECUTABLE")?.state).toBe("IMPLEMENTED");
    expect(registry.gates.find((gate) => gate.id === "RESPONSIVE_BROWSER")?.state).toBe("CONFIGURATION_BLOCKED");
    expect(registry.gates.find((gate) => gate.id === "WHATSAPP_PROVIDER")?.state).toBe("CONFIGURATION_BLOCKED");
    expect(registry.gates.find((gate) => gate.id === "MIGRATION_REHEARSAL")?.state).toBe("CONFIGURATION_BLOCKED");
    expect(registry.gates.find((gate) => gate.id === "SECOND_VERTICAL")?.state).toBe("BUYER_EVIDENCE_BLOCKED");
  });

  it("promotes only evidence with the expected kind and exact build binding", () => {
    const registry = buildV2ReleaseReadinessRegistry({
      buildSha,
      generatedAt: now,
      canonicalExecutable: ref("BUILD_RECEIPT", "render:rc-1"),
      responsiveBrowser: ref("BROWSER_RECEIPT", "browser:matrix-1"),
      migrationRehearsal: ref("REHEARSAL_RECEIPT", "rehearsal:1"),
      operatorRunbook: { kind: "DOCUMENTED_RUNBOOK", reference: "docs/runbook.md" },
      providerEvidence: {
        WHATSAPP_PROVIDER: ref("CONTROLLED_PROVIDER_RECEIPT", "provider:wa-1"),
      },
    });
    expect(registry.gates.find((gate) => gate.id === "CANONICAL_EXECUTABLE")?.state).toBe("CONTRACT_TESTED");
    expect(registry.gates.find((gate) => gate.id === "RESPONSIVE_BROWSER")?.state).toBe("OPERATIONS_VERIFIED");
    expect(registry.gates.find((gate) => gate.id === "MIGRATION_REHEARSAL")?.state).toBe("OPERATIONS_VERIFIED");
    expect(registry.gates.find((gate) => gate.id === "WHATSAPP_PROVIDER")?.state).toBe("PROVIDER_VERIFIED");
  });

  it("rejects stale-build receipts instead of silently carrying them forward", () => {
    const registry = buildV2ReleaseReadinessRegistry({
      buildSha,
      generatedAt: now,
      canonicalExecutable: {
        ...ref("BUILD_RECEIPT", "render:old"),
        buildSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
      responsiveBrowser: {
        ...ref("BROWSER_RECEIPT", "browser:old"),
        buildSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
    });
    expect(registry.gates.find((gate) => gate.id === "CANONICAL_EXECUTABLE")?.state).toBe("IMPLEMENTED");
    expect(registry.gates.find((gate) => gate.id === "RESPONSIVE_BROWSER")?.state).toBe("CONFIGURATION_BLOCKED");
  });

  it("never promotes payment sandbox to live provider verification", () => {
    const registry = buildV2ReleaseReadinessRegistry({ buildSha, generatedAt: now });
    const payment = registry.gates.find((gate) => gate.id === "PAYMENT_SANDBOX");
    expect(payment).toMatchObject({ state: "CONTRACT_TESTED", releaseBlocking: false });
    expect(payment?.noClaimNotes.join(" ")).toContain("sandbox/demo only");
  });

  it("keeps second vertical non-blocking but buyer-evidence blocked without two-buyer evidence", () => {
    const registry = buildV2ReleaseReadinessRegistry({ buildSha, generatedAt: now });
    const vertical = registry.gates.find((gate) => gate.id === "SECOND_VERTICAL");
    expect(vertical).toMatchObject({
      state: "BUYER_EVIDENCE_BLOCKED",
      releaseBlocking: false,
      blockers: ["TWO_REAL_BUYERS_WITH_SHARED_MODEL_REQUIRED"],
    });
  });

  it("reports production ready only when every release-blocking gate has qualifying evidence", () => {
    const provider = ref("CONTROLLED_PROVIDER_RECEIPT", "provider:receipt");
    const registry = buildV2ReleaseReadinessRegistry({
      buildSha,
      generatedAt: now,
      canonicalExecutable: ref("BUILD_RECEIPT", "render:rc"),
      responsiveBrowser: ref("BROWSER_RECEIPT", "browser:matrix"),
      migrationRehearsal: ref("REHEARSAL_RECEIPT", "migration:rehearsal"),
      operatorRunbook: { kind: "DOCUMENTED_RUNBOOK", reference: "docs/release-runbook.md" },
      providerEvidence: {
        WHATSAPP_PROVIDER: provider,
        GOOGLE_CALENDAR_PROVIDER: provider,
        EMAIL_PROVIDER: provider,
        N8N_PROVIDER: provider,
        AI_PROVIDER: provider,
        EMAIL_INBOUND: provider,
        VOICE_INBOUND: provider,
      },
    });
    expect(registry.blockingGateIds).toEqual([]);
    expect(registry.productionReleaseReady).toBe(true);
    expect(registry.gates.find((gate) => gate.id === "SECOND_VERTICAL")?.state).toBe("BUYER_EVIDENCE_BLOCKED");
  });
  it("never marks stale-build provider receipts as verified", () => {
    const staleProof = {
      ...ref("CONTROLLED_PROVIDER_RECEIPT", "provider:stale"),
      buildSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    };
    const registry = buildV2ReleaseReadinessRegistry({
      buildSha,
      generatedAt: now,
      providerEvidence: {
        WHATSAPP_PROVIDER: staleProof,
        EMAIL_PROVIDER: staleProof,
        EMAIL_INBOUND: staleProof,
        VOICE_INBOUND: staleProof,
      },
    });
    for (const id of ["WHATSAPP_PROVIDER", "EMAIL_PROVIDER", "EMAIL_INBOUND", "VOICE_INBOUND"]) {
      const gate = registry.gates.find((entry) => entry.id === id);
      expect(gate?.state).toBe("CONFIGURATION_BLOCKED");
      expect(gate?.evidence).toBeUndefined();
      expect(registry.blockingGateIds).toContain(id);
    }
  });

  it("does not accept provider, browser, build, or migration receipts without a current build SHA", () => {
    const provider = ref("CONTROLLED_PROVIDER_RECEIPT", "provider:receipt");
    const registry = buildV2ReleaseReadinessRegistry({
      generatedAt: now,
      canonicalExecutable: ref("BUILD_RECEIPT", "build:receipt"),
      responsiveBrowser: ref("BROWSER_RECEIPT", "browser:receipt"),
      migrationRehearsal: ref("REHEARSAL_RECEIPT", "rehearsal:receipt"),
      providerEvidence: { WHATSAPP_PROVIDER: provider },
    });
    expect(registry.productionReleaseReady).toBe(false);
    expect(registry.gates.find((gate) => gate.id === "CANONICAL_EXECUTABLE")?.state).toBe("IMPLEMENTED");
    expect(registry.gates.find((gate) => gate.id === "RESPONSIVE_BROWSER")?.state).toBe("CONFIGURATION_BLOCKED");
    expect(registry.gates.find((gate) => gate.id === "MIGRATION_REHEARSAL")?.state).toBe("CONFIGURATION_BLOCKED");
    expect(registry.gates.find((gate) => gate.id === "WHATSAPP_PROVIDER")?.state).toBe("CONFIGURATION_BLOCKED");
  });

  it("rejects a provider receipt with the correct SHA but the wrong evidence kind", () => {
    const registry = buildV2ReleaseReadinessRegistry({
      buildSha,
      generatedAt: now,
      providerEvidence: {
        GOOGLE_CALENDAR_PROVIDER: ref("BUILD_RECEIPT", "build:not-provider"),
      },
    });
    expect(registry.gates.find((gate) => gate.id === "GOOGLE_CALENDAR_PROVIDER")?.state)
      .toBe("CONFIGURATION_BLOCKED");
  });

});
