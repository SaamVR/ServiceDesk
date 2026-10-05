import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const portal = source("src/features/operations/CustomerProductRoute.tsx");
const checkout = source("src/features/operations/SandboxCheckoutProductRoute.tsx");
const runtime = source("src/features/operations/customer-product-runtime.ts");
const route = source("src/app/portal/sandbox-checkout/[id]/page.tsx");

describe("V2 customer sandbox checkout product", () => {
  it("exposes explicit sandbox payment actions for deposits and invoice balances", () => {
    expect(portal).toContain("launchCustomerDepositSandboxCheckout");
    expect(portal).toContain("Pay deposit in sandbox");
    expect(portal).toContain("launchCustomerInvoiceSandboxCheckout");
    expect(portal).toContain("Open sandbox payment");
    expect(portal).toContain("No real money is charged");
    expect(portal).not.toContain("Online payment is not available from this invoice yet");
  });

  it("renders one dedicated checkout route for deposit and balance sandbox semantics", () => {
    expect(route).toContain("SandboxCheckoutProductRoute");
    expect(checkout).toContain("Stripe-style SANDBOX / DEMO");
    expect(checkout).toContain('session.purpose === "DEPOSIT"');
    expect(checkout).toContain("Sandbox deposit");
    expect(checkout).toContain("Complete sandbox payment");
    expect(checkout).toContain("No real money is charged");
    expect(checkout).toContain("never authoritative for hold, booking or invoice state");
    expect(checkout).toContain("never authoritative for invoice state");
  });

  it("routes completion through signed webhook verification and Core payment application", () => {
    expect(runtime).toContain("FixtureStripePaymentAdapter");
    expect(runtime).toContain("signStripeFixturePayload");
    expect(runtime).toContain("handleStripePaymentWebhook");
    expect(runtime).toContain("createPostgresPaymentApplicationFacadeMethods");
    expect(runtime).toContain("createPaymentWebhookApplicationStore");
    expect(runtime).toContain('purpose: "DEPOSIT"');
    expect(runtime).toContain('purpose: "BALANCE"');
    expect(runtime).toContain("holdId");
    expect(runtime).not.toContain('.from("invoices").update');
    expect(runtime).not.toContain('.from("invoices").upsert');
  });

  it("guards stale sessions against authoritative deposit, hold and invoice changes", () => {
    expect(runtime).toContain("quoteContext.quote.depositMinor !== sessionAmount");
    expect(runtime).toContain('String(holdResult.data.status) !== "HELD"');
    expect(runtime).toContain("context.invoice.balanceMinor !== sessionAmount");
    expect(runtime).toContain('status: "CANCELLED"');
    expect(checkout).toContain("Deposit amount changed");
    expect(checkout).toContain("Service-time hold changed");
    expect(checkout).toContain("Invoice balance changed");
  });
});
