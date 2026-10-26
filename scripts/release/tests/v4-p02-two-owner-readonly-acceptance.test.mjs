import test from "node:test";
import assert from "node:assert/strict";
import {
  ORIGIN, runTwoOwnerReadOnlyAudit, validateInputs,
} from "../v4-p02-two-owner-readonly-acceptance.mjs";

const userA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const workA = "11111111-1111-4111-8111-111111111111";
const workB = "22222222-2222-4222-8222-222222222222";
const branchA = "33333333-3333-4333-8333-333333333333";
const branchB = "44444444-4444-4444-8444-444444444444";

function token(sub, role = "authenticated", iss = ORIGIN + "/auth/v1") {
  const claims = { sub, role, iss, exp: Math.floor(Date.now() / 1000) + 1800 };
  return [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
    Buffer.from(JSON.stringify(claims)).toString("base64url"),
    "fake-signature-no-real-credentials",
  ].join(".");
}
const env = {
  SD_P02_ACCEPTANCE_APPROVED: "READ_ONLY",
  SD_P02_PUBLISHABLE_KEY: "sb_publishable_fake_for_offline_test",
  SD_P02_OWNER_A_JWT: token(userA),
  SD_P02_OWNER_B_JWT: token(userB),
  SD_P02_OWNER_A_WORKSPACE_ID: workA,
  SD_P02_OWNER_B_WORKSPACE_ID: workB,
};
function mockFetch(options = {}) {
  const calls = [];
  const fetcher = async (raw, request) => {
    const url = new URL(raw), owner = request.headers.Authorization === "Bearer " + env.SD_P02_OWNER_A_JWT ? "A" : "B";
    const expected = owner === "A" ? workA : workB;
    const branch = owner === "A" ? branchA : branchB;
    assert.equal(url.origin, ORIGIN);
    assert.equal(request.redirect, "error");
    calls.push({ path: url.pathname, method: request.method, owner });
    let data;
    if (url.pathname.endsWith("/rpc/servicedesk_default_branch")) {
      assert.equal(request.method, "POST");
      const given = JSON.parse(request.body).target_workspace;
      data = given === expected || options.leakForeignBranch ? branch : null;
    } else {
      assert.equal(request.method, "GET");
      const name = url.pathname.split("/").at(-1);
      assert.ok(["workspaces", "memberships", "requests", "workspace_branches"].includes(name));
      const id = (url.searchParams.get(name === "workspaces" ? "id" : "workspace_id") || "").slice(3);
      if (name === "memberships") {
        assert.equal(url.searchParams.get("user_id"),"eq." + (owner === "A" ? userA : userB));
        assert.equal(url.searchParams.get("role"),"eq.OWNER");
        assert.equal(url.searchParams.get("status"),"eq.ACTIVE");
      }
      if (name === "workspace_branches") {
        assert.equal(url.searchParams.get("is_default"),"eq.true");
        assert.equal(url.searchParams.get("active"),"eq.true");
      }
      const present=(id === expected || options.leakForeignRows && id !== expected) &&
        (name !== "requests" || options.savedRequest);
      if (!present) data=[];
      else if(name==="workspaces") data=[{id}];
      else if(name==="memberships") data=[{
        workspace_id:id,
        user_id:owner==="A"?userA:userB,
        role:options.wrongRole?"CREW":"OWNER",
        status:options.inactiveOwner?"INACTIVE":"ACTIVE",
      }];
      else if(name==="requests") data=[{id:branch,workspace_id:id}];
      else data=[{id:id===workA?branchA:branchB,workspace_id:id,
        is_default:true,active:true}];
    }
    return new Response(JSON.stringify(data), {
      status: 200, headers: { "content-type": "application/json" },
    });
  };
  return { fetcher, calls };
}

test("refuses to run without explicit read-only opt-in and a publishable key", () => {
  assert.throws(() => validateInputs({ ...env, SD_P02_ACCEPTANCE_APPROVED: undefined }),
    /READ_ONLY_ACCEPTANCE_NOT_ENABLED/);
  assert.throws(() => validateInputs({ ...env, SD_P02_PUBLISHABLE_KEY: "sb_secret_risk" }),
    /PUBLISHABLE_KEY_REQUIRED/);
  assert.throws(() => validateInputs({ ...env, SD_P02_OWNER_A_JWT: token(userA, "service_role") }),
    /SIGNED_IN_OWNER_SESSION_REQUIRED/);
  assert.throws(() => validateInputs({ ...env, SD_P02_OWNER_A_JWT: token(userA, "authenticated", "https:\/\/wrong.supabase.co\/auth\/v1") }),
    /WRONG_SUPABASE_PROJECT_JWT/);
  assert.throws(() => validateInputs({ ...env, SD_P02_OWNER_A_JWT: token(userA, "authenticated", null) }),
    /WRONG_SUPABASE_PROJECT_JWT/);
  assert.throws(() => validateInputs({ ...env, SD_P02_OWNER_B_JWT: token(userA) }),
    /OWNERS_AND_WORKSPACES_MUST_BE_DIFFERENT/);
});

test("proves two different owners' own visibility, foreign denial and own-only branch lookups", async () => {
  const { fetcher, calls } = mockFetch({ savedRequest: true });
  const result = await runTwoOwnerReadOnlyAudit(env, fetcher);
  assert.equal(result.result, "PASS");
  assert.equal(result.noWrites, true);
  assert.equal(result.checks.length, 2);
  assert.ok(result.checks.every(x => x.scope === "OWN_WORKSPACE_ALLOWED_FOREIGN_DENIED"));
  assert.equal(calls.length, 24);
  assert.equal(calls.filter(x => x.method === "POST").length, 4);
  assert.equal(calls.filter(x => x.method === "GET").length, 20);
});

test("does not require seeded requests to prove owner workspace isolation", async () => {
  const { fetcher } = mockFetch();
  assert.equal((await runTwoOwnerReadOnlyAudit(env, fetcher)).result, "PASS");
});

test("fails when a foreign tenant row is visible", async () => {
  await assert.rejects(
    runTwoOwnerReadOnlyAudit(env, mockFetch({ leakForeignRows: true }).fetcher),
    /FOREIGN_TENANT_DATA_EXPOSED_WORKSPACES/,
  );
});

test("fails on default-branch RPC disclosure, even if table RLS is correctly configured", async () => {
  await assert.rejects(
    runTwoOwnerReadOnlyAudit(env, mockFetch({ leakForeignBranch: true }).fetcher),
    /FOREIGN_DEFAULT_BRANCH_DISCLOSURE/,
  );
});
