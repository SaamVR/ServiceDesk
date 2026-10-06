import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const productionRoutes = [
  "src/app/app/[workspace]/overview/page.tsx",
  "src/app/app/[workspace]/customers/page.tsx",
  "src/app/app/[workspace]/inbox/page.tsx",
  "src/app/app/[workspace]/invoices/page.tsx",
  "src/app/app/[workspace]/jobs/page.tsx",
  "src/app/app/[workspace]/quality/page.tsx",
  "src/app/app/[workspace]/quotes/page.tsx",
  "src/app/app/[workspace]/reports/page.tsx",
  "src/app/app/[workspace]/requests/page.tsx",
  "src/app/app/[workspace]/schedule/page.tsx",
  "src/app/app/[workspace]/settings/page.tsx",
  "src/app/app/[workspace]/billing/page.tsx",
  "src/app/app/[workspace]/automations/page.tsx",
  "src/app/crew/today/page.tsx",
  "src/app/portal/page.tsx",
  "src/app/portal/properties/page.tsx",
  "src/app/portal/bookings/[id]/page.tsx",
  "src/app/portal/invoices/[id]/page.tsx",
  "src/app/portal/quotes/[id]/page.tsx",
  "src/app/b/[slug]/book/page.tsx",
  "src/app/b/[slug]/enquire/page.tsx",
];

describe("V2 production route fixture boundary", () => {
  it("keeps fixture and acceptance-only components out of production entry routes", () => {
    for (const path of productionRoutes) {
      const file = source(path);
      expect(file, path).not.toMatch(/FixturePreview|FixtureRoute|OperationalFixtureRoute|FIXTURE_UI_ONLY/);
    }
  });

  it("keeps staff workspaces on the operational product runtime", () => {
    expect(source("src/app/app/[workspace]/overview/page.tsx")).toContain("loadOperationalStaffSnapshot");
    for (const path of productionRoutes.filter((path) => path.startsWith("src/app/app/[workspace]/") && !path.includes("/overview/"))) {
      expect(source(path), path).toContain("OperationalProductRoute");
    }
  });

  it("keeps crew and portal entry routes on their product runtimes", () => {
    expect(source("src/app/crew/today/page.tsx")).toContain("loadCrewTodayProduct");
    expect(source("src/app/crew/today/page.tsx")).toContain("CrewTodayV2");
    expect(source("src/app/portal/page.tsx")).toContain("CustomerProductRoute");
    expect(source("src/app/portal/properties/page.tsx")).toContain("CustomerProductRoute");
  });
});
