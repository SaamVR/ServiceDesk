import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const runtime = readFileSync(
  join(process.cwd(), "src/features/operations/operational-product-runtime.ts"),
  "utf8",
);

describe("V2 delegated service catalog product boundary", () => {
  it("does not preemptively restrict the service catalog action to Owner in the UI runtime", () => {
    const start = runtime.indexOf("export async function updateOperationalServiceCatalogItem");
    const end = runtime.indexOf("export async function createOperationalTeamInvitation", start);
    const action = runtime.slice(start, end);
    expect(action).toContain('"servicedesk_update_service_catalog_item"');
    expect(action).not.toContain('resolved.value.actor.role !== "OWNER"');
    expect(action).toContain("SERVICE_CATALOG_SCOPE_REQUIRED");
  });

  it("uses a dedicated owner-only action to grant only SERVICE_CATALOG_MANAGE", () => {
    const start = runtime.indexOf("export async function setOperationalServiceCatalogDelegation");
    const end = runtime.indexOf("export async function grantOperationalTenantSupportAccess", start);
    const action = runtime.slice(start, end);
    expect(action).toContain('resolved.value.actor.role !== "OWNER"');
    expect(action).toContain('"servicedesk_set_operator_capability"');
    expect(action).toContain('capability: "SERVICE_CATALOG_MANAGE"');
    expect(action).not.toContain("WORKFLOW_MANAGE");
    expect(action).not.toContain("RETENTION_MANAGE");
  });
});
