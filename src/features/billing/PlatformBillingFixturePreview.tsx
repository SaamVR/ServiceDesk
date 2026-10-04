import type { InvoiceDTO, PlatformBillingSnapshotDTO } from "@/contracts";
import { PlatformBillingPreview } from "./PlatformBillingPreview";

const fixtureBillingSnapshot: PlatformBillingSnapshotDTO = { workspaceId: "ws_showcase", subscription: { workspaceId: "ws_showcase", plan: "TRIAL", status: "TRIALING", providerMode: "SANDBOX", trialEndsAt: "2026-11-01T00:00:00.000Z", version: 1, updatedAt: "2026-10-04T18:30:00.000Z" }, usage: [ { metric: "AI_ACTIONS", used: 120, limit: 500, state: "WITHIN_LIMIT" }, { metric: "OUTBOUND_MESSAGES", used: 24, limit: 250, state: "WITHIN_LIMIT" }, { metric: "TEAM_MEMBERS", used: 2, limit: 5, state: "WITHIN_LIMIT" }, { metric: "CONNECTED_INTEGRATIONS", used: 1, limit: 6, state: "WITHIN_LIMIT" } ] };
const fixtureCustomerInvoice: InvoiceDTO = { id: "invoice_showcase_001", workspaceId: "ws_showcase", visitId: "visit_showcase_001", status: "PARTIALLY_PAID", currency: "USD", totalMinor: 34000, allocatedMinor: 8500, refundedMinor: 0, balanceMinor: 25500 };
export function PlatformBillingFixturePreview() { return <PlatformBillingPreview snapshot={fixtureBillingSnapshot} customerInvoice={fixtureCustomerInvoice} />; }
