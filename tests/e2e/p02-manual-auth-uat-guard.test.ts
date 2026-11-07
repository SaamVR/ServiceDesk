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
