import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(join(process.cwd(),
  "scripts/release/v4-staging-operational-counts-readonly.sql"), "utf8");
const body = sql.replace(/--[^\n]*/g, "");

describe("V4 connected operator aggregate readiness preflight", () => {
  it("is an exclusively read-only transaction with no customer record exposure", () => {
    expect(sql).toContain("BEGIN TRANSACTION READ ONLY;");
    expect(sql).toContain("COMMIT;");
    expect(body).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP|GRANT|REVOKE|CREATE)\s+(?:INTO|FROM|TABLE|ON|FUNCTION|POLICY|ROLE|SCHEMA|VIEW|TRIGGER)\b/i);
    expect(body).not.toMatch(/\b(?:auth\.users|customer_email|phone_number|customer_name|address_line)\b/i);
    expect(sql).toContain("READ_ONLY_AGGREGATE_NOT_AUTHENTICATED_UAT");
    expect(sql).toContain("'workspaceRecords', workspaces");
    expect(sql).toContain("'membershipRecords', memberships");
    expect(sql).not.toContain("'activeMembers', memberships");
    expect(sql).not.toContain("'activeWorkspaces', workspaces");
  });
  it("reports the actual first-run pricing, customer-flow and automation blockers", () => {
    for (const field of [
      "activeCatalogServices", "activeBranchPriceBooks", "savedRequests",
      "acceptedQuotes", "recordedVisits", "recordedInvoices",
      "publishedWorkflowVersions", "recordedLiveExecutions",
      "succeededInternalActions", "optedInWorkspaces",
      "ownerPricingRpcInstalled", "quoteRecoveryJournalInstalled",
      "quoteRecoveryClaimInstalled",
    ]) expect(sql).toContain(field);
    expect(sql).toContain("BLOCKED_NO_ACTIVE_SERVICES");
    expect(sql).toContain("BLOCKED_NO_ACTIVE_BRANCH_PRICE_BOOKS");
    expect(sql).toContain("BLOCKED_NO_PUBLISHED_WORKFLOW");
  });
  it("never certifies a customer journey or provider delivery from aggregate rows", () => {
    expect(sql).toContain("NOT_PROVEN_BY_AGGREGATE_COUNTS");
    expect(sql).toContain("cannot certify any individual business");
    expect(sql).toContain("crossTenantRlsUat");
    expect(sql).toContain("providerDeliveryUat");
    expect(sql).toContain("ownerRequestQuoteUat");
    expect(sql).not.toContain("PROVIDER_DELIVERED");
  });
});
