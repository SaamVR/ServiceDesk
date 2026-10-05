import { describe, expect, it } from "vitest";
import type { QuoteDTO } from "../../src/contracts";
import { buildE10BSandboxCheckoutPreflight } from "../../src/server/integrations/evidence/v1-final-provider-acceptance";
import { createSandboxCheckoutCommandHandler } from "../../src/server/integrations/payments/sandbox-checkout-command";
import type { StripeCheckoutHttpRequest } from "../../src/server/integrations/payments/checkout-transport";

const now = "2026-10-04T20:00:00.000Z";

function quote(overrides: Partial<QuoteDTO> = {}): QuoteDTO {
  return {
    id: "quote_1",
    workspaceId: "ws_1",
    requestId: "req_1",
    version: 1,
    status: "ACCEPTED",
    currency: "USD",
    subtotalMinor: 10000,
    taxMinor: 0,
    totalMinor: 10000,
    depositMinor: 2500,
    balanceMinor: 7500,
    durationMinutes: 120,
    bufferMinutes: 30,
    rateVersion: "v1",
    validUntil: "2026-10-10T00:00:00.000Z",
    ...overrides,
  };
}

function handler(recorded: StripeCheckoutHttpRequest[] = []) {
  return createSandboxCheckoutCommandHandler({
    now: () => now,
    configResolver: {
      async resolve() {
        return {
          ok: true,
          value: {
            config: { apiBaseUrl: "https://api.stripe.test", secretKey: "sk_test_server_only", mode: "SANDBOX", now: () => now },
            http: async (request: StripeCheckoutHttpRequest) => {
              recorded.push(request);
              return { status: 200, body: JSON.stringify({ id: "cs_test_hold_1_deposit", url: "https://checkout.stripe.test/cs_test_hold_1_deposit" }) };
            },
          },
        };
      },
    },
  });
}

const baseCommand = {
  quote: quote(),
  hold: { holdId: "hold_1", workspaceId: "ws_1", quoteId: "quote_1", expiresAt: "2026-10-04T21:00:00.000Z" },
  purpose: "DEPOSIT" as const,
  successUrl: "https://app.example.test/success",
  cancelUrl: "https://app.example.test/cancel",
};

describe("E10B sandbox checkout command", () => {
  it("creates Product-safe sandbox checkout for an accepted quote", async () => {
    const requests: StripeCheckoutHttpRequest[] = [];
    const result = await handler(requests).execute(baseCommand);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.value.mode).toBe("SANDBOX");
    expect(result.value.amountMinor).toBe(2500);
    expect(result.value.currency).toBe("USD");
    expect(result.value.businessTruthMutation).toBe(false);
    expect(JSON.stringify(result.value)).not.toContain("sk_test_server_only");
    expect(JSON.stringify(result.value)).not.toContain("authorization");
    expect(requests[0].headers["idempotency-key"]).toBe("checkout:ws_1:hold_1:DEPOSIT");
  });

  it("rejects non-ACCEPTED deposit quotes", async () => {
    const result = await handler().execute({ ...baseCommand, quote: quote({ status: "SENT" }) });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected rejection");
    expect(result.code).toBe("QUOTE_NOT_ACCEPTED");
  });

  it("rejects expired holds and scope mismatch", async () => {
    const expired = await handler().execute({ ...baseCommand, hold: { ...baseCommand.hold, expiresAt: "2026-10-04T19:00:00.000Z" } });
    expect(expired.ok).toBe(false);
    if (!expired.ok) expect(expired.code).toBe("PAYMENT_HOLD_EXPIRED");

    const mismatch = await handler().execute({ ...baseCommand, hold: { ...baseCommand.hold, quoteId: "other_quote" } });
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) expect(mismatch.code).toBe("CHECKOUT_SCOPE_MISMATCH");
  });

  it("rejects LIVE mode and unsafe redirects", async () => {
    const live = await handler().execute({ ...baseCommand, requestedMode: "LIVE" });
    expect(live.ok).toBe(false);
    if (!live.ok) expect(live.code).toBe("PAYMENT_LIVE_MODE_REJECTED");

    const unsafe = await handler().execute({ ...baseCommand, successUrl: "http://app.example.test/success" });
    expect(unsafe.ok).toBe(false);
    if (!unsafe.ok) expect(unsafe.code).toBe("CHECKOUT_REDIRECT_URL_INVALID");
  });

  it("supports BALANCE only with invoice reference", async () => {
    const missingInvoice = await handler().execute({ ...baseCommand, purpose: "BALANCE" });
    expect(missingInvoice.ok).toBe(false);
    if (!missingInvoice.ok) expect(missingInvoice.code).toBe("PAYMENT_INVOICE_REFERENCE_MISSING");

    const balance = await handler().execute({
      ...baseCommand,
      hold: undefined,
      purpose: "BALANCE",
      invoiceId: "inv_1",
      balanceMinor: 6200,
    });
    expect(balance.ok).toBe(true);
    if (balance.ok) expect(balance.value.amountMinor).toBe(6200);
  });

  it("keeps provider preflight contract-only", () => {
    const preflight = buildE10BSandboxCheckoutPreflight({ quoteAccepted: true, activeHold: true, sandboxCheckoutCommandAvailable: true, webhookCoreBridgeAvailable: true, mode: "SANDBOX" });
    expect(preflight.pass).toBe(true);
    expect(preflight.providerVerifiedClaim).toBe(false);
    expect(preflight.contractEvidenceOnly).toBe(true);
  });
});