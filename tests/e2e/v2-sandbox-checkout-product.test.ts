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
  it("replaces the invoice dead-end with an explicit sandbox payment action", () => {
    expect(portal).toContain("launchCustomerInvoiceSandboxCheckout");
    expect(portal).toContain("Open sandbox payment");
    expect(portal).toContain("No real money is charged");
    expect(portal).not.toContain("Online payment is not available from this invoice yet");
  });

  it("renders a dedicated customer checkout route with explicit sandbox semantics", () => {
    expect(route).toContain("SandboxCheckoutProductRoute");
    expect(checkout).toContain("Stripe-style SANDBOX / DEMO");
    expect(checkout).toContain("Complete sandbox payment");
    expect(checkout).toContain("No real money is charged");
    expect(checkout).toContain("The checkout session itself is never authoritative for invoice state");
  });

  it("routes completion through signed webhook verification and Core payment application", () => {
    expect(runtime).toContain("FixtureStripePaymentAdapter");
    expect(runtime).toContain("signStripeFixturePayload");
    expect(runtime).toContain("handleStripePaymentWebhook");
    expect(runtime).toContain("createPostgresPaymentApplicationFacadeMethods");
    expect(runtime).toContain("createPaymentWebhookApplicationStore");
    expect(runtime).toContain('purpose: "BALANCE"');
    expect(runtime).not.toContain('.from("invoices").update');
    expect(runtime).not.toContain('.from("invoices").upsert');
  });

  it("guards stale sessions against authoritative invoice balance changes", () => {
    expect(runtime).toContain("context.invoice.balanceMinor !== sessionAmount");
    expect(runtime).toContain('status: "CANCELLED"');
    expect(checkout).toContain("Invoice balance changed");
  });
});
