import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../../src/proxy";
import { buildStaffModuleHref, staffModuleConfig } from "../../src/features/operations/staff-modules";
import {
  STAFF_REQUEST_TARGET_HEADER,
  verifiedStudioReturnPath,
} from "../../src/features/auth/studio-return-path";

const forwarded = vi.hoisted(() => ({ path: null as string | null }));
vi.mock("@/features/auth/session-proxy", () => ({
  refreshAuthSession: async (request: NextRequest) => {
    forwarded.path = request.headers.get("x-servicedesk-staff-request-target");
    return new Response("proxy continued");
  },
}));

describe("V4 Studio requested-route retention with authorized boundaries", () => {
  it("retains all thirteen first-party modules and implemented query-filter routes", () => {
    const modules = Object.keys(staffModuleConfig) as Array<keyof typeof staffModuleConfig>;
    expect(modules).toHaveLength(13);
    for (const staffModule of modules) {
      const target = buildStaffModuleHref("acme-west", staffModule);
      expect(verifiedStudioReturnPath("acme-west", target)).toBe(target);
    }
    const requested = "/app/acme-west/requests?request=req-123&queue=needs-review";
    expect(verifiedStudioReturnPath("acme-west", requested)).toBe(requested);
  });

  it("preserves encoded workspace slugs but rejects a different workspace", () => {
    const target = "/app/east%2Fwest/jobs?job=visit-42";
    expect(verifiedStudioReturnPath("east/west", target)).toBe(target);
    expect(verifiedStudioReturnPath("east/west", "/app/other/jobs/visit-42"))
      .toBe("/app/east%2Fwest/overview");
    expect(verifiedStudioReturnPath("acme", "/app/acme-fake/inbox"))
      .toBe("/app/acme/overview");
  });

  it("falls back to implemented modules for unsupported nested record URLs", () => {
    expect(verifiedStudioReturnPath("acme", "/app/acme/jobs/visit-42"))
      .toBe("/app/acme/jobs");
    expect(verifiedStudioReturnPath("acme", "/app/acme/requests/req-42?request=req-42"))
      .toBe("/app/acme/requests");
    expect(verifiedStudioReturnPath("acme", "/app/acme/jobs?job=visit-42"))
      .toBe("/app/acme/jobs?job=visit-42");
  });

  it("fails closed for unrecognized routes, traversal, auth loops, open redirects and control characters", () => {
    for (const invalid of [
      undefined, null, "", "https://evil.example/app/acme/inbox",
      "//evil.example/app/acme/inbox", "/auth/sign-in?next=/app/acme/inbox",
      "/app/acme/invalid", "/app/acme/jobs-archive", "/app/acme/jobs//detail",
      "/app/acme/jobs/../billing", "/app/acme/jobs/%2e%2e/billing",
      "/app/acme/jobs/%2fapi", "/app/acme/inbox?next=%0aInjected",
      "/app/acme/inbox\r\nLocation: //evil.example", "/app/acme/inbox?" + "x".repeat(2100),
    ]) {
      expect(verifiedStudioReturnPath("acme", invalid)).toBe("/app/acme/overview");
    }
  });

  it("overwrites spoofed caller headers from the URL before forwarding to session refresh", async () => {
    const external = new NextRequest("https://review.test/app/acme/jobs?job=visit-42&_rsc=opaque", {
      headers: { [STAFF_REQUEST_TARGET_HEADER]: "/app/another/settings" },
    });
    await proxy(external);
    expect(forwarded.path).toBe("/app/acme/jobs?job=visit-42");

    const publicPage = new NextRequest("https://review.test/features", {
      headers: { [STAFF_REQUEST_TARGET_HEADER]: "/app/acme/automations" },
    });
    await proxy(publicPage);
    expect(forwarded.path).toBeNull();
  });

  it("keeps real verified session and scoped snapshot checks in the protected layout", () => {
    const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
    const layout = read("src/app/app/[workspace]/layout.tsx");
    const proxySource = read("src/proxy.ts");
    expect(layout).toContain("await hasAuthenticatedSession()");
    expect(layout.indexOf("if (!signedIn)")).toBeLessThan(layout.indexOf("await loadOperationalBranchScope(workspace)"));
    expect(layout).toContain('encodeURIComponent(verifiedStudioReturnPath(workspace, requested))');
    expect(proxySource).toContain("return refreshAuthSession(request)");
    expect(proxySource).toContain("request.headers.delete(STAFF_REQUEST_TARGET_HEADER)");
    expect(proxySource).toContain("search.delete(\"_rsc\")");
  });
});
