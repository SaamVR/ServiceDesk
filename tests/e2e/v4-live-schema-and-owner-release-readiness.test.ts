import { describe, expect, it } from "vitest";
import { buildOperationalReleaseReadiness } from "../../src/features/operations/release-readiness-runtime";

const sha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const base = {
  RENDER_GIT_COMMIT: sha,
  SERVICEDESK_CANONICAL_RC_RECEIPT: "rc:redacted:exact-build",
  SERVICEDESK_CANONICAL_RC_BUILD_SHA: sha,
  SERVICEDESK_BROWSER_ACCEPTANCE_RECEIPT: "browser:redacted:responsive",
  SERVICEDESK_BROWSER_ACCEPTANCE_BUILD_SHA: sha,
  SERVICEDESK_STAFF_BROWSER_ACCEPTANCE_RECEIPT: "staff-browser:redacted:authorized",
  SERVICEDESK_STAFF_BROWSER_ACCEPTANCE_BUILD_SHA: sha,
  SERVICEDESK_MIGRATION_REHEARSAL_RECEIPT: "rehearsal:redacted:pg17",
  SERVICEDESK_MIGRATION_REHEARSAL_BUILD_SHA: sha,
};
const schemaKey = "SERVICEDESK_SCHEMA_APPLIED_RECEIPT";
const schemaSha = "SERVICEDESK_SCHEMA_APPLIED_BUILD_SHA";
const ownerKey = "SERVICEDESK_OWNER_JOURNEY_RECEIPT";
const ownerSha = "SERVICEDESK_OWNER_JOURNEY_BUILD_SHA";
const quoteKey = "SERVICEDESK_QUOTE_ATTENTION_RECEIPT";
const quoteSha = "SERVICEDESK_QUOTE_ATTENTION_BUILD_SHA";
const complete = {
  ...base,
  [schemaKey]: "schema-applied:redacted:verified-target",
  [schemaSha]: sha,
  [ownerKey]: "owner-journey:redacted:cleaning-actual",
  [ownerSha]: sha,
  [quoteKey]: "quote-attention:redacted:stored-ledger",
  [quoteSha]: sha,
};
const byId = (env: Record<string, string>) => {
  const result = buildOperationalReleaseReadiness([], env);
  const state = (id: string) => result.gates.find(gate => gate.id === id)?.state;
  return { result, state };
};

describe("V4 source vs real operational readiness boundary", () => {
  it("never declares release-ready from green source/browser/migration rehearsal alone", () => {
    const { result, state } = byId(base);
    expect(result.productionReleaseReady).toBe(false);
    expect(state("CANONICAL_EXECUTABLE")).toBe("CONTRACT_TESTED");
    expect(state("MIGRATION_REHEARSAL")).toBe("OPERATIONS_VERIFIED");
    expect(state("STAGING_SCHEMA_APPLIED")).toBe("CONFIGURATION_BLOCKED");
    expect(state("OWNER_FIRST_RUN_JOURNEY")).toBe("CONFIGURATION_BLOCKED");
    expect(state("QUOTE_ACCEPTED_INTERNAL_ATTENTION")).toBe("CONFIGURATION_BLOCKED");
    expect(result.blockingCount).toBe(3);
  });

  it("requires three distinct scoped, build-bound receipts for operations readiness", () => {
    const { result, state } = byId(complete);
    expect(state("STAGING_SCHEMA_APPLIED")).toBe("OPERATIONS_VERIFIED");
    expect(state("OWNER_FIRST_RUN_JOURNEY")).toBe("OPERATIONS_VERIFIED");
    expect(state("QUOTE_ACCEPTED_INTERNAL_ATTENTION")).toBe("OPERATIONS_VERIFIED");
    expect(result.productionReleaseReady).toBe(true);
    expect(result.blockingCount).toBe(0);
  });

  it("rejects old builds and reused public browser receipts even if they have a valid shape", () => {
    for (const candidate of [
      { [schemaSha]: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
      { [schemaKey]: "browser:redacted:responsive" },
      { [ownerKey]: "schema-applied:redacted:verified-target" },
      { [quoteKey]: "owner-journey:redacted:cleaning-actual" },
      { [quoteSha]: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
    ]) {
      const { result } = byId({ ...complete, ...candidate });
      expect(result.productionReleaseReady).toBe(false);
      expect(result.blockingCount).toBeGreaterThan(0);
    }
  });

  it("does not count missing build SHA or user-typed proof as actual acceptance", () => {
    const { result } = byId({
      ...complete, RENDER_GIT_COMMIT: "",
      SERVICEDESK_BUILD_SHA: "",
      [schemaKey]: "schema-applied:redacted:verified-target",
      [ownerKey]: "owner-journey:redacted:cleaning-actual",
    });
    expect(result.productionReleaseReady).toBe(false);
    expect(result.gates.filter(g => g.blocking && g.state === "CONFIGURATION_BLOCKED").length)
      .toBeGreaterThanOrEqual(3);
  });

  it("explains the actual operator tasks instead of claiming configured automation is delivered", () => {
    const { result } = byId(base);
    expect(result.gates.find(g => g.id === "STAGING_SCHEMA_APPLIED")?.note)
      .toContain("connected staging");
    expect(result.gates.find(g => g.id === "OWNER_FIRST_RUN_JOURNEY")?.note)
      .toContain("branch rates");
    expect(result.gates.find(g => g.id === "QUOTE_ACCEPTED_INTERNAL_ATTENTION")?.note)
      .toContain("persisted event/attention");
  });
});
