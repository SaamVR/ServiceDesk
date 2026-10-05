import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V2 professional CRM and invoice UI", () => {
  it("presents a customer relationship workspace with portfolio and activity context", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    expect(route).toContain("Customer relationship workspace");
    expect(route).toContain("Customer account summary");
    expect(route).toContain("Recent service requests");
    expect(route).toContain("selectedProperties");
    expect(route).toContain("openInvoiceTotal");
  });

  it("makes invoice balance and collection mode explicit", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    expect(route).toContain("Invoice collection workspace");
    expect(route).toContain("Outstanding balance");
    expect(route).toContain("Record offline payment");
    expect(route).toContain("applyOperationalManualPayment");
    expect(route).toContain("ServiceDesk SANDBOX checkout");
    expect(route).toContain("Paid state changes only after verified payment application");
  });

  it("keeps customer invoicing distinct from platform billing", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    expect(route).toContain("Customer finance");
    expect(route).not.toContain("Apply platform subscription payment");
  });

  it("has responsive CRM and finance record workspace contracts", () => {
    const css = source("src/features/operations/OperationalProductRoute.module.css");
    expect(css).toContain("crmWorkspace");
    expect(css).toContain("financeWorkspace");
    expect(css).toContain("@media(max-width:760px)");
  });
});
