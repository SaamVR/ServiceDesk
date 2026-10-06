import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const route = readFileSync(join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"), "utf8");

describe("V2 workspace eyebrow distinction", () => {
  it("keeps inner workspace eyebrows distinct from the shared module eyebrow", () => {
    for (const label of [
      "Customer directory",
      "Quote workspace",
      "Work queue",
      "Issue management",
      "Performance summary",
    ]) {
      expect(route).toContain(`>${label}</p>`);
    }

    expect(route).not.toContain('<p className={styles.crmEyebrow}>CRM</p>');
    expect(route).not.toContain('<p className={styles.salesEyebrow}>Sales pipeline</p>');
    expect(route).not.toContain('<p className={styles.jobsEyebrow}>Field operations</p>');
    expect(route).not.toContain('<p className={styles.qualityEyebrow}>Service quality</p>');
    expect(route).not.toContain('<p className={styles.adminEyebrow}>Insights</p>');
  });
});
