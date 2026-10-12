import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V4 owner setup does not overstate plan or QA seeding readiness", () => {
  it("does not count PAST_DUE or CANCELLED plans as setup complete", () => {
    const route = read("src/features/onboarding/OnboardingProductRoute.tsx");
    expect(route).toContain('platformBilling?.subscription.status === "ACTIVE"');
    expect(route).toContain('platformBilling?.subscription.status === "TRIALING"');
    expect(route).not.toContain("Boolean(platformBilling?.subscription.status)");
    expect(route).toContain("Review workspace plan");
    expect(route).toContain("not proof of a real customer payment");
    expect(route).toContain("pricingVerified");
  });

  it("disables the explicit synthetic QA seed form during an in-flight server action", () => {
    const page = read("src/app/onboarding/verified/page.tsx");
    const button = read("src/features/auth/RegistrationSubmitButton.tsx");
    const guard = read("src/app/onboarding/verified/qa-seed-actions.ts");
    expect(page).toContain("action={seedVerifiedQaWorkspace}");
    expect(page).toContain('pendingLabel="Saving QA records…"');
    expect(page).toContain('label="Add fictional QA records"');
    expect(button).toContain("useFormStatus()");
    expect(button).toContain("disabled={disabled || pending}");
    expect(guard).toContain('operationalDatabaseMode() !== "QA_SESSION_RLS"');
    expect(guard).toContain("ownerRegistrationEmailAllowed(data.user.email)");
    expect(guard).toContain("loadVerifiedOwnerWorkspace");
  });
});
