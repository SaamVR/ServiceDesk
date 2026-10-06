import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (name: string) =>
  readFileSync(join(process.cwd(), "supabase/migrations", name), "utf8");

const schema = source("0040_v2_tax_profile_schema.sql");
const read = source("0041_v2_tax_profile_read.sql");
const commands = source("0042_v2_tax_profile_commands.sql");

describe("V2 tax profile governance migrations", () => {
  it("creates provenance-backed tax profiles without seeding a default", () => {
    expect(schema).toContain("create table if not exists public.workspace_tax_profiles");
    expect(schema).toContain("provenance_kind");
    expect(schema).toContain("provenance_reference");
    expect(schema).toContain("rate_basis_points between 0 and 10000");
    expect(schema).not.toMatch(/insert into public\.workspace_tax_profiles/i);
    expect(schema).toContain("V1 synthetic zero tax is not promoted");
  });

  it("requires review metadata before a profile can be reviewed", () => {
    expect(schema).toContain("status in ('DRAFT','REVIEWED','RETIRED')");
    expect(schema).toContain("reviewed_by_user_id is not null");
    expect(schema).toContain("reviewed_at is not null");
    expect(schema).toContain("review_attestation is not null");
    expect(schema).toContain("workspace_tax_profiles_one_reviewed_key_uq");
  });

  it("keeps tax application explicitly off in the read contract", () => {
    expect(read).toContain("'automaticApplicationEnabled', false");
    expect(read).not.toContain("'automaticApplicationEnabled', true");
  });

  it("restricts tax mutations to owner authority", () => {
    expect(commands.match(/v_actor_role <> 'OWNER'/g)?.length).toBeGreaterThanOrEqual(3);
    expect(commands.match(/servicedesk_require_staff/g)?.length).toBeGreaterThanOrEqual(3);
    expect(commands).toContain("servicedesk_upsert_tax_profile");
    expect(commands).toContain("servicedesk_review_tax_profile");
    expect(commands).toContain("servicedesk_retire_tax_profile");
  });

  it("prevents reviewed profiles from being edited in place", () => {
    expect(commands).toContain("v_existing.status <> 'DRAFT'");
    expect(commands).toContain("TAX_PROFILE_LOCKED");
    expect(commands).toContain("TAX_PROFILE_VERSION_CONFLICT");
  });

  it("requires explicit review confirmation and attestation", () => {
    expect(commands).toContain("accountantReviewConfirmed");
    expect(commands).toContain("not v_confirmed");
    expect(commands).toContain("reviewAttestation");
    expect(commands).toContain("TAX_PROFILE_REVIEW_INPUT_INVALID");
  });

  it("does not recalculate invoices, quotes or ledger entries", () => {
    expect(commands).not.toMatch(/update public\.invoices/i);
    expect(commands).not.toMatch(/update public\.quotes/i);
    expect(commands).not.toMatch(/insert into public\.ledger_entries/i);
    expect(commands).not.toContain("review_attestation',");
  });

  it("keeps all mutation RPCs service-role-only", () => {
    for (const fn of [
      "servicedesk_upsert_tax_profile",
      "servicedesk_review_tax_profile",
      "servicedesk_retire_tax_profile",
    ]) {
      expect(commands).toContain(`revoke all on function public.${fn}(jsonb) from public, anon, authenticated;`);
      expect(commands).toContain(`grant execute on function public.${fn}(jsonb) to service_role;`);
    }
  });
});
