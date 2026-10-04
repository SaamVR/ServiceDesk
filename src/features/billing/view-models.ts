import type { InvoiceDTO, PlatformBillingSnapshotDTO, UsageMetricDTO } from "@/contracts";

export interface PlatformBillingView { planLabel: string; statusLabel: string; modeLabel: "SANDBOX" | "LIVE"; releaseLabel: "IMPLEMENTED" | "CONFIGURATION_BLOCKED"; usageRows: Array<{ label: string; value: string; state: UsageMetricDTO["state"] }>; customerInvoiceLabel?: string; boundaryNotice: string; }
const money = (minor: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
export function buildPlatformBillingView(snapshot: PlatformBillingSnapshotDTO, customerInvoice?: InvoiceDTO): PlatformBillingView {
  const subscription = snapshot.subscription;
  return { planLabel: subscription.plan, statusLabel: subscription.status.replaceAll("_", " "), modeLabel: subscription.providerMode, releaseLabel: subscription.providerMode === "LIVE" && subscription.status === "ACTIVE" ? "IMPLEMENTED" : "CONFIGURATION_BLOCKED", usageRows: snapshot.usage.map((metric) => ({ label: metric.metric.replaceAll("_", " "), value: metric.limit ? `${metric.used}/${metric.limit}` : `${metric.used}`, state: metric.state })), customerInvoiceLabel: customerInvoice ? `${customerInvoice.status.replaceAll("_", " ")} · ${money(customerInvoice.balanceMinor, customerInvoice.currency)} customer balance` : undefined, boundaryNotice: "Platform subscription billing is separate from customer cleaning invoices, refunds and receipts." };
}
