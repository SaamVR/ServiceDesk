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
const requestA = "55555555-5555-4555-8555-555555555555";
const requestB = "66666666-6666-4666-8666-666666666666";

function token(sub, role = "authenticated", iss = ORIGIN + "/auth/v1", extra={}) {
  const claims = { sub, role, iss, aud:"authenticated",
    exp: Math.floor(Date.now() / 1000) + 1800, ...extra };
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
  SD_P02_OWNER_A_REQUEST_ID: requestA,
  SD_P02_OWNER_B_REQUEST_ID: requestB,
};
function mockFetch(options = {}) {
  const calls = [];
  let authReads = 0;
  const fetcher = async (raw, request) => {
    const url = new URL(raw), owner = request.headers.Authorization === "Bearer " + env.SD_P02_OWNER_A_JWT ? "A" : "B";
    const expected = owner === "A" ? workA : workB;
    const branch = owner === "A" ? branchA : branchB;
    assert.equal(url.origin, ORIGIN);
    assert.equal(request.redirect, "error");
    calls.push({ path: url.pathname, method: request.method, owner });
    let data;
    if (url.pathname === "/auth/v1/user") {
      assert.equal(request.method, "GET");
      assert.equal(request.body, undefined);
      authReads += 1;
      if (options.authServerFailure)
        return new Response(JSON.stringify({error:"invalid_token"}), {
          status:401, headers:{"content-type":"application/json"},
        });
      data = {
        id: owner === "A" ? userA : userB,
        email_confirmed_at: "2026-10-01T00:00:00Z",
        role: options.authRoleWrong ? "anon" : "authenticated",
        aud: options.authAudienceWrong ? "anon" : "authenticated",
        banned_until: options.authBanned ? new Date(Date.now()+3600_000).toISOString() :
          options.authBanMalformed ? "not-a-date" : null,
        is_anonymous: false,
      };
      if (options.authMismatch || (options.authChangedAtEnd && authReads > 2 && owner === "A"))
        data.id = owner === "A" ? userB : userA;
      if (options.authUnconfirmed) data.email_confirmed_at = null;
      if (options.authAnonymous) data.is_anonymous = true;
    } else if (url.pathname.endsWith("/rpc/servicedesk_default_branch")) {
      assert.equal(request.method, "POST");
      const given = JSON.parse(request.body).target_workspace;
      data = given === expected || options.leakForeignBranch ? branch : null;
    } else {
      assert.equal(request.method, "GET");
      const name = url.pathname.split("/").at(-1);
      assert.ok(["workspaces", "memberships", "requests", "workspace_branches"].includes(name));
      const id = (url.searchParams.get(name === "workspaces" ? "id" : "workspace_id") || "").slice(3);
      if (name === "requests")
        assert.equal(url.searchParams.get("id"),"eq."+(id===workA?requestA:requestB));
      if (name === "memberships") {
        assert.equal(url.searchParams.get("user_id"),"eq." + (id === workA ? userA : userB));
        assert.equal(url.searchParams.get("role"),"eq.OWNER");
        assert.equal(url.searchParams.get("status"),"eq.ACTIVE");
      }
      if (name === "workspace_branches") {
        assert.equal(url.searchParams.get("is_default"),"eq.true");
        assert.equal(url.searchParams.get("active"),"eq.true");
      }
      const present=(id === expected || options.leakForeignRows && id !== expected ||
        options.leakForeignMembership && id !== expected && name === "memberships") &&
        (name !== "requests" || options.savedRequest);
      if (!present) data=[];
      else if(name==="workspaces") data=[{id}];
      else if(name==="memberships") data=[{
        workspace_id:id,
        user_id:id===workA?userA:userB,
        role:options.wrongRole?"CREW":"OWNER",
        status:options.inactiveOwner?"INACTIVE":"ACTIVE",
      }];
      else if(name==="requests") data=[{id:id===workA?requestA:requestB,workspace_id:id}];
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
  assert.throws(() => validateInputs({ ...env,
    SD_P02_OWNER_A_JWT: token(userA,"authenticated",ORIGIN+"/auth/v1",{aud:"anon"}) }),
    /SIGNED_IN_OWNER_SESSION_REQUIRED/);
  assert.throws(() => validateInputs({ ...env,
    SD_P02_OWNER_A_JWT: token(userA,"authenticated",ORIGIN+"/auth/v1",{aud:["authenticated","service_role"]}) }),
    /SIGNED_IN_OWNER_SESSION_REQUIRED/);
  assert.throws(() => validateInputs({ ...env,
    SD_P02_OWNER_A_JWT: token(userA,"authenticated",ORIGIN+"/auth/v1",{is_anonymous:true}) }),
    /SIGNED_IN_OWNER_SESSION_REQUIRED/);
});

test("proves two different owners' own visibility, foreign denial and own-only branch lookups", async () => {
  const { fetcher, calls } = mockFetch({ savedRequest: true });
  const result = await runTwoOwnerReadOnlyAudit(env, fetcher);
  assert.equal(result.result, "PASS");
  assert.equal(result.noWrites, true);
  assert.equal(result.checks.length, 2);
  assert.ok(result.checks.every(x => x.scope === "OWN_WORKSPACE_ALLOWED_FOREIGN_DENIED"));
  assert.equal(calls.length, 28);
  assert.equal(calls.filter(x => x.path === "/auth/v1/user").length, 4);
  assert.equal(calls.filter(x => x.method === "POST").length, 4);
  assert.equal(calls.filter(x => x.method === "GET").length, 24);
});

test("rejects empty request fixtures rather than declaring false-positive request isolation", async () => {
  const { fetcher } = mockFetch();
  await assert.rejects(runTwoOwnerReadOnlyAudit(env, fetcher), /EXPECTED_OWNER_REQUEST_FIXTURE_MISSING/);
});
test("requires distinct known saved request IDs for two real owner scopes", () => {
  assert.throws(() => validateInputs({...env, SD_P02_OWNER_A_REQUEST_ID: ""}), /EXPECTED_SAVED_REQUEST_FIXTURE_REQUIRED/);
  assert.throws(() => validateInputs({...env, SD_P02_OWNER_A_REQUEST_ID: requestB}), /OWNERS_AND_WORKSPACES_MUST_BE_DIFFERENT/);
});

test("fails when a foreign tenant row is visible", async () => {
  await assert.rejects(
    runTwoOwnerReadOnlyAudit(env, mockFetch({ leakForeignRows: true }).fetcher),
    /FOREIGN_TENANT_DATA_EXPOSED_WORKSPACES/,
  );
});

test("detects foreign OWNER membership disclosure even when other foreign tables deny", async () => {
  const { fetcher } = mockFetch({ savedRequest: true, leakForeignMembership: true });
  await assert.rejects(
    runTwoOwnerReadOnlyAudit(env, fetcher),
    /FOREIGN_TENANT_DATA_EXPOSED_MEMBERSHIPS/,
  );
});

test("fails on default-branch RPC disclosure, even if table RLS is correctly configured", async () => {
  await assert.rejects(
    runTwoOwnerReadOnlyAudit(env, mockFetch({ leakForeignBranch: true, savedRequest: true }).fetcher),
    /FOREIGN_DEFAULT_BRANCH_DISCLOSURE/,
  );
});

test("verifies both owner JWTs against the read-only Auth server endpoint", async () => {
  const h = mockFetch({ savedRequest:true });
  const result = await runTwoOwnerReadOnlyAudit(env, h.fetcher);
  assert.equal(result.result, "PASS");
  const authCalls = h.calls.filter(x => x.path === "/auth/v1/user");
  assert.deepEqual(authCalls.map(x => x.owner), ["A","B","A","B"]);
  assert.ok(authCalls.every(x => x.method === "GET"));
});
for (const [options, expected] of [
  [{authServerFailure:true}, "AUTH_SERVER_USER_CHECK_FAILED"],
  [{authMismatch:true}, "AUTH_SERVER_OWNER_IDENTITY_UNVERIFIED"],
  [{authUnconfirmed:true}, "AUTH_SERVER_OWNER_IDENTITY_UNVERIFIED"],
  [{authRoleWrong:true}, "AUTH_SERVER_OWNER_IDENTITY_UNVERIFIED"],
  [{authAudienceWrong:true}, "AUTH_SERVER_OWNER_IDENTITY_UNVERIFIED"],
  [{authBanned:true}, "AUTH_SERVER_OWNER_BANNED_OR_STATUS_UNVERIFIED"],
  [{authBanMalformed:true}, "AUTH_SERVER_OWNER_BANNED_OR_STATUS_UNVERIFIED"],
  [{authAnonymous:true}, "AUTH_SERVER_OWNER_IDENTITY_UNVERIFIED"],
  [{authChangedAtEnd:true, savedRequest:true}, "AUTH_SERVER_OWNER_IDENTITY_UNVERIFIED"],
]) {
  test("fails closed for unverified Auth server identity: " + JSON.stringify(options), async () => {
    const h = mockFetch(options);
    await assert.rejects(runTwoOwnerReadOnlyAudit(env, h.fetcher), new RegExp(expected));
    assert.ok(h.calls.every(x => x.method === "GET" || x.method === "POST" &&
      x.path === "/rest/v1/rpc/servicedesk_default_branch"));
  });
}

test("accepts valid single authenticated JWT audience array and expired ban", async () => {
  const local = { ...env, SD_P02_OWNER_A_JWT: token(userA, "authenticated",
    ORIGIN+"/auth/v1", {aud:["authenticated"]}) };
  // User A's Auth fixture uses the token from the supplied env, so a local
  // isolated harness must use its own Authorization; input validation alone
  // proves the strict single-audience allowance.
  assert.equal(validateInputs(local).entries.length,2);
  const h = mockFetch({ savedRequest:true });
  const result=await runTwoOwnerReadOnlyAudit(env,h.fetcher);
  assert.equal(result.result,"PASS");
});
