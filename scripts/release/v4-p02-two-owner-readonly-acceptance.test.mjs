import test from "node:test";
import assert from "node:assert/strict";
import {
  ORIGIN, runTwoOwnerReadOnlyAudit, validateInputs,
} from "./v4-p02-two-owner-readonly-acceptance.mjs";

// Offline fake REST responses only: these JWT strings are synthetic, not
// credentials and MUST never be accepted as production RLS evidence.
const owners = Object.freeze({
  A: {
    user: "11111111-1111-4111-8111-111111111111",
    workspace: "33333333-3333-4333-8333-333333333333",
    branch: "55555555-5555-4555-8555-555555555555",
    request: "77777777-7777-4777-8777-777777777777",
  },
  B: {
    user: "22222222-2222-4222-8222-222222222222",
    workspace: "44444444-4444-4444-8444-444444444444",
    branch: "66666666-6666-4666-8666-666666666666",
    request: "88888888-8888-4888-8888-888888888888",
  },
});

function syntheticJwt(subject, overrides = {}) {
  const claims = {
    iss: ORIGIN + "/auth/v1", sub: subject, role: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
  return [
    Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url"),
    Buffer.from(JSON.stringify(claims)).toString("base64url"),
    "synthetic-not-a-signature",
  ].join(".");
}

function config(overrides = {}) {
  return {
    SD_P02_ACCEPTANCE_APPROVED: "READ_ONLY",
    SD_P02_PUBLISHABLE_KEY: "sb_publishable_synthetic_fixture",
    SD_P02_OWNER_A_JWT: syntheticJwt(owners.A.user),
    SD_P02_OWNER_B_JWT: syntheticJwt(owners.B.user),
    SD_P02_OWNER_A_WORKSPACE_ID: owners.A.workspace,
    SD_P02_OWNER_B_WORKSPACE_ID: owners.B.workspace,
    ...overrides,
  };
}

function fakeProvider(env, {
  leakMembership = false, leakNonDefaultBranch = false,
  leakRequest = false, missingOwnerMembership = false,
  missingOwnerAssignment = false, leakForeignAssignment = false,
  mismatchedOwnerAssignment = false,
  denied = false, malformed = false,
} = {}) {
  const calls = [];
  const tokenTag = (authorization) => authorization ===
    "Bearer " + env.SD_P02_OWNER_A_JWT ? "A" :
    authorization === "Bearer " + env.SD_P02_OWNER_B_JWT ? "B" : null;
  const fetcher = async (rawUrl, opts) => {
    const url = new URL(rawUrl);
    assert.equal(url.origin, ORIGIN);
    assert.equal(opts.redirect, "error");
    assert.equal(opts.headers.apikey, env.SD_P02_PUBLISHABLE_KEY);
    const requester = tokenTag(opts.headers.Authorization);
    assert.ok(requester, "only the two supplied synthetic owner tokens are allowed");
    const target = url.pathname.slice("/rest/v1/".length);
    assert.ok(url.pathname.startsWith("/rest/v1/"));
    assert.ok(["GET", "POST"].includes(opts.method));
    const post = opts.method === "POST";
    assert.equal(post, target === "rpc/servicedesk_default_branch");
    calls.push({ requester, target, method: opts.method, params: new URLSearchParams(url.searchParams) });
    if (denied && target === "memberships") {
      return new Response('{"error":"denied"}', { status: 403,
        headers: { "Content-Type": "application/json" } });
    }
    if (malformed && target === "memberships") {
      return new Response('{"unexpected":true}', {
        headers: { "Content-Type": "application/json" },
      });
    }
    if (post) {
      const args = JSON.parse(opts.body);
      assert.deepEqual(Object.keys(args), ["target_workspace"]);
      const response = args.target_workspace === owners[requester].workspace ?
        owners[requester].branch : null;
      return new Response(JSON.stringify(response), {
        headers: { "Content-Type": "application/json" },
      });
    }
    const selected = Object.entries(owners).flatMap(([tag, o]) => {
      const own = requester === tag;
      if (target === "workspaces") return own ? [{ id: o.workspace }] : [];
      if (target === "memberships") {
        return own && !missingOwnerMembership || !own && leakMembership ?
          [{ workspace_id: o.workspace, user_id: o.user, role: "OWNER", status: "ACTIVE" }] : [];
      }
      if (target === "requests") {
        return own || leakRequest ? [{ id: o.request, workspace_id: o.workspace }] : [];
      }
      if (target === "workspace_branches") {
        if (own) return [{
          id: o.branch, workspace_id: o.workspace, is_default: true, active: true,
        }];
        return leakNonDefaultBranch ? [{
          id: o.branch, workspace_id: o.workspace, is_default: false, active: false,
        }] : [];
      }
      if (target === "branch_memberships") {
        if (own && missingOwnerAssignment) return [];
        if (own || leakForeignAssignment) return [{
          workspace_id: o.workspace,
          branch_id: own && mismatchedOwnerAssignment
            ? owners[tag === "A" ? "B" : "A"].branch : o.branch,
          user_id: o.user, status: own ? "ACTIVE" : "REVOKED",
        }];
        return [];
      }
      throw Error("UNEXPECTED_TABLE");
    });
    const result = selected.filter(row => [...url.searchParams.entries()].every(([field, value]) => {
      if (field === "select" || field === "limit") return true;
      assert.ok(value.startsWith("eq."), "only exact approved read filters are allowed");
      return String(row[field]) === value.slice(3);
    })).slice(0, Number(url.searchParams.get("limit") ?? "2"));
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  };
  return { calls, fetcher };
}

test("P02: authorized distinct owners have read-only own-scope proof with foreign denial", async () => {
  const env = config();
  const fake = fakeProvider(env);
  const result = await runTwoOwnerReadOnlyAudit(env, fake.fetcher);
  assert.equal(result.result, "PASS");
  assert.equal(result.noWrites, true);
  assert.equal(result.checks.length, 2);
  assert.equal(fake.calls.length, 24);
  assert.ok(fake.calls.every(x => x.method === "GET" ||
    x.target === "rpc/servicedesk_default_branch"));
  for (const [tag, owner] of Object.entries(owners)) {
    const ownMembership = fake.calls.find(x => x.requester === tag &&
      x.target === "memberships" && x.params.get("workspace_id") === "eq." + owner.workspace);
    assert.equal(ownMembership.params.get("user_id"), "eq." + owner.user);
    assert.equal(ownMembership.params.get("role"), "eq.OWNER");
    const foreignOwner = owners[tag === "A" ? "B" : "A"];
    const foreignMembership = fake.calls.find(x => x.requester === tag &&
      x.target === "memberships" && x.params.get("workspace_id") === "eq." + foreignOwner.workspace);
    assert.equal(foreignMembership.params.get("user_id"), null);
    assert.equal(foreignMembership.params.get("role"), null);
    assert.equal(foreignMembership.params.get("status"), null);
    const foreignBranch = fake.calls.find(x => x.requester === tag &&
      x.target === "workspace_branches" && x.params.get("workspace_id") === "eq." + foreignOwner.workspace);
    assert.equal(foreignBranch.params.get("is_default"), null);
    assert.equal(foreignBranch.params.get("active"), null);
    const ownerAssignment = fake.calls.find(x => x.requester === tag &&
      x.target === "branch_memberships" &&
      x.params.get("workspace_id") === "eq." + owner.workspace);
    assert.equal(ownerAssignment.params.get("user_id"), "eq." + owner.user);
    assert.equal(ownerAssignment.params.get("branch_id"), "eq." + owner.branch);
    assert.equal(ownerAssignment.params.get("status"), "eq.ACTIVE");
    const foreignAssignment = fake.calls.find(x => x.requester === tag &&
      x.target === "branch_memberships" &&
      x.params.get("workspace_id") === "eq." + foreignOwner.workspace);
    assert.equal(foreignAssignment.params.get("user_id"), null);
    assert.equal(foreignAssignment.params.get("branch_id"), null);
    assert.equal(foreignAssignment.params.get("status"), null);
  }
});

test("P02: foreign OWNER membership leak cannot be hidden by caller user_id predicate", async () => {
  const env = config();
  const fake = fakeProvider(env, { leakMembership: true });
  await assert.rejects(
    runTwoOwnerReadOnlyAudit(env, fake.fetcher),
    /FOREIGN_TENANT_DATA_EXPOSED_MEMBERSHIPS/,
  );
});

test("P02: foreign inactive, nondefault branch leak is still a real RLS breach", async () => {
  const env = config();
  const fake = fakeProvider(env, { leakNonDefaultBranch: true });
  await assert.rejects(
    runTwoOwnerReadOnlyAudit(env, fake.fetcher),
    /FOREIGN_TENANT_DATA_EXPOSED_WORKSPACE_BRANCHES/,
  );
});

test("P02: missing current default-branch OWNER assignment cannot prove first-run readiness", async () => {
  const env = config();
  const fake = fakeProvider(env, { missingOwnerAssignment: true });
  await assert.rejects(runTwoOwnerReadOnlyAudit(env, fake.fetcher),
    /DEFAULT_BRANCH_OWNER_ASSIGNMENT_MISSING_OR_AMBIGUOUS/);
});

test("P02: a branch membership on a different branch cannot stand in for the default branch", async () => {
  const env = config();
  await assert.rejects(
    runTwoOwnerReadOnlyAudit(env, fakeProvider(env, { mismatchedOwnerAssignment: true }).fetcher),
    /DEFAULT_BRANCH_OWNER_ASSIGNMENT_MISSING_OR_AMBIGUOUS/,
  );
});

test("P02: a foreign revoked branch assignment leak cannot be hidden by OWNER filters", async () => {
  const env = config();
  const fake = fakeProvider(env, { leakForeignAssignment: true });
  await assert.rejects(runTwoOwnerReadOnlyAudit(env, fake.fetcher),
    /FOREIGN_TENANT_DATA_EXPOSED_BRANCH_MEMBERSHIPS/);
  const foreign = fake.calls.find(x => x.target === "branch_memberships" &&
    x.requester === "A" &&
    x.params.get("workspace_id") === "eq." + owners.B.workspace);
  assert.equal(foreign.params.get("user_id"), null);
  assert.equal(foreign.params.get("branch_id"), null);
  assert.equal(foreign.params.get("status"), null);
});

test("P02: exposed foreign request fails even with exact workspace predicate", async () => {
  const env = config();
  await assert.rejects(
    runTwoOwnerReadOnlyAudit(env, fakeProvider(env, { leakRequest: true }).fetcher),
    /FOREIGN_TENANT_DATA_EXPOSED_REQUESTS/,
  );
});

test("P02: missing ACTIVE OWNER row, denied HTTP and corrupt REST reply all block PASS", async () => {
  const env = config();
  for (const [options, code] of [
    [{ missingOwnerMembership: true }, /EXPECTED_OWNER_ACCESS_MISSING_MEMBERSHIPS/],
    [{ denied: true }, /AUTHENTICATED_DATABASE_REQUEST_FAILED/],
    [{ malformed: true }, /UNEXPECTED_DATABASE_SHAPE/],
  ]) {
    await assert.rejects(runTwoOwnerReadOnlyAudit(env, fakeProvider(env, options).fetcher), code);
  }
});

test("P02: refuses missing explicit approval, same subject, expired and wrong-project JWTs offline", () => {
  const cases = [
    [{ SD_P02_ACCEPTANCE_APPROVED: undefined }, /READ_ONLY_ACCEPTANCE_NOT_ENABLED/],
    [{ SD_P02_OWNER_B_JWT: syntheticJwt(owners.A.user) }, /OWNERS_AND_WORKSPACES_MUST_BE_DIFFERENT/],
    [{ SD_P02_OWNER_A_JWT: syntheticJwt(owners.A.user, { exp: 1 }) }, /EXPIRED_OR_UNVERIFIABLE_OWNER_JWT/],
    [{ SD_P02_OWNER_A_JWT: syntheticJwt(owners.A.user, { iss: "https://wrong.supabase.co/auth/v1" }) }, /WRONG_SUPABASE_PROJECT_JWT/],
    [{ SD_P02_OWNER_B_WORKSPACE_ID: owners.A.workspace }, /OWNERS_AND_WORKSPACES_MUST_BE_DIFFERENT/],
  ];
  for (const [override, error] of cases) assert.throws(() => validateInputs(config(override)), error);
});
