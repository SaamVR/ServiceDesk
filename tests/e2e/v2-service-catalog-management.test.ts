import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const route = source("src/features/operations/OperationalProductRoute.tsx");
const runtime = source("src/features/operations/operational-product-runtime.ts");

describe("V2 owner service catalog management", () => {
  it("loads real catalog rows and exposes them in the operational snapshot", () => {
    expect(runtime).toContain("OperationalServiceCatalogItem");
    expect(runtime).toContain("serviceCatalog:");
    expect(runtime).toContain("requiresReview: Boolean(row.requires_review)");
    expect(runtime).toContain("updatedAt: String(row.updated_at)");
  });

  it("uses a trusted owner command with stale-write protection", () => {
    expect(runtime).toContain("updateOperationalServiceCatalogItem");
    expect(runtime).toContain("servicedesk_update_service_catalog_item");
    expect(runtime).toContain("expectedUpdatedAt");
    expect(runtime).toContain("SERVICE_VERSION_CONFLICT");
    expect(runtime).toContain('resolved.value.actor.role !== "OWNER"');
    expect(runtime).not.toContain('.from("service_catalog").update');
  });

  it("renders owner-editable service controls while keeping non-owners read-only", () => {
    expect(route).toContain("serviceCatalogAction");
    expect(route).toContain('data.actor.role === "OWNER"');
    expect(route).toContain('name="serviceId"');
    expect(route).toContain('name="expectedUpdatedAt"');
    expect(route).toContain('name="active"');
    expect(route).toContain('name="requiresReview"');
    expect(route).toContain("Only owners can make changes");
    expect(route).toContain("Show for new enquiries");
  });
});
