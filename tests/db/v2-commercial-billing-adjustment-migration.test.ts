import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0030_v2_commercial_billing_adjustments.sql"),
  "utf8",
);

describe("V2 commercial billing adjustments migration", () => {
  it("adds one service-role-only adjustment command without touching payment truth", () => {
    expect(sql).toContain("create or replace function public.servicedesk_add_commercial_billing_adjustment");
    expect(sql).toContain("revoke all on function public.servicedesk_add_commercial_billing_adjustment(jsonb) from public, anon, authenticated;");
    expect(sql).toContain("grant execute on function public.servicedesk_add_commercial_billing_adjustment(jsonb) to service_role;");
    expect(sql).not.toContain("insert into public.ledger_entries");
    expect(sql).not.toContain("verified_payment_applications");
    expect(sql).not.toContain("stripe");
  });

  it("requires a resolved exception with a complete requested adjustment", () => {
    expect(sql).toContain("v_case.state <> 'RESOLVED'");
    expect(sql).toContain("COMMERCIAL_ADJUSTMENT_EXCEPTION_NOT_RESOLVED");
    expect(sql).toContain("v_case.requested_adjustment_kind is null");
    expect(sql).toContain("v_case.requested_adjustment_minor is null");
    expect(sql).toContain("v_case.requested_adjustment_currency is null");
    expect(sql).toContain("COMMERCIAL_ADJUSTMENT_NOT_REQUESTED");
  });

  it("fails closed across contract version, organization, contract and currency boundaries", () => {
    expect(sql).toContain("v_case.contract_version_id is null or v_case.contract_version_id <> v_draft.contract_version_id");
    expect(sql).toContain("COMMERCIAL_ADJUSTMENT_CONTRACT_VERSION_MISMATCH");
    expect(sql).toContain("v_case.organization_id <> v_draft.organization_id or v_case.contract_id <> v_draft.contract_id");
    expect(sql).toContain("COMMERCIAL_ADJUSTMENT_CONTRACT_MISMATCH");
    expect(sql).toContain("v_case.requested_adjustment_currency <> v_draft.currency");
    expect(sql).toContain("COMMERCIAL_ADJUSTMENT_CURRENCY_MISMATCH");
  });

  it("keeps draft edits optimistic and disallows finalized-draft mutation", () => {
    expect(sql).toContain("v_draft.state <> 'DRAFT'");
    expect(sql).toContain("COMMERCIAL_BILLING_DRAFT_LOCKED");
    expect(sql).toContain("v_draft.version <> v_expected");
    expect(sql).toContain("COMMERCIAL_BILLING_VERSION_CONFLICT");
  });

  it("snapshots provenance without copying exception narrative into invoice lines", () => {
    expect(sql).toContain("'ADJUSTMENT'");
    expect(sql).toContain("'exceptionType', v_case.type");
    expect(sql).toContain("'siteId', v_case.site_id");
    expect(sql).toContain("'visitId', v_case.visit_id");
    expect(sql).toContain("'sourceCaseVersion', v_case.version");
    expect(sql).not.toContain("'summary', v_case.summary");
    expect(sql).not.toContain("'resolutionNote', v_case.resolution_note");
  });

  it("is idempotent for the same active draft and prevents cross-draft double inclusion", () => {
    expect(sql).toContain("exception_case_id = v_exception_id");
    expect(sql).toContain("and state = 'INCLUDED'");
    expect(sql).toContain("v_existing.draft_id = v_draft.id");
    expect(sql).toContain("'duplicate', true");
    expect(sql).toContain("COMMERCIAL_ADJUSTMENT_ALREADY_INCLUDED");
  });
});
