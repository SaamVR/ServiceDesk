#!/usr/bin/env node
/**
 * Authenticated, READ-ONLY RLS negative gate for the approved ServiceDesk QA
 * Supabase project. Two DISTINCT pre-existing, email-verified fictional owners
 * are required. The script does not register accounts, seed data, mutate tables,
 * use elevated roles, invoke provider webhooks, or print identities/tokens.
 *
 * Run only in a protected private Actions job with the QA-only secrets set.
 */
import { createClient } from "@supabase/supabase-js";
import { requireDistinctConfirmedOwnerSessions, verifyTwoTenantOperationalRls } from "./v4-operational-rls-positive-negative.mjs";

const projectHost = "cpmmgivhlkfbiwzhlcey.supabase.co";
const env = process.env;
const url = env.V4_QA_SUPABASE_URL;
const key = env.V4_QA_SUPABASE_PUBLISHABLE_KEY;
const accounts = [
  { email: env.V4_QA_OWNER_A_EMAIL, password: env.V4_QA_OWNER_A_PASSWORD, slug: env.V4_QA_OWNER_A_WORKSPACE },
  { email: env.V4_QA_OWNER_B_EMAIL, password: env.V4_QA_OWNER_B_PASSWORD, slug: env.V4_QA_OWNER_B_WORKSPACE },
];
function fail(stage) { throw new Error("REAL_AUTH_RLS_BLOCKED_OR_FAILED:" + stage); }
function requireQaConfig() {
  let parsed;
  try { parsed = new URL(url); } catch { fail("QA_URL_MISSING"); }
  if (parsed.protocol !== "https:" || parsed.hostname !== projectHost || parsed.pathname !== "/" ||
    parsed.search || parsed.hash || parsed.username || parsed.password || parsed.port) fail("PROJECT_SCOPE");
  if (!key || !key.startsWith("sb_publishable_") || env.SUPABASE_SERVICE_ROLE_KEY) fail("NO_PRIVILEGED_CLIENTS");
  if (accounts.some(a => !a.email || !a.password || !a.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(a.slug))) fail("QA_IDENTITIES_MISSING");
  if (accounts[0].email.toLowerCase() === accounts[1].email.toLowerCase() || accounts[0].slug === accounts[1].slug) fail("DISTINCT_TENANTS_REQUIRED");
}
function client() {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
async function getOwnWorkspace(db, account) {
  const signIn = await db.auth.signInWithPassword({ email: account.email, password: account.password });
  if (signIn.error || !signIn.data?.user || !signIn.data?.session) fail("QA_SIGN_IN");
  const { data: verified, error: userError } = await db.auth.getUser();
  if (userError || !verified?.user?.email_confirmed_at ||
    verified.user.id !== signIn.data.user.id ||
    verified.user.email?.toLowerCase() !== account.email.toLowerCase()) fail("EMAIL_VERIFIED_SESSION");
  const own = await db.from("workspaces").select("id,slug").eq("slug", account.slug).maybeSingle();
  if (own.error || !own.data || own.data.slug !== account.slug) fail("RLS_OWNER_WORKSPACE_READ");
  const membership = await db.from("memberships").select("workspace_id,role,status")
    .eq("workspace_id", own.data.id).eq("user_id", verified.user.id).eq("role","OWNER").eq("status","ACTIVE").maybeSingle();
  if (membership.error || !membership.data || membership.data.workspace_id !== own.data.id) fail("OWNER_MEMBERSHIP");
  return { client: db, id: own.data.id, slug: own.data.slug, userId: verified.user.id };
}
async function verifyIsolation(actor, foreign) {
  const checks = [
    ["workspaces", "id", foreign.id],
    ["memberships", "workspace_id", foreign.id],
    ["workspace_branches", "workspace_id", foreign.id],
    ["branch_memberships", "workspace_id", foreign.id],
    ["customers", "workspace_id", foreign.id],
    ["properties", "workspace_id", foreign.id],
    ["requests", "workspace_id", foreign.id],
    ["invoices", "workspace_id", foreign.id],
  ];
  for (const [table, column, id] of checks) {
    const { data, error } = await actor.client.from(table).select(column).eq(column, id).limit(1);
    if (error || !Array.isArray(data) || data.length !== 0) fail("CROSS_TENANT_RLS_" + table.toUpperCase());
  }
  const own = await actor.client.from("workspaces").select("id").eq("id", actor.id).maybeSingle();
  if (own.error || own.data?.id !== actor.id) fail("OWN_TENANT_RLS_VISIBILITY");
}
async function main() {
  requireQaConfig();
  const dbs = [client(), client()];
  try {
    const a = await getOwnWorkspace(dbs[0], accounts[0]);
    const b = await getOwnWorkspace(dbs[1], accounts[1]);
    requireDistinctConfirmedOwnerSessions(a, b, fail);
    await verifyIsolation(a,b);
    await verifyIsolation(b,a);
    if (env.V4_QA_REQUIRE_OPERATIONAL_EVIDENCE === "1") {
      await verifyTwoTenantOperationalRls(a,b,fail);
      await verifyTwoTenantOperationalRls(b,a,fail);
      console.log("REAL_AUTHENTICATED_STAGING_OPERATIONS_RLS_POSITIVE_NEGATIVE_PASS: two distinct owner-visible operational row sets, five scoped tables each; no provider or complete customer journey proven");
    } else {
      // Negative reads against empty tables are not business-data RLS proof.
      console.log("REAL_AUTHENTICATED_STAGING_CORE_RLS_PRECHECK_PASS: owner sessions and foreign workspace restrictions only; operational row evidence NOT VERIFIED");
    }
  } finally {
    await Promise.allSettled(dbs.map(db => db.auth.signOut()));
  }
}
try { await main(); } catch (error) {
  // Deliberately omit upstream error messages, URLs, emails, access tokens
  // and database rows. Only our predetermined failure category is printed.
  const message = error instanceof Error && /^REAL_AUTH_RLS_BLOCKED_OR_FAILED:[A-Z0-9_]+$/.test(error.message)
    ? error.message : "REAL_AUTH_RLS_BLOCKED_OR_FAILED:UNKNOWN";
  process.stderr.write(message + "\n");
  process.exitCode = 1;
}
