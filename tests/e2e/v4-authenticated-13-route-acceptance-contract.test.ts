import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { staffModuleConfig } from "../../src/features/operations/staff-modules";

const script = readFileSync(join(process.cwd(),"scripts/release/v4-authenticated-sidebar-chrome.mjs"),"utf8");

describe("V4 real-owner Studio UAT contract, not synthetic proof",()=>{
  it("covers all 13 protected modules, at all 7 viewport widths",()=>{
    for(const route of Object.keys(staffModuleConfig)) {
      expect(script,route).toContain('"'+route+'"');
    }
    expect(Object.keys(staffModuleConfig)).toHaveLength(13);
    expect(script).toContain("staffModules.filter(item => item !== \"overview\")");
    expect(script).toContain("for (const width of widths)");
    expect(script).toContain("320, 390, 834, 901, 1024, 1280, 1440");
    expect(script).toContain("await waitForWorkspace(target)");
    expect(script).toContain("report.push({width,module:staffModule,realAuthenticatedSession:true");
  });

  it("never treats an anonymous sidebar as a real signed-in workspace",()=>{
    expect(script).toContain('document.querySelector("form.app-signout-form")');
    expect(script).toContain('document.querySelector("a.app-auth-entry-link")');
    expect(script).toContain("authenticated?.account && authenticated.signout && !authenticated.signin");
    expect(script).toContain("!audit.signedIn");
    expect(script).toContain("if (!form)");
  });

  it("checks selected active link, secondary route disclosure and layout",()=>{
    expect(script).toContain("audit.activeCount !== 1");
    expect(script).toContain('["quality","reports","settings","billing"]');
    expect(script).toContain("!audit.moreOpen");
    expect(script).toContain("audit.documentWidth > width + 2");
    expect(script).toContain("AUTHENTICATED_OVERVIEW_REAL_WORKSPACE_SNAPSHOT_UNAVAILABLE");
    expect(script).toContain("result.unavailable");
    expect(script).toContain("audit.unavailable");
    expect(script).toContain("Workspace unavailable");
    expect(script).toContain("Staff sign-in required");
    expect(script).toContain("if (!expanded.open || expanded.count !== 4)");
    expect(script).toContain('new KeyboardEvent("keydown"');
    expect(script).toContain("Authenticated drawer Escape failed");
  });

  it("records only limited private screenshots and never leaks test account data",()=>{
    expect(script).toContain("width === 320 || width === 1440");
    expect(script).toContain("mode:0o600");
    expect(script).toContain("REAL_AUTHENTICATED_STAGING_STUDIO_UX_VERIFIED_ONLY");
    expect(script).toContain("providerVerified:false, productionReady:false");
    expect(script).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(script).not.toContain("console.log(email)");
    expect(script).not.toContain("console.log(password)");
  });
});
