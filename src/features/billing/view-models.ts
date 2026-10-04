import type { InvoiceDTO } from "@/contracts";

export interface PlatformPlanFixture {
  planCode: string;
  state: "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELLED";
  renewalAt?: string;
  providerMode: "FIXTURE" | "SANDBOX" | "LIVE";
}

export interface PlatformBillingView {
  platformPlanLabel: string;
  renewalLabel: string;
  customerPaymentLabel: string;
  customerBalanceLabel: string;
  boundaryNotice: string;
  releaseLabel: "IMPLEMENTED" | "CONFIGURATION_BLOCKED";
  dataSource: "FIXTURE_UI_ONLY" | "PROVIDER_BACKED";
}

function money(minor: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(minor / 100);
}

export function buildPlatformBillingView({
  plan,
  customerInvoice,
}: {
  plan: PlatformPlanFixture;
  customerInvoice: InvoiceDTO;
}): PlatformBillingView {
  const providerBacked = plan.providerMode === "LIVE";

  return {
    platformPlanLabel: `${plan.planCode} · ${plan.state.replaceAll("_", " ")}`,
    renewalLabel: plan.renewalAt
      ? new Date(plan.renewalAt).toLocaleDateString("en-GB", { timeZone: "UTC" })
      : "No renewal date",
    customerPaymentLabel: customerInvoice.status.replaceAll("_", " "),
    customerBalanceLabel: money(customerInvoice.balanceMinor, customerInvoice.currency),
    boundaryNotice:
      "Platform subscription billing is separate from customer cleaning payments, invoices, refunds and receipts.",
    releaseLabel: providerBacked ? "IMPLEMENTED" : "CONFIGURATION_BLOCKED",
    dataSource: providerBacked ? "PROVIDER_BACKED" : "FIXTURE_UI_ONLY",
  };
}
