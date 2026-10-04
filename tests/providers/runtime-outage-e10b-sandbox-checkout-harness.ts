import assert from "node:assert/strict";
import { buildE10BSandboxCheckoutPreflight } from "../../src/server/integrations/evidence/v1-final-provider-acceptance";
import { createSandboxCheckoutCommandHandler } from "../../src/server/integrations/payments/sandbox-checkout-command";
import type { QuoteDTO } from "../../src/contracts";
import type { StripeCheckoutHttpRequest } from "../../src/server/integrations/payments/checkout-transport";

const now = "2026-10-04T20:00:00.000Z";
const quote: QuoteDTO = {
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
};
const hold = { holdId: "hold_1", workspaceId: "ws_1", quoteId: "quote_1", expiresAt: "2026-10-04T21:00:00.000Z" };
const requests: StripeCheckoutHttpRequest[] = [];
const handler = createSandboxCheckoutCommandHandler({
  now: () => now,
  configResolver: {
    async resolve() {
      return {
        ok: true,
        value: {
          config: { apiBaseUrl: "https://api.stripe.test", secretKey: "sk_test_server_only", mode: "SANDBOX", now: () => now },
          http: async (request: StripeCheckoutHttpRequest) => {
            requests.push(request);
            return { status: 200, body: JSON.stringify({ id: `cs_test_${request.headers["idempotency-key"]}`, url: "https://checkout.stripe.test/session" }) };
          },
        },
      };
    },
  },
});

async function main() {
  const accepted = await handler.execute({ quote, hold, purpose: "DEPOSIT", successUrl: "https://app.example.test/success", cancelUrl: "https://app.example.test/cancel" });
  assert.equal(accepted.ok, true);
  if (!accepted.ok) throw new Error("sandbox checkout was not accepted");
  assert.equal(accepted.value.mode, "SANDBOX");
  assert.equal(accepted.value.amountMinor, 2500);
  assert.equal(accepted.value.businessTruthMutation, false);
  assert.equal(requests[0].headers["idempotency-key"], "checkout:ws_1:hold_1:DEPOSIT");
  assert.equal(JSON.stringify(accepted.value).includes("sk_test_server_only"), false);
  assert.equal(JSON.stringify(accepted.value).includes("authorization"), false);

  const nonAccepted = await handler.execute({ quote: { ...quote, status: "APPROVED" }, hold, purpose: "DEPOSIT", successUrl: "https://app.example.test/success", cancelUrl: "https://app.example.test/cancel" });
  assert.equal(nonAccepted.ok, false);
  if (!nonAccepted.ok) assert.equal(nonAccepted.code, "QUOTE_NOT_ACCEPTED");

  const expired = await handler.execute({ quote, hold: { ...hold, expiresAt: "2026-10-04T19:59:00.000Z" }, purpose: "DEPOSIT", successUrl: "https://app.example.test/success", cancelUrl: "https://app.example.test/cancel" });
  assert.equal(expired.ok, false);
  if (!expired.ok) assert.equal(expired.code, "PAYMENT_HOLD_EXPIRED");

  const mismatch = await handler.execute({ quote, hold: { ...hold, workspaceId: "other_ws" }, purpose: "DEPOSIT", successUrl: "https://app.example.test/success", cancelUrl: "https://app.example.test/cancel" });
  assert.equal(mismatch.ok, false);
  if (!mismatch.ok) assert.equal(mismatch.code, "CHECKOUT_SCOPE_MISMATCH");

  const live = await handler.execute({ quote, hold, purpose: "DEPOSIT", successUrl: "https://app.example.test/success", cancelUrl: "https://app.example.test/cancel", requestedMode: "LIVE" });
  assert.equal(live.ok, false);
  if (!live.ok) assert.equal(live.code, "PAYMENT_LIVE_MODE_REJECTED");

  const balanceMissingInvoice = await handler.execute({ quote, hold, purpose: "BALANCE", successUrl: "https://app.example.test/success", cancelUrl: "https://app.example.test/cancel" });
  assert.equal(balanceMissingInvoice.ok, false);
  if (!balanceMissingInvoice.ok) assert.equal(balanceMissingInvoice.code, "PAYMENT_INVOICE_REFERENCE_MISSING");

  const preflight = buildE10BSandboxCheckoutPreflight({ quoteAccepted: true, activeHold: true, sandboxCheckoutCommandAvailable: true, webhookCoreBridgeAvailable: true, mode: "SANDBOX" });
  assert.equal(preflight.pass, true);
  assert.equal(preflight.contractEvidenceOnly, true);
  assert.equal(preflight.providerVerifiedClaim, false);

  console.log("runtime-outage-e10b-sandbox-checkout-harness PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
