import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const route = readFileSync(join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"), "utf8");

describe("V2 professional module title hierarchy", () => {
  it("uses task-oriented workspace titles instead of repeating the page module name", () => {
    for (const title of [
      "Customer records",
      "Request pipeline",
      "Quote pipeline",
      "Planning &amp; dispatch",
      "Field operations queue",
      "Collections &amp; invoices",
      "Quality review queue",
      "Recovery queue",
      "Business performance",
      "Subscription &amp; usage",
      "Workspace administration",
    ]) {
      expect(route).toContain(`<h2>${title}</h2>`);
    }

    for (const duplicate of [
      "Customers", "Requests", "Quotes", "Schedule", "Jobs", "Invoices",
      "Quality", "Automations", "Reports", "Billing", "Settings",
    ]) {
      expect(route).not.toContain(`<h2>${duplicate}</h2>`);
    }
  });
  it("keeps workspace eyebrows semantically distinct from their task titles", () => {
    expect(route).toContain('<p className={styles.crmEyebrow}>Customer directory</p>');
    expect(route).toContain('<p className={styles.scheduleEyebrow}>Operations planning</p>');
    expect(route).toContain('<p className={styles.adminEyebrow}>Performance summary</p>');
    expect(route).not.toContain('<p className={styles.crmEyebrow}>CRM</p>');
    expect(route).not.toContain('<p className={styles.scheduleEyebrow}>Planning & dispatch</p>');
    expect(route).not.toContain('<p className={styles.adminEyebrow}>Insights</p>');
  });

});
