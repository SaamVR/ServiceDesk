import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(join(process.cwd(),
  "scripts/release/v4-staging-operational-counts-readonly.sql"), "utf8");
const body = sql.replace(/--[^\n]*/g, "");

describe("R49 release guardian: strictly read-only V4 schema and grant preflight", () => {
  it("never changes data/schema or exposes identities, customer records or secrets", () => {
    expect(sql).toContain("BEGIN TRANSACTION READ ONLY;");
    expect(sql).toContain("COMMIT;");
    expect(body).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP|GRANT|REVOKE|CREATE)\s+(?:INTO|FROM|TABLE|ON|FUNCTION|POLICY|ROLE|SCHEMA|VIEW|TRIGGER)\b/i);
    expect(body).not.toMatch(/\b(?:auth\.users|customer_email|phone_number|customer_name|address_line|provider_token|SUPABASE_SERVICE_ROLE_KEY)\b/i);
    expect(sql).not.toContain("SELECT * FROM public.memberships");
  });
  it("distinguishes 0063 journal/RLS/trigger/lease grants from saved customer flow", () => {
    for (const term of [
      "quoteJournalRlsEnabled", "quoteJournalTriggerPresent",
      "anonymousJournalClaimDenied", "authenticatedJournalCompleteDenied",
      "SCHEMA_METADATA_PRESENT_STAGING_AUTHORIZATION_UNVERIFIED",
      "BLOCKED_SOURCE_JOURNAL_SCHEMA_OR_GRANTS",
      "servicedesk_claim_quote_source_events(text,integer)",
      "servicedesk_complete_quote_source_event(uuid,text,text,text)",
      "servicedesk_quote_accept_source_event",
    ])expect(sql).toContain(term);
    expect(sql).toContain("CROSS JOIN security_metadata");
    expect(sql).toContain("NOT_PROVEN_BY_SCHEMA_METADATA");
  });
  it("never certifies owner pricing revision and 0065 tenancy from RPC names alone", () => {
    expect(sql).toContain("ownerPricingRevisionRpcInstalled");
    expect(sql).toContain("defaultBranchRpcPresentNotMembershipVerified");
    expect(sql).toContain("NOT_PROVEN_BY_RPC_EXISTENCE");
    expect(sql).toContain("RPC_PRESENT_OWNER_AUTHORIZATION_UNVERIFIED");
    expect(sql).toContain("ownerRequestQuoteUat");
    expect(sql).toContain("crossTenantRlsUat");
    expect(sql).toContain("providerDeliveryUat");
    expect(sql).not.toContain("'ownerRequestQuoteUat', 'PASS'");
  });
});
