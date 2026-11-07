import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyOwnerWorkspaceCreationReadback } from "../../src/features/auth/verified-owner-workspace";

const userId = "11111111-1111-4111-8111-111111111111";
const attackerId = "22222222-2222-4222-8222-222222222222";
const workspaceId = "33333333-3333-4333-8333-333333333333";
const requested = {
  slug: "actual-cleaning",
  name: "Actual Cleaning",
  timezone: "America/New_York",
  currency: "USD",
};
const saved = { id: workspaceId, ...requested };
const membership = { workspace_id: workspaceId, user_id: userId, role: "OWNER", status: "ACTIVE" };
const branchId = "55555555-5555-4555-8555-555555555555";
const defaultBranch = { id: branchId, workspace_id: workspaceId, code: "MAIN",
  timezone: requested.timezone, currency: requested.currency, is_default: true, active: true };
const branchOwner = { workspace_id: workspaceId, branch_id: branchId,
  user_id: userId, status: "ACTIVE" };

function signedInRlsReadback(options: {
  signedInId?: string | null;
  memberRows?: unknown;
  workspace?: unknown;
  memberError?: boolean;
  workspaceError?: boolean;
  branchRows?: unknown;
  branchOwnerRows?: unknown;
  branchError?: boolean;
  branchOwnerError?: boolean;
} = {}) {
  const reads: string[] = [];
  const auth = {
    auth: { async getUser() {
      reads.push("verified-user");
      return { data: { user: options.signedInId === null ? null : { id: options.signedInId ?? userId } }, error: null };
    } },
    from(table: string) {
      reads.push(table);
      if (table === "memberships") return {
        select() { return this; },
        eq() { return this; },
        async limit(count: number) {
          expect(count).toBe(21);
          return { data: options.memberRows === undefined ? [membership] : options.memberRows,
            error: options.memberError ? { code: "PERMISSION_DENIED" } : null };
        },
      };
      if (table === "workspaces") return {
        select() { return this; },
        in() { return this; },
        eq() { return this; },
        async maybeSingle() {
          return { data: options.workspace === undefined ? saved : options.workspace,
            error: options.workspaceError ? { code: "PERMISSION_DENIED" } : null };
        },
      };
      if (table === "workspace_branches") return {
        select() { return this; },
        eq() { return this; },
        async limit(count: number) {
          expect(count).toBe(2);
          return { data: options.branchRows === undefined ? [defaultBranch] : options.branchRows,
            error: options.branchError ? { code: "PERMISSION_DENIED" } : null };
        },
      };
      if (table === "branch_memberships") return {
        select() { return this; },
        eq() { return this; },
        async limit(count: number) {
          expect(count).toBe(2);
          return { data: options.branchOwnerRows === undefined ? [branchOwner] : options.branchOwnerRows,
            error: options.branchOwnerError ? { code: "PERMISSION_DENIED" } : null };
        },
      };
      throw Error("Unexpected RLS source");
    },
  } as unknown as SupabaseClient;
  return { auth, reads };
}

describe("P02 signed-in owner workspace registration has durable readback", () => {
  it("requires the verified saved owner and all submitted fields for a new business", async () => {
    const input = signedInRlsReadback();
    expect(await verifyOwnerWorkspaceCreationReadback(
      input.auth, userId, requested, { ok: true, slug: requested.slug, existing: false },
    )).toEqual({ ok: true, workspace: saved, existing: false });
    expect(input.reads).toEqual([
      "verified-user", "memberships", "workspaces", "workspace_branches", "branch_memberships",
    ]);
  });

  it("accepts the RPC's legitimate idempotent existing-owner path without inventing a new workspace", async () => {
    const existing = { ...saved, slug: "earlier-business", name: "Earlier Business", currency: "BDT" };
    const input = signedInRlsReadback({ workspace: existing });
    expect(await verifyOwnerWorkspaceCreationReadback(
      input.auth, userId, requested, { ok: true, slug: existing.slug, existing: true },
    )).toEqual({ ok: true, workspace: existing, existing: true });
  });

  it("never takes a success redirect from malformed, incomplete, or unexpected RPC output", async () => {
    for (const response of [
      null, [], "success", { ok: true, slug: requested.slug },
      { ok: true, slug: requested.slug, existing: "false" },
      { ok: true, slug: "../foreign", existing: true },
      { ok: true, slug: "other-business", existing: false },
      { ok: false, slug: requested.slug, existing: false },
    ]) {
      const input = signedInRlsReadback();
      expect(await verifyOwnerWorkspaceCreationReadback(input.auth, userId, requested, response))
        .toEqual({ ok: false, reason: "RPC_UNVERIFIED" });
      expect(input.reads).toEqual([]);
    }
  });

  it("refuses an unverified owner, revoked membership, foreign tenant or drifted saved fields", async () => {
    for (const input of [
      { signedInId: attackerId },
      { signedInId: null },
      { memberRows: [] },
      { memberRows: [{ ...membership, status: "REVOKED" }] },
      { memberRows: [{ ...membership, user_id: attackerId }] },
      { workspace: { ...saved, id: attackerId } },
      { workspace: { ...saved, name: "Unexpected name" } },
      { workspace: { ...saved, timezone: "UTC" } },
      { workspace: { ...saved, currency: "EUR" } },
      { memberError: true },
      { workspaceError: true },
    ]) {
      const stub = signedInRlsReadback(input);
      expect(await verifyOwnerWorkspaceCreationReadback(
        stub.auth, userId, requested, { ok: true, slug: requested.slug, existing: false },
      )).toEqual({ ok: false, reason: "PERSISTENCE_UNVERIFIED" });
    }
  });

  it("refuses a forged existing=true tenant without actual active owner membership", async () => {
    const stub = signedInRlsReadback({ memberRows: [] });
    expect(await verifyOwnerWorkspaceCreationReadback(
      stub.auth, userId, requested, { ok: true, slug: "foreign-business", existing: true },
    )).toEqual({ ok: false, reason: "PERSISTENCE_UNVERIFIED" });
    expect(stub.reads).not.toContain("workspaces");
  });

  it("refuses a registration receipt without a saved active MAIN branch and owner assignment", async () => {
    for (const options of [
      { branchRows: [] },
      { branchRows: null },
      { branchRows: [defaultBranch, defaultBranch] },
      { branchRows: [{ ...defaultBranch, id: attackerId }] },
      { branchRows: [{ ...defaultBranch, workspace_id: attackerId }] },
      { branchRows: [{ ...defaultBranch, active: false }] },
      { branchRows: [{ ...defaultBranch, is_default: false }] },
      { branchRows: [{ ...defaultBranch, code: "OTHER" }] },
      { branchRows: [{ ...defaultBranch, timezone: "UTC" }] },
      { branchRows: [{ ...defaultBranch, currency: "BDT" }] },
      { branchError: true },
      { branchOwnerRows: [] },
      { branchOwnerRows: null },
      { branchOwnerRows: [branchOwner, branchOwner] },
      { branchOwnerRows: [{ ...branchOwner, workspace_id: attackerId }] },
      { branchOwnerRows: [{ ...branchOwner, branch_id: attackerId }] },
      { branchOwnerRows: [{ ...branchOwner, user_id: attackerId }] },
      { branchOwnerRows: [{ ...branchOwner, status: "REVOKED" }] },
      { branchOwnerError: true },
    ]) {
      const stub = signedInRlsReadback(options);
      expect(await verifyOwnerWorkspaceCreationReadback(
        stub.auth, userId, requested,
        { ok: true, slug: requested.slug, existing: false },
      ), JSON.stringify(options)).toEqual({ ok: false, reason: "PERSISTENCE_UNVERIFIED" });
    }
  });

  it("accepts an idempotent existing-owner branch with legitimate changed currency and code", async () => {
    const previous = { ...saved, slug: "older-team", currency: "BDT" };
    const stub = signedInRlsReadback({
      workspace: previous,
      branchRows: [{ ...defaultBranch, code: "OPS", timezone: "UTC", currency: "BDT" }],
    });
    expect(await verifyOwnerWorkspaceCreationReadback(
      stub.auth, userId, requested, { ok: true, slug: "older-team", existing: true },
    )).toEqual({ ok: true, workspace: previous, existing: true });
    expect(stub.reads).toContain("branch_memberships");
  });

  it("wires post-RPC readback into the real server action without external side effects", () => {
    const source = readFileSync("src/app/auth/create-workspace/actions.ts", "utf8");
    expect(source).toContain("verifyOwnerWorkspaceCreationReadback(");
    expect(source.indexOf('auth.rpc("servicedesk_register_owner_workspace"'))
      .toBeLessThan(source.indexOf("verifyOwnerWorkspaceCreationReadback("));
    expect(source.indexOf("verifyOwnerWorkspaceCreationReadback("))
      .toBeLessThan(source.indexOf('redirect("/onboarding/verified?workspace="'));
    expect(source).toContain("Workspace registration may have committed");
    expect(source).not.toContain("service_role");
    expect(source).not.toContain("auth.admin");
  });
});
