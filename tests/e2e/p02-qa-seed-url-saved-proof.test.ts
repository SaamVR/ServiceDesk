import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { verifiedSavedQaSample } from "../../src/features/auth/qa-sample-readback";
import { QA_SEED_FIELDS, QA_SEED_LABEL, QA_SEED_SOURCE } from "../../src/features/auth/qa-sample-seed";
import { seedVerifiedQaWorkspace } from "../../src/app/onboarding/verified/qa-seed-actions";

const qaAction = vi.hoisted(() => ({
  getUser: vi.fn(), readOwner: vi.fn(), seed: vi.fn(), from: vi.fn(),
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser: qaAction.getUser }, from: qaAction.from }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
}));
vi.mock("next/navigation", () => ({
  redirect: (href: string): never => { throw Error("MOCK_REDIRECT:" + href); },
}));
vi.mock("../../src/features/auth/verified-owner-workspace", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../src/features/auth/verified-owner-workspace")>(),
  loadVerifiedOwnerWorkspace: qaAction.readOwner,
}));
vi.mock("../../src/features/auth/qa-sample-seed", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../src/features/auth/qa-sample-seed")>(),
  seedQaWorkspaceData: qaAction.seed,
}));

const actor = "11111111-1111-4111-8111-111111111111";
const workspace = "22222222-2222-4222-8222-222222222222";
const branch = "33333333-3333-4333-8333-333333333333";
const customer = "44444444-4444-4444-8444-444444444444";
const property = "55555555-5555-4555-8555-555555555555";
const request = "66666666-6666-4666-8666-666666666666";
type Row = Record<string, unknown>;

function fixture(options: {
  identity?: string | null;
  unconfirmed?: boolean;
  denied?: string;
  transport?: string;
  change?: (rows: Record<string, Row[]>) => void;
} = {}) {
  const reads: string[] = [];
  const rows: Record<string, Row[]> = {
    memberships: [{ workspace_id: workspace, user_id: actor, role: "OWNER", status: "ACTIVE" }],
    customers: [{ id: customer, workspace_id: workspace, lead_source: QA_SEED_SOURCE }],
    properties: [{
      id: property, workspace_id: workspace, customer_id: customer, branch_id: branch,
      label: QA_SEED_LABEL,
    }],
    workspace_branches: [{ id: branch, workspace_id: workspace, code: "MAIN" }],
    requests: [{
      id: request, workspace_id: workspace, branch_id: branch,
      customer_id: customer, property_id: property,
      structured_fields: { ...QA_SEED_FIELDS },
    }],
  };
  options.change?.(rows);
  const client = {
    auth: {
      async getUser() {
        reads.push("verified-user");
        return {
          data: {
            user: options.identity === null ? null : {
              id: options.identity ?? actor,
              email_confirmed_at: options.unconfirmed ? null : "2026-11-07T00:00:00Z",
            },
          }, error: null,
        };
      },
    },
    from(table: string) {
      reads.push(table);
      const equal: Record<string, unknown> = {};
      const json: Record<string, Record<string, unknown>> = {};
      return {
        select() { return this; },
        eq(key: string, value: unknown) { equal[key] = value; return this; },
        contains(key: string, value: Record<string, unknown>) {
          json[key] = value; return this;
        },
        async limit(size: number) {
          expect(size).toBe(2);
          if (options.transport === table) throw Error("private transport unavailable");
          const found = (rows[table] ?? []).filter(row =>
            Object.entries(equal).every(([k, v]) => row[k] === v) &&
            Object.entries(json).every(([k, v]) => {
              const field = row[k];
              return !!field && typeof field === "object" &&
                Object.entries(v).every(([key, expected]) =>
                  (field as Record<string, unknown>)[key] === expected);
            }));
          return {
            data: found.slice(0, size),
            error: options.denied === table ? { code: "42501" } : null,
          };
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, reads };
}

describe("P02 QA saved receipt must never be supplied by ?qaSeed URL", () => {
  it("accepts only exact owner-session RLS-visible saved sample lineage", async () => {
    const f = fixture();
    expect(await verifiedSavedQaSample(f.client, actor, workspace)).toBe(true);
    expect(f.reads).toEqual([
      "verified-user", "memberships", "customers", "properties", "workspace_branches", "requests",
    ]);
  });

  it("never reads other tenant rows for invalid, foreign, unconfirmed or missing identity", async () => {
    for (const [expectedActor, selected] of [[actor, null], [actor, "77777777-7777-4777-8777-777777777777"]] as const) {
      const f = fixture({ identity: selected });
      expect(await verifiedSavedQaSample(f.client, expectedActor, workspace)).toBe(false);
      expect(f.reads).toEqual(["verified-user"]);
    }
    const unconfirmed = fixture({ unconfirmed: true });
    expect(await verifiedSavedQaSample(unconfirmed.client, actor, workspace)).toBe(false);
    expect(unconfirmed.reads).toEqual(["verified-user"]);
    const bad = fixture();
    expect(await verifiedSavedQaSample(bad.client, "bogus", workspace)).toBe(false);
    expect(bad.reads).toEqual([]);
  });

  it("denies revoked owner, foreign workspace and ambiguous synthetic customers", async () => {
    const scenarios = [
      (r: Record<string, Row[]>) => { r.memberships[0].status = "REVOKED"; },
      (r: Record<string, Row[]>) => { r.memberships[0].workspace_id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"; },
      (r: Record<string, Row[]>) => { r.customers.push({ ...r.customers[0], id: request }); },
      (r: Record<string, Row[]>) => { r.customers[0].lead_source = "CUSTOMER"; },
    ];
    for (const change of scenarios) {
      const f = fixture({ change });
      expect(await verifiedSavedQaSample(f.client, actor, workspace)).toBe(false);
      expect(f.reads).not.toContain("requests");
    }
  });

  it("denies mismatched property, nonexistent MAIN branch or foreign enquiry", async () => {
    for (const change of [
      (r: Record<string, Row[]>) => { r.properties[0].branch_id = request; },
      (r: Record<string, Row[]>) => { r.workspace_branches[0].code = "OTHER"; },
      (r: Record<string, Row[]>) => { r.requests[0].branch_id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"; },
      (r: Record<string, Row[]>) => { r.requests[0].property_id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"; },
      (r: Record<string, Row[]>) => { r.requests[0].structured_fields = { qa_sample_version: 1, synthetic: false }; },
      (r: Record<string, Row[]>) => { r.requests.push({ ...r.requests[0], id: request }); },
    ]) {
      const f = fixture({ change });
      expect(await verifiedSavedQaSample(f.client, actor, workspace)).toBe(false);
    }
  });

  it("fails closed on permission-denied or failed authenticated table reads", async () => {
    for (const table of ["memberships", "customers", "properties", "workspace_branches", "requests"]) {
      expect(await verifiedSavedQaSample(fixture({ denied: table }).client, actor, workspace)).toBe(false);
      expect(await verifiedSavedQaSample(fixture({ transport: table }).client, actor, workspace)).toBe(false);
    }
  });

  it("only shows successful QA copy after independently saved readback, never a URL flag", () => {
    const page = readFileSync("src/app/onboarding/verified/page.tsx", "utf8");
    expect(page).toContain('query.qaSeed === "created"');
    expect(page).toContain('query.qaSeed === "already-exists"');
    expect(page).toContain("await verifiedSavedQaSample(auth, data.user.id, workspace.id)");
    expect(page.indexOf("qaFixtureWritesAllowedForWorkspace(workspace.slug)"))
      .toBeLessThan(page.indexOf("await verifiedSavedQaSample("));
    expect(page).toContain("savedSeedVerified");
    expect(page).toContain("independently verified in this workspace.");
    expect(page).not.toContain('created: "Fictional sample customer');
    expect(page).not.toContain('"already-exists": "Sample records already exist');
    const source = readFileSync("src/features/auth/qa-sample-readback.ts", "utf8");
    for (const bad of [".insert(", ".update(", ".delete(", "service_role", "sendEmail(", "createPayment("]) {
      expect(source).not.toContain(bad);
    }
  });
});


const qaSlug="fictional-qa-cleaning";
const qaWorkspace="88888888-8888-4888-8888-888888888888";
async function submitQaSeed(slug=qaSlug): Promise<string> {
  const data=new FormData();
  data.set("workspace",slug);
  try {
    await seedVerifiedQaWorkspace(data);
  } catch (error) {
    const message=error instanceof Error?error.message:String(error);
    expect(message).toMatch(/^MOCK_REDIRECT:/);
    return decodeURIComponent(message.slice("MOCK_REDIRECT:".length));
  }
  throw Error("QA_SEED_ACTION_RETURNED_WITHOUT_REDIRECT");
}
describe("P02 authorized QA seed action handles uncertain provider transport", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://synthetic-project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY","sb_publishable_synthetic");
    vi.stubEnv("SERVICEDESK_AUTH_REDIRECT_ORIGIN","https://qa-approved.example.test");
    vi.stubEnv("SERVICEDESK_OWNER_REGISTRATION_ENABLED","false");
    vi.stubEnv("SERVICEDESK_OWNER_REGISTRATION_QA_ENABLED","true");
    vi.stubEnv("SERVICEDESK_OWNER_REGISTRATION_TENANT_AUTHZ_APPROVED","true");
    vi.stubEnv("SERVICEDESK_OWNER_REGISTRATION_QA_EMAILS","approved@example.test");
    vi.stubEnv("SERVICEDESK_OPERATIONS_RLS_PREVIEW_ENABLED","true");
    vi.stubEnv("SERVICEDESK_QA_FIXTURE_WRITES_APPROVED","true");
    vi.stubEnv("SERVICEDESK_QA_FIXTURE_WORKSPACE_SLUGS",qaSlug);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY","");
    vi.stubEnv("RENDER_EXTERNAL_URL","");
    qaAction.getUser.mockReset().mockResolvedValue({data:{user:{
      id:actor,email:"approved@example.test",email_confirmed_at:"2026-11-07T00:00:00Z",
    }},error:null});
    qaAction.readOwner.mockReset().mockResolvedValue({ok:true,workspace:{
      id:qaWorkspace,slug:qaSlug,name:"Synthetic QA Cleaning",timezone:"UTC",currency:"USD",
    }});
    qaAction.seed.mockReset().mockResolvedValue({ok:true,reused:false,customerId:customer,requestId:request});
    qaAction.from.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("denies thrown Auth identity transport before any owner lookup or database seed", async () => {
    qaAction.getUser.mockRejectedValueOnce(Error("PRIVATE_QA_AUTH_TRANSPORT"));
    const href=await submitQaSeed();
    expect(href).toContain("/auth/sign-in?next=");
    expect(href).not.toContain("PRIVATE_QA_AUTH_TRANSPORT");
    expect(qaAction.readOwner).not.toHaveBeenCalled();
    expect(qaAction.seed).not.toHaveBeenCalled();
  });

  it("denies userless and unconfirmed QA Auth identities without seeding", async () => {
    qaAction.getUser.mockResolvedValueOnce({data:{user:null},error:null});
    expect(await submitQaSeed()).toContain("/auth/sign-in?next=");
    qaAction.getUser.mockResolvedValueOnce({data:{user:{id:actor,email:"approved@example.test",email_confirmed_at:null}},error:null});
    expect(await submitQaSeed()).toContain("qaSeed=not-authorized");
    expect(qaAction.seed).not.toHaveBeenCalled();
  });

  it("reports a potentially partial commit as write-failed when the authorized seed transport throws", async () => {
    qaAction.seed.mockRejectedValueOnce(Error("PRIVATE_POST_COMMIT_REST_FAILURE"));
    const href=await submitQaSeed();
    expect(href).toContain("qaSeed=write-failed");
    expect(href).not.toContain("PRIVATE_POST_COMMIT_REST_FAILURE");
    expect(href).not.toContain("qaSeed=created");
    expect(qaAction.seed).toHaveBeenCalledTimes(1);
  });

  it("preserves existing denied and approved receipt routes without claiming a URL flag is saved proof", async () => {
    qaAction.seed.mockResolvedValueOnce({ok:false,stage:"request"});
    expect(await submitQaSeed()).toContain("qaSeed=write-failed");
    expect(await submitQaSeed()).toContain("qaSeed=created");
    expect(qaAction.seed).toHaveBeenCalledTimes(2);
  });

  it("refuses an otherwise approved tester targeting a workspace not on the exact QA slug allowlist", async () => {
    vi.stubEnv("SERVICEDESK_QA_FIXTURE_WORKSPACE_SLUGS","other-fake-workspace");
    expect(await submitQaSeed()).toContain("qaSeed=not-authorized");
    expect(qaAction.seed).not.toHaveBeenCalled();
  });
});
