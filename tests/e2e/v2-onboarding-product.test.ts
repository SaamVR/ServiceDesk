import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

describe("V2 onboarding product", () => {
  it("removes fixture routing and uses authenticated owner workspace data", () => {
    const page = source("src/app/onboarding/page.tsx");
    const runtime = source("src/features/onboarding/onboarding-product-runtime.ts");

    expect(page).toContain("OnboardingProductRoute");
    expect(page).not.toContain("OperationalFixtureRoute");
    expect(runtime).toContain("auth.auth.getUser()");
    expect(runtime).toContain('.eq("role", "OWNER")');
    expect(runtime).toContain("loadOperationalStaffSnapshot");
  });

  it("uses the shared staff shell and real owner settings", () => {
    const route = source("src/features/onboarding/OnboardingProductRoute.tsx");

    expect(route).toContain("StaffAppShell");
    expect(route).toContain("ownerSettings");
    expect(route).toContain("enabledServices");
    expect(route).not.toContain("PROVIDER_VERIFIED");
    expect(route.toLowerCase()).not.toContain("fixture");
  });
});
