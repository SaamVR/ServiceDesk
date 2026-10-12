import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeReturnPath } from "../../src/features/auth/return-path";

const content=(path:string)=>readFileSync(join(process.cwd(),path),"utf8");
const layout=content("src/app/app/[workspace]/layout.tsx");
describe("V4 Studio server-side anonymous access guard",()=>{
  it("requires verified current auth session before rendering authenticated navigation",()=>{
    expect(layout).toContain("const signedIn = await hasAuthenticatedSession()");
    expect(layout).toContain("if (!signedIn)");
    expect(layout).toContain("redirect(\"/auth/sign-in?next=\"");
    const guarded=layout.indexOf("if (!signedIn)");
    const branch=layout.indexOf("const branchContext = await loadOperationalBranchScope");
    const render=layout.indexOf("return (");
    expect(guarded).toBeGreaterThanOrEqual(0);
    expect(branch).toBeGreaterThan(guarded);
    expect(render).toBeGreaterThan(branch);
    expect(layout).not.toContain("signedIn ? await loadOperationalBranchScope");
  });
  it("encodes the target workspace slug and cannot redirect a login to an external domain",()=>{
    expect(layout).toContain("verifiedStudioReturnPath(workspace, requested)");
    expect(layout).toContain('(await headers()).get(STAFF_REQUEST_TARGET_HEADER)');
    const proxy = content("src/proxy.ts");
    expect(proxy).toContain("request.headers.delete(STAFF_REQUEST_TARGET_HEADER)");
    expect(proxy).toContain("request.headers.set(STAFF_REQUEST_TARGET_HEADER, target)");
    expect(proxy).toContain("return refreshAuthSession(request)");
    expect(normalizeReturnPath("/app/qa-cleaning/overview")).toBe("/app/qa-cleaning/overview");
    expect(normalizeReturnPath("https://evil.example/steal")).not.toContain("evil.example");
    expect(normalizeReturnPath("//evil.example")).not.toContain("evil.example");
  });
  it("keeps all business actions behind preexisting owner/branch authorization",()=>{
    expect(layout).toContain("await setOperationalBranchScope(workspace");
    expect(layout).toContain("<StaffAppShell workspace={workspace} signedIn={signedIn}>");
    expect(content("src/features/operations/OperationalProductRoute.tsx")).toContain("loadOperationalStaffSnapshot(workspaceSlug)");
    expect(content("src/features/operations/StaffOverviewDashboard.tsx")).toContain("Current workspace activity could not be loaded");
  });
});
