import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { QA_SEED_FIELDS, QA_SEED_SOURCE, seedQaWorkspaceData } from "@/features/auth/qa-sample-seed";

type Row = Record<string, unknown>;
const workspaceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const branchId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const fakeIds = [
  "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
];
const workspace = { id: workspaceId, slug: "qa-brightroom" };

function database(options: { noBranch?: boolean; deny?: string; denyAfterSeedRead?: string } = {}) {
  const data: Record<string, Row[]> = {
    workspace_branches: options.noBranch ? [] : [{ id: branchId, workspace_id: workspaceId, code: "MAIN" }],
    customers: [], properties: [], requests: [],
  };
  const writes: Array<{ table: string; row: Row }> = [];

  const client = {
    from(table: string) {
      if (!(table in data)) throw new Error("Unexpected table: " + table);
      const predicates: Array<(row: Row) => boolean> = [];
      let adding: Row | undefined;
      const result = (single = false) => {
        if (options.deny === table || (options.denyAfterSeedRead === table && writes.length === 3 && !adding)) {
          return { data: null, error: { code: "42501" } };
        }
        if (adding) {
          const row: Row = { id: fakeIds[writes.length], ...adding };
          data[table].push(row);
          writes.push({ table, row });
          return { data: row, error: null };
        }
        const found = data[table].filter(row => predicates.every(testRow => testRow(row)));
        if (single) return { data: found[0] ?? null, error: null };
        return { data: found, error: null };
      };
      const q = {
        select() { return q; },
        eq(key: string, value: unknown) {
          predicates.push(row => row[key] === value);
          return q;
        },
        contains(key: string, obj: Record<string, unknown>) {
          predicates.push(row => typeof row[key] === "object" && row[key] !== null &&
            Object.entries(obj).every(([field, value]) => (row[key] as Row)[field] === value));
          return q;
        },
        insert(input: Row) { adding = input; return q; },
        limit() { return Promise.resolve(result()); },
        single() { return Promise.resolve(result(true)); },
        maybeSingle() { return Promise.resolve(result(true)); },
      };
      return q;
    },
  } as unknown as SupabaseClient;
  return { client, data, writes };
}

describe("QA-only authenticated RLS synthetic business seed", () => {
  it("inserts one fictional customer, branch-scoped property and new cleaning enquiry", async () => {
    const db = database();
    const seeded = await seedQaWorkspaceData(db.client, workspace);
    expect(seeded).toMatchObject({ ok: true, reused: false });
    expect(db.writes.map(write => write.table)).toEqual(["customers", "properties", "requests"]);
    expect(db.data.customers[0]).toMatchObject({ workspace_id: workspaceId, lead_source: QA_SEED_SOURCE });
    expect(db.data.properties[0]).toMatchObject({ workspace_id: workspaceId, branch_id: branchId });
    expect(db.data.requests[0]).toMatchObject({
      workspace_id: workspaceId, branch_id: branchId, status: "NEW",
      bedrooms: 3, bathrooms: 2, structured_fields: QA_SEED_FIELDS,
    });
    expect(db.data.customers[0].auth_user_id).toBeUndefined();
    expect(db.writes.some(({row}) => Object.keys(row).some(k => /email|phone|stripe|whatsapp/.test(k)))).toBe(false);
  });

  it("reuses the same synthetic rows on a second execution", async () => {
    const db = database();
    const first = await seedQaWorkspaceData(db.client, workspace);
    const second = await seedQaWorkspaceData(db.client, workspace);
    expect(first.ok).toBe(true);
    expect(second).toMatchObject({ ok: true, reused: true });
    expect(db.writes).toHaveLength(3);
    expect(second.ok && first.ok && second.customerId).toBe(first.ok && first.customerId);
  });

  it("fails closed without the owner's MAIN branch or valid workspace ID", async () => {
    const db = database({ noBranch: true });
    expect(await seedQaWorkspaceData(db.client, workspace)).toEqual({ ok: false, stage: "branch" });
    expect(await seedQaWorkspaceData(db.client, { id: "not-uuid", slug: "qa-brightroom" })).toEqual({
      ok: false, stage: "branch",
    });
    expect(db.writes).toHaveLength(0);
  });

  it("reports database denials without silently fabricating records", async () => {
    const db = database({ deny: "customers" });
    expect(await seedQaWorkspaceData(db.client, workspace)).toEqual({ ok: false, stage: "customer" });
    expect(db.writes).toHaveLength(0);
  });

  it("does not claim success until all three records are readable under the same session", async () => {
    const db = database({ denyAfterSeedRead: "requests" });
    const result = await seedQaWorkspaceData(db.client, workspace);
    expect(db.writes.map(write => write.table)).toEqual(["customers", "properties", "requests"]);
    expect(result).toEqual({ ok: false, stage: "request" });
  });

  it("never seeds automatically and requires server-side QA, verified owner and exact workspace", () => {
    const read = (path: string) => readFileSync(join(process.cwd(),path),"utf8");
    const action = read("src/app/onboarding/verified/qa-seed-actions.ts");
    const page = read("src/app/onboarding/verified/page.tsx");
    expect(action).toContain('operationalDatabaseMode() !== "QA_SESSION_RLS"');
    expect(action).toContain('ownerRegistrationMode() !== "QA_ONLY"');
    expect(action).toContain("auth.auth.getUser()");
    expect(action).toContain("email_confirmed_at");
    expect(action).toContain("ownerRegistrationEmailAllowed(data.user.email)");
    expect(action).toContain("loadVerifiedOwnerWorkspace(auth, data.user.id, slug)");
    expect(action).toContain("seedQaWorkspaceData(auth, owner.workspace)");
    expect(action).not.toContain("service_role");
    expect(page).toContain("<form action={seedVerifiedQaWorkspace}>");
    expect(page).toContain('canSeed = operationalMode === "QA_SESSION_RLS"');
    expect(page).not.toContain("await seedQaWorkspaceData");
  });
});
