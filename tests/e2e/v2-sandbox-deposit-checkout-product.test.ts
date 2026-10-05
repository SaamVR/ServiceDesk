import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V2 sandbox deposit checkout product", () => {
  it("offers deposit checkout only from an accepted quote with an active held slot", () => {
    const portal = source("src/features/operations/CustomerProductRoute.tsx");
    expect(portal).toContain('hold.status === "HELD"');
    expect(portal).toContain('activeHold.status === "HELD" && quote.depositMinor > 0');
    expect(portal).toContain("launchCustomerDepositSandboxCheckout");
    expect(portal).toContain("Pay deposit in sandbox");
    expect(portal).not.toContain("booking is not confirmed until payment is verified");
  });

  it("keeps deposit session expiry bounded by the authoritative hold", () => {
    const runtime = source("src/features/operations/customer-product-runtime.ts");
    expect(runtime).toContain("Math.min(now.getTime() + 30 * 60 * 1000, holdExpiresAt)");
    expect(runtime).toContain('.eq("hold_id", holdId)');
    expect(runtime).toContain('.eq("purpose", "DEPOSIT")');
  });

  it("routes verified deposits through the same signed webhook and Core application path", () => {
    const runtime = source("src/features/operations/customer-product-runtime.ts");
    expect(runtime).toContain('purpose: "DEPOSIT"');
    expect(runtime).toContain("signStripeFixturePayload");
    expect(runtime).toContain("handleStripePaymentWebhook");
    expect(runtime).toContain("createPostgresPaymentApplicationFacadeMethods");
    expect(runtime).toContain("Sandbox deposit verified. Your booking and invoice were created by ServiceDesk Core.");
  });

  it("returns a successful deposit to the quote so the created booking can be discovered", () => {
    const checkout = source("src/features/operations/SandboxCheckoutProductRoute.tsx");
    expect(checkout).toContain("completed.quoteId");
    expect(checkout).toContain('/portal/quotes/${encodeURIComponent(completed.quoteId)}');
    expect(checkout).toContain("Booking deposit");
    expect(checkout).toContain("Hold status");
  });
});
