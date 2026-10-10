import { describe, expect, it } from "vitest";
import { buildOperationalReleaseReadiness } from "../../src/features/operations/release-readiness-runtime";
import type { OperationalIntegrationHealth } from "../../src/features/operations/integration-health-runtime";

const integrations: OperationalIntegrationHealth[] = [
  {
    provider: "WHATSAPP",
    label: "WhatsApp",
    mode: "LIVE",
    configurationState: "CONFIGURED",
    verificationState: "IMPLEMENTED",
    missingConfiguration: [],
    canRunControlledProof: true,
    source: "SERVER_CONFIGURATION_PRESENCE",
    message: "Controlled provider proof required.",
  },
  {
    provider: "PAYMENT",
    label: "Payments",
    mode: "SANDBOX",
    configurationState: "CONFIGURED",
    verificationState: "CONTRACT_TESTED",
    missingConfiguration: [],
    canRunControlledProof: true,
    source: "INTERNAL_SANDBOX",
    message: "Sandbox only.",
  },
];

describe("operator release readiness view", () => {
  it("does not promote build/browser/migration state from build SHA alone", () => {
    const view = buildOperationalReleaseReadiness(integrations, {
      RENDER_GIT_COMMIT: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
    expect(view.productionReleaseReady).toBe(false);
    expect(view.gates.find((gate) => gate.id === "CANONICAL_EXECUTABLE")?.state).toBe("CONFIGURATION_BLOCKED");
    expect(view.gates.find((gate) => gate.id === "RESPONSIVE_BROWSER")?.state).toBe("CONFIGURATION_BLOCKED");
    expect(view.gates.find((gate) => gate.id === "AUTHENTICATED_STAFF_BROWSER")?.state).toBe("CONFIGURATION_BLOCKED");
    expect(view.gates.find((gate) => gate.id === "MIGRATION_REHEARSAL")?.state).toBe("CONFIGURATION_BLOCKED");
  });

  it("requires redacted receipts bound to the exact current build", () => {
    const sha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const view = buildOperationalReleaseReadiness(integrations, {
      RENDER_GIT_COMMIT: sha,
      SERVICEDESK_CANONICAL_RC_RECEIPT: "rc:redacted:render-001",
      SERVICEDESK_CANONICAL_RC_BUILD_SHA: sha,
      SERVICEDESK_BROWSER_ACCEPTANCE_RECEIPT: "browser:redacted:matrix-001",
      SERVICEDESK_BROWSER_ACCEPTANCE_BUILD_SHA: sha,
      SERVICEDESK_STAFF_BROWSER_ACCEPTANCE_RECEIPT: "staff-browser:redacted:staff-001",
      SERVICEDESK_STAFF_BROWSER_ACCEPTANCE_BUILD_SHA: sha,
      SERVICEDESK_MIGRATION_REHEARSAL_RECEIPT: "rehearsal:redacted:run-001",
      SERVICEDESK_MIGRATION_REHEARSAL_BUILD_SHA: sha,
    });
    expect(view.gates.find((gate) => gate.id === "CANONICAL_EXECUTABLE")?.state).toBe("CONTRACT_TESTED");
    expect(view.gates.find((gate) => gate.id === "RESPONSIVE_BROWSER")?.state).toBe("OPERATIONS_VERIFIED");
    expect(view.gates.find((gate) => gate.id === "AUTHENTICATED_STAFF_BROWSER")?.state).toBe("OPERATIONS_VERIFIED");
    expect(view.gates.find((gate) => gate.id === "MIGRATION_REHEARSAL")?.state).toBe("OPERATIONS_VERIFIED");
  });

  it("keeps staff browser blocked when only the public-page browser matrix is evidenced", () => {
    const sha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const view = buildOperationalReleaseReadiness(integrations, {
      RENDER_GIT_COMMIT: sha,
      SERVICEDESK_BROWSER_ACCEPTANCE_RECEIPT: "browser:redacted:public-pages",
      SERVICEDESK_BROWSER_ACCEPTANCE_BUILD_SHA: sha,
    });
    expect(view.gates.find((gate) => gate.id === "RESPONSIVE_BROWSER")?.state).toBe("OPERATIONS_VERIFIED");
    expect(view.gates.find((gate) => gate.id === "AUTHENTICATED_STAFF_BROWSER")?.state).toBe("CONFIGURATION_BLOCKED");
    expect(view.productionReleaseReady).toBe(false);
  });

  it("rejects stale, mislabeled, and duplicated staff browser receipt references", () => {
    const sha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const receipt = "browser:redacted:public-pages";
    const proof = "staff-browser:redacted:staff-session";
    const base = {
      RENDER_GIT_COMMIT: sha,
      SERVICEDESK_BROWSER_ACCEPTANCE_RECEIPT: receipt,
      SERVICEDESK_BROWSER_ACCEPTANCE_BUILD_SHA: sha,
    };
    for (const candidate of [
      { SERVICEDESK_STAFF_BROWSER_ACCEPTANCE_RECEIPT: proof,
        SERVICEDESK_STAFF_BROWSER_ACCEPTANCE_BUILD_SHA: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
      { SERVICEDESK_STAFF_BROWSER_ACCEPTANCE_RECEIPT: receipt,
        SERVICEDESK_STAFF_BROWSER_ACCEPTANCE_BUILD_SHA: sha },
      { SERVICEDESK_STAFF_BROWSER_ACCEPTANCE_RECEIPT: "browser:redacted:staff-session",
        SERVICEDESK_STAFF_BROWSER_ACCEPTANCE_BUILD_SHA: sha },
    ]) {
      const view = buildOperationalReleaseReadiness(integrations, { ...base, ...candidate });
      expect(view.gates.find((gate) => gate.id === "AUTHENTICATED_STAFF_BROWSER")?.state)
        .toBe("CONFIGURATION_BLOCKED");
    }
  });

  it("keeps provider configuration separate from provider verification", () => {
    const view = buildOperationalReleaseReadiness(integrations, {});
    expect(view.gates.find((gate) => gate.id === "PROVIDER_WHATSAPP")).toMatchObject({
      state: "CONFIGURATION_BLOCKED",
      blocking: true,
    });
    expect(view.gates.find((gate) => gate.id === "PAYMENT_SANDBOX")).toMatchObject({
      state: "CONTRACT_TESTED",
      blocking: false,
    });
  });

  it("keeps second vertical buyer-evidence blocked and non-blocking", () => {
    const view = buildOperationalReleaseReadiness(integrations, {});
    expect(view.gates.find((gate) => gate.id === "SECOND_VERTICAL")).toMatchObject({
      state: "BUYER_EVIDENCE_BLOCKED",
      blocking: false,
    });
  });
});
