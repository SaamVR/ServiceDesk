import { describe, expect, it } from "vitest";
import { buildReportingView } from "@/features/reports/view-models";
import { buildPlatformBillingView } from "@/features/billing/view-models";
import { buildOwnerSettingsView } from "@/features/settings/view-models";

describe("E09 reporting/billing/settings product boundaries", () => {
  it("uses authoritative reporting snapshot values", () => { const view = buildReportingView({ workspaceId: "ws", requestCount: 10, bookedRequestCount: 5, conversionRateBps: 5000, collectedMinor: 10000, outstandingMinor: 2500, currency: "USD", scheduledServiceMinutes: 60, scheduledBufferMinutes: 15, openAttentionCount: 2, unresolvedQualityCount: 1, generatedAt: "2026-10-04T00:00:00.000Z" }); expect(view.cards.find((c) => c.label === "Conversion")?.value).toBe("50.0%"); });
  it("keeps platform sandbox separate from customer invoices", () => { const view = buildPlatformBillingView({ workspaceId: "ws", subscription: { workspaceId: "ws", plan: "TRIAL", status: "TRIALING", providerMode: "SANDBOX", version: 1, updatedAt: "2026-10-04T00:00:00.000Z" }, usage: [] }, { id: "inv", workspaceId: "ws", status: "ISSUED", currency: "USD", totalMinor: 1000, allocatedMinor: 0, refundedMinor: 0, balanceMinor: 1000 }); expect(view.releaseLabel).toBe("CONFIGURATION_BLOCKED"); expect(view.customerInvoiceLabel).toContain("customer balance"); });
  it("owner settings do not expose secrets or rate versions", () => { const view = buildOwnerSettingsView({ snapshot: { workspaceId: "ws", services: [{ code: "MOVE_OUT", label: "Move-out", enabled: true }], members: [{ userId: "owner", role: "OWNER", active: true }], invitations: [{ id: "invite", role: "CREW", state: "PENDING", createdAt: "2026-10-04T00:00:00.000Z" }] }, integrations: [] }); expect(view.exposesSecrets).toBe(false); expect(view.services[0]).not.toHaveProperty("rateVersion"); });
});
