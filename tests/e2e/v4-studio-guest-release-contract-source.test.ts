import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V4 exact-head Studio guest route acceptance", () => {
  const testScript = read("scripts/release/v4-studio-guest-release-contract.mjs");
  const release = read(".github/workflows/v4-reconciled-full-rc.yml");

  it("checks the real compiled Next service rather than a mocked auth layout", () => {
    expect(release).toContain("Start exact build on loopback");
    expect(release).toContain("Real HTTP guest-route release contract (all 13 modules)");
    expect(release).toContain("node scripts/release/v4-studio-guest-release-contract.mjs");
    expect(release.indexOf("Start exact build on loopback"))
      .toBeLessThan(release.indexOf("Real HTTP guest-route release contract"));
    expect(release.indexOf("Real HTTP guest-route release contract"))
      .toBeLessThan(release.indexOf("Real Chrome public responsive proof"));
  });

  it("never requires identities, live provider calls or credentials", () => {
    expect(testScript).toContain('redirect: "manual"');
    expect(testScript).toContain('method: "GET"');
    expect(testScript).toContain('"http://127.0.0.1:3000"');
    expect(testScript).toContain('"https://servicedesk-v3-frontend-review.onrender.com"');
    expect(testScript).toContain("guestDeniedModules:");
    expect(testScript).toContain("authenticatedOwnerAcceptance: false");
    expect(testScript).toContain("tenantRlsAcceptance: false");
    expect(testScript).toContain("providerDeliveryAcceptance: false");
    expect(testScript).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(testScript).not.toContain("V4_AUTH_QA_PASSWORD");
  });

  it("requires module-specific post-login destinations and rejects spoofed headers", () => {
    const auth = read("src/features/auth/studio-return-path.ts");
    expect(testScript).toContain('const modules = [');
    expect(testScript).toContain('guestDeniedModules: protectedResults.length');
    expect(testScript).toContain("login.searchParams.get(\"next\")");
    expect(testScript).toContain('"/app/foreign-workspace/billing"');
    expect(auth).toContain("if (segments.length > 0) return root + module");
    expect(testScript).toContain("undefinedNestedRoutesFailClosed");
  });
});
