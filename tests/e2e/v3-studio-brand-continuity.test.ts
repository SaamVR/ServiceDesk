import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Studio OS public-to-staff brand continuity", () => {
  it("carries teal/graphite identity from marketing into registration and staff", () => {
    const hero = read("src/components/shell/MarketingHeroV3.module.css");
    const nav = read("src/components/shell/MarketingNavV3.module.css");
    const registration = read("src/features/auth/RegistrationShell.module.css");
    const staff = read("src/components/product/StaffWorkspaceV3.module.css");
    expect(hero).toContain("#142b33");
    expect(nav).toContain("#0b746d");
    expect(registration).toContain("#142b33");
    expect(staff).toContain("--app-accent: #0b746d");
    expect(hero).not.toContain("#162d28");
  });
  it("preserves actual sign-up routing and customer safety rather than inventing demo records", () => {
    const marketing = read("src/app/page.tsx");
    expect(marketing).toContain('primaryHref={canRegister ? "/auth/sign-up" : "/tour"}');
    expect(marketing).toContain("ownerRegistrationAvailable()");
    expect(marketing).toContain("<StaffWorkspacePreview />");
    expect(marketing).toContain("<CustomerJourneyPreview />");
  });
});
