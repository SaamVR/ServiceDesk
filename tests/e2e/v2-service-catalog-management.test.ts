import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const route = source("src/features/operations/OperationalProductRoute.tsx");
const runtime = source("src/features/operations/operational-product-runtime.ts");

describe("V2 authorized service catalog management", () => {
  it("loads real catalog rows and exposes them in the operational snapshot", () => {
    expect(runtime).toContain("OperationalServiceCatalogItem");
    expect(runtime).toContain("serviceCatalog:");
    expect(runtime).toContain("requiresReview: Boolean(row.requires_review)");
    expect(runtime).toContain("updatedAt: String(row.updated_at)");
  });

  it("uses the trusted catalog command with stale-write and capability protection", () => {
    expect(runtime).toContain("updateOperationalServiceCatalogItem");
    expect(runtime).toContain("servicedesk_update_service_catalog_item");
    expect(runtime).toContain("expectedUpdatedAt");
    expect(runtime).toContain("SERVICE_VERSION_CONFLICT");
    expect(runtime).toContain("SERVICE_CATALOG_SCOPE_REQUIRED");
    expect(runtime).not.toContain('.from("service_catalog").update');
  });

  it("renders editable controls only for an Owner or active delegated catalog manager", () => {
    expect(route).toContain("serviceCatalogAction");
    expect(route).toContain("canManageServiceCatalog");
    expect(route).toContain('grant.capability === "SERVICE_CATALOG_MANAGE"');
    expect(route).toContain('name="serviceId"');
    expect(route).toContain('name="expectedUpdatedAt"');
    expect(route).toContain('name="active"');
    expect(route).toContain('name="requiresReview"');
    expect(route).toContain("Owner access or an active delegated service-catalog capability");
    expect(route).toContain("Show for new enquiries");
  });
});
