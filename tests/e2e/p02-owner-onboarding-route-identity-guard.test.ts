import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseOwnerOnboardingQuery } from "../../src/features/onboarding/owner-onboarding-query";

describe("P02 untrusted owner onboarding workspace URL and verification UX", () => {
  it("uses default signed-in workspace resolution only when no slug was supplied", () => {
    expect(parseOwnerOnboardingQuery(undefined)).toEqual({ kind: "DEFAULT" });
    for (const input of ["owner-workspace", "cleaning1", "aaa"]) {
      expect(parseOwnerOnboardingQuery(input)).toEqual({ kind: "SELECTED", slug: input });
    }
  });

  it("rejects malformed and oversized explicit workspace selections before database access", () => {
    const invalid = ["", " ", "  owner", "owner ", "/other", "../other", "a", "ab",
      "A-OWNER", "--owner", "owner--next", "owner?next=other",
      "a".repeat(41), "a\\b", "%2fowner", "tenant#other"];
    for (const value of invalid) expect(parseOwnerOnboardingQuery(value))
      .toEqual({ kind: "INVALID" });
  });

  it("distinguishes unconfirmed email from permission to create a new workspace", () => {
    const runtime = readFileSync("src/features/onboarding/onboarding-product-runtime.ts", "utf8");
    const route = readFileSync("src/features/onboarding/OnboardingProductRoute.tsx", "utf8");
    expect(runtime).toContain('kind: "verification"');
    expect(runtime).toContain("parseOwnerOnboardingQuery(workspaceSlug)");
    expect(runtime.indexOf('parsed.kind === "INVALID"'))
      .toBeLessThan(runtime.indexOf("loadOperationalStaffSnapshot(slug)"));
    expect(route).toContain('result.kind === "verification"');
    expect(route).toContain('"/auth/sign-up/check-email"');
    expect(route).toContain('result.kind === "verification"\n                    ? "/auth/sign-up/check-email"');
    expect(route).toContain('result.kind === "authorization"');
  });
});
