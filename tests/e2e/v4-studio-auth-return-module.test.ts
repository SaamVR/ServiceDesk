import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  STUDIO_RETURN_HEADER,
  safeStudioReturnFromRequest,
  verifiedStudioSignInTarget,
} from "../../src/features/auth/studio-return-target";
import { normalizeReturnPath } from "../../src/features/auth/return-path";

const modules = [
  "overview", "customers", "requests", "quotes", "schedule", "jobs",
  "quality", "invoices", "inbox", "automations", "reports", "billing", "settings",
] as const;
const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("V4 authenticated Studio return-to-module", () => {
  it.each(modules)("preserves the originally requested protected %s page", (module) => {
    const target = safeStudioReturnFromRequest("/app/qa-company/" + module);
    expect(target).toBe("/app/qa-company/" + module);
    expect(verifiedStudioSignInTarget("qa-company", target)).toBe(target);
    expect(normalizeReturnPath(target!)).toBe(target);
  });
  it("retains only module-specific deep-link filters and re-encodes text", () => {
    expect(safeStudioReturnFromRequest("/app/qa-company/requests",
      "?request=cccccccc-cccc-4ccc-8ccc-cccccccccccc&search=Two+rooms&next=https%3A%2F%2Fevil.example&notice=none"))
      .toBe("/app/qa-company/requests?request=cccccccc-cccc-4ccc-8ccc-cccccccccccc&search=Two+rooms");
    expect(safeStudioReturnFromRequest("/app/qa-company/inbox",
      "?conversation=123&queue=UNREAD")).toBe("/app/qa-company/inbox?conversation=123&queue=UNREAD");
    expect(safeStudioReturnFromRequest("/app/qa-company/automations",
      "?template=VISIT_COMPLETED")).toBe("/app/qa-company/automations?template=VISIT_COMPLETED");
  });
  it("fails closed on unrelated and malicious return destinations, including cross-tenant hops", () => {
    for (const unsafe of [
      "/app/qa-company/unknown", "/app/qa-company/inbox/secret", "/app//inbox",
      "/app/qa-company/%2f%2fevil.example", "//evil.example", "/app/qa-company/inbox/..",
      "https://evil.example", "/auth/sign-out",
    ]) {
      expect(safeStudioReturnFromRequest(unsafe)).toBeNull();
      expect(verifiedStudioSignInTarget("qa-company", unsafe))
        .toBe("/app/qa-company/overview");
    }
    expect(verifiedStudioSignInTarget("other-company", "/app/qa-company/jobs"))
      .toBe("/app/other-company/overview");
  });
  it("overwrites incoming spoofable return headers before refreshing cookies", () => {
    const proxy = src("src/proxy.ts");
    expect(proxy).toContain("request.headers.delete(STUDIO_RETURN_HEADER)");
    expect(proxy).toContain("safeStudioReturnFromRequest(request.nextUrl.pathname, request.nextUrl.search)");
    expect(proxy).toContain("request.headers.set(STUDIO_RETURN_HEADER, target)");
    expect(proxy.indexOf("request.headers.delete(STUDIO_RETURN_HEADER)"))
      .toBeLessThan(proxy.indexOf("refreshAuthSession(request)"));
    expect(STUDIO_RETURN_HEADER).toBe("x-servicedesk-studio-return-path");
  });
  it("keeps real-session and tenant checks before protected Studio content", () => {
    const layout = src("src/app/app/[workspace]/layout.tsx");
    expect(layout).toContain("await hasAuthenticatedSession()");
    expect(layout).toContain("verifiedStudioSignInTarget(workspace");
    expect(layout).toContain("await loadOperationalBranchScope(workspace)");
    expect(layout.indexOf("if (!signedIn)"))
      .toBeLessThan(layout.indexOf("await loadOperationalBranchScope"));
  });
  it("limits query volume, control characters, and header injection", () => {
    expect(safeStudioReturnFromRequest("/app/qa-company/requests","?search=" + "a".repeat(300)))
      .toBe("/app/qa-company/requests");
    expect(safeStudioReturnFromRequest("/app/qa-company/jobs","?queue=" + "x".repeat(1000)))
      .toBeNull();
    expect(safeStudioReturnFromRequest("/app/qa-company/jobs","?queue=%0aevil"))
      .toBe("/app/qa-company/jobs");
  });
});
