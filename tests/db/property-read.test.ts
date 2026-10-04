import { describe, expect, it } from "vitest";
import { createPostgresPropertyRepository, type PropertyRow } from "../../src/server/core/property-repository";
import { readPropertySnapshot } from "../../src/server/core/property-read";

const owner = { workspaceId: "ws_1", userId: "owner_1", role: "OWNER" as const };
const row: PropertyRow = {
  id: "prop_1", workspace_id: "ws_1", customer_id: "cust_1", label: "Home",
  address_line1: "1 Main St", address_line2: null, city: "London", region: "Greater London",
  postal_code: "SW1A 1AA", country_code: "GB", access_notes: "Key safe", service_notes: "Eco products",
  version: 3, archived_at: null,
};

describe("property read boundary", () => {
  it("maps same-workspace active property rows to PropertyDTO", async () => {
    const repository = createPostgresPropertyRepository({ listActiveByCustomer: async () => ({ data: [row], error: null }) });
    await expect(readPropertySnapshot(owner, "cust_1", repository)).resolves.toEqual({ ok: true, value: [{
      id: "prop_1", workspaceId: "ws_1", customerId: "cust_1", label: "Home", addressLine1: "1 Main St",
      city: "London", region: "Greater London", postalCode: "SW1A 1AA", countryCode: "GB",
      serviceNotes: "Eco products", accessNotes: "Key safe", version: 3,
    }] });
  });

  it("fails closed for wrong-scope rows and denies visitors", async () => {
    const repository = createPostgresPropertyRepository({ listActiveByCustomer: async () => ({ data: [{ ...row, workspace_id: "ws_2" }], error: null }) });
    await expect(readPropertySnapshot(owner, "cust_1", repository)).resolves.toEqual({ ok: false, code: "PROPERTY_SCOPE_MISMATCH", message: "Property row was outside the requested workspace or customer scope." });
    await expect(readPropertySnapshot({ workspaceId: "ws_1", visitorSessionId: "v1", role: "VISITOR" }, "cust_1", repository)).resolves.toEqual({ ok: false, code: "STAFF_AUTH_REQUIRED", message: "Verified staff membership is required." });
  });
});
