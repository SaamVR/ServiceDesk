import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const runtime = readFileSync(
  join(process.cwd(), "src/features/operations/operational-product-runtime.ts"),
  "utf8",
);
const route = readFileSync(
  join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"),
  "utf8",
);

describe("V2 customer contact verification review", () => {
  it("loads contact verification evidence only after staff workspace authorization", () => {
    const resolver = runtime.indexOf("export async function resolveStaffActor");
    const loader = runtime.indexOf("export async function loadOperationalStaffSnapshot");
    const contacts = runtime.indexOf('.from("customer_contacts")');
    expect(resolver).toBeGreaterThanOrEqual(0);
    expect(loader).toBeGreaterThan(resolver);
    expect(contacts).toBeGreaterThan(loader);
    expect(runtime).toContain("verified_at");
  });

  it("normalizes Email identity only for duplicate detection and preserves exact Phone identity", () => {
    expect(runtime).toContain('kind === "EMAIL" ? rawValue.toLowerCase() : rawValue');
    expect(runtime).toContain("verifiedIdentityCustomers");
    expect(runtime).toContain("customerIds.add(customerId)");
    expect(runtime).toContain("activeCustomerIds.has(customerId)");
    expect(runtime).toContain("verifiedIdentityCustomers.get(identityKey)?.size");
    expect(runtime).toContain("identityConflictCount");
  });

  it("shows verified, unverified, and cross-customer conflict states without a verification mutation", () => {
    expect(route).toContain("Contact verification");
    expect(route).toContain("Identity conflict");
    expect(route).toContain("Needs verification");
    expect(route).toContain("This screen is review-only and cannot mark a contact verified.");
    expect(route).not.toContain("verifyCustomerContact");
    expect(route).not.toContain("markContactVerified");
  });

  it("warns that duplicate verified identity blocks safe automatic linking", () => {
    expect(route).toContain("Duplicate verified identity detected");
    expect(route).toContain("Resolve the duplicate customer-contact records before using automatic identity linking.");
  });
});
