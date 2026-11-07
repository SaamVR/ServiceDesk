import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

// SOURCE-only critic. Never dispatch this historic UAT job from a test.
const source=readFileSync(".github/workflows/v4-l4-authenticated-uat.yml","utf8");
const credentialJob=source.split("  authenticated-seven-widths:")[1];

describe("P02 archived authenticated QA job remains manual, exact-SHA gated",()=>{
  it("cannot run a credential-bearing owner session automatically on any branch push",()=>{
    expect(credentialJob).toBeDefined();
    expect(credentialJob).toContain("github.event_name == 'workflow_dispatch'");
    expect(credentialJob).toContain("vars.SERVICEDESK_P02_AUTH_UAT_APPROVED == 'true'");
    expect(credentialJob).toContain("vars.SERVICEDESK_P02_AUTH_UAT_APPROVED_SHA == github.sha");
    expect(credentialJob).not.toContain("github.ref_name ==");
  });
  it("checks the checked-out SHA against separate operator configuration before QA secrets",()=>{
    const guard=credentialJob.indexOf("Fail closed unless this exact SHA");
    const secret=credentialJob.indexOf("SERVICEDESK_QA_TEST_EMAIL: ${{ secrets.");
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(secret).toBeGreaterThan(guard);
    expect(credentialJob).toContain('test "$(git rev-parse HEAD)" = "$APPROVED_SHA"');
  });
  it("does not configure historical Render callbacks in an authorized Vercel QA run",()=>{
    expect(credentialJob).not.toContain("https://servicedesk-v3-frontend-review.onrender.com");
    expect(credentialJob).toContain("SERVICEDESK_AUTH_REDIRECT_ORIGIN: ${{ vars.SERVICEDESK_P02_AUTH_REDIRECT_ORIGIN }}");
    expect(credentialJob.match(/SERVICEDESK_AUTH_REDIRECT_ORIGIN:/g)).toHaveLength(2);
    expect(credentialJob.match(/VERCEL: "1"/g)).toHaveLength(2);
  });
  it("rejects non-HTTPS or historical Render callback origins without exposing secrets",()=>{
    expect(credentialJob).toContain('u.protocol!=="https:"');
    expect(credentialJob).toContain('u.hostname.endsWith(".onrender.com")');
    expect(credentialJob).toContain("u.origin!==v");
    expect(credentialJob).not.toContain("echo $SERVICEDESK_QA_TEST_PASSWORD");
  });
});


const rlsSource=readFileSync(".github/workflows/v4-l3-rls-real-session.yml","utf8");
const rlsCredentialJob=rlsSource.split("  real-session-rls:")[1];

describe("P02 two-owner real-session RLS must be manual and exactly approved",()=>{
  it("never exposes QA credentials to a legacy branch push",()=>{
    expect(rlsCredentialJob).toBeDefined();
    expect(rlsCredentialJob).toContain("github.event_name == 'workflow_dispatch'");
    expect(rlsCredentialJob).toContain("vars.SERVICEDESK_P02_RLS_UAT_APPROVED == 'true'");
    expect(rlsCredentialJob).toContain("vars.SERVICEDESK_P02_RLS_UAT_APPROVED_SHA == github.sha");
    expect(rlsCredentialJob).not.toContain("github.ref_name");
    expect(rlsCredentialJob).not.toContain("github.event_name == 'push'");
  });
  it("checks actual checkout SHA before loading either owner's credentials",()=>{
    const approved=rlsCredentialJob.indexOf("Refuse stale or unapproved real two-owner RLS workflow head");
    const secret=rlsCredentialJob.indexOf("SERVICEDESK_QA_OWNER_A_EMAIL: " + "$" + "{{ secrets.");
    expect(approved).toBeGreaterThanOrEqual(0);
    expect(secret).toBeGreaterThan(approved);
    expect(rlsCredentialJob).toContain('test "$(git rev-parse HEAD)" = "$APPROVED_SHA"');
  });
  it("separates P02 owner/branch RLS proof from optional P03 operational receipts",()=>{
    const input=rlsSource.split("  workflow_dispatch:")[1]?.split("permissions:")[0];
    expect(input).toContain("require_operational_evidence:");
    expect(input).toContain("default: false");
    expect(rlsCredentialJob).toContain("V4_QA_REQUIRE_OPERATIONAL_EVIDENCE: " + "$" + "{{ inputs.require_operational_evidence && '1' || '0' }}");
    expect(rlsCredentialJob).not.toContain('V4_QA_REQUIRE_OPERATIONAL_EVIDENCE: "1"');
    expect(rlsCredentialJob).toContain("V4_QA_REQUIRE_AUTOMATION_EVIDENCE:");
    const runner=readFileSync("scripts/release/v4-private-rls-proof.mjs","utf8");
    expect(runner).toContain('env.V4_QA_REQUIRE_OPERATIONAL_EVIDENCE === "1"');
    expect(runner).toContain("REAL_AUTHENTICATED_STAGING_CORE_RLS_PRECHECK_PASS");
    expect(runner).not.toContain("signUp(");
  });
  it("keeps read-only source checks available but never provisions users or deploys",()=>{
    const sourceOnly=rlsSource.split("  auth-source:")[1]?.split("  real-session-rls:")[0];
    expect(sourceOnly).toContain("node --check scripts/release/v4-private-rls-proof.mjs");
    expect(sourceOnly).not.toContain("secrets.SERVICEDESK_QA_OWNER_A_PASSWORD");
    expect(rlsCredentialJob).not.toContain("supabase auth admin");
    expect(rlsCredentialJob).not.toContain("vercel deploy");
    expect(rlsCredentialJob).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
