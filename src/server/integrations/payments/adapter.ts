import { createHmac, timingSafeEqual } from "node:crypto";
import type { Result } from "../../../contracts";
import type { CheckoutInput, CheckoutSession, PaymentAdapter, VerifiedPaymentWebhook } from "../types";

export interface FixtureStripeWebhookPayload {
  id: string;
  account: string;
  type: "checkout.session.completed" | "payment_intent.succeeded" | "payment_intent.payment_failed";
  created: number;
  data: {
    object: {
      id: string;
      amount_total?: number;
      amount_received?: number;
      currency: string;
      metadata?: Record<string, string | undefined>;
      payment_intent?: string;
    };
  };
}

function safeCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function signStripeFixturePayload(rawBody: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const signature = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

export function verifyStripeSignature(rawBody: string, signatureHeader: string | undefined, secret: string): Result<true> {
  if (!signatureHeader) return { ok: false, code: "MISSING_SIGNATURE", message: "Missing Stripe-Signature header." };
  const parts = Object.fromEntries(signatureHeader.split(",").map((part) => part.split("=", 2)));
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return { ok: false, code: "MALFORMED_SIGNATURE", message: "Stripe signature header is malformed." };
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  if (!safeCompare(expected, signature)) return { ok: false, code: "SIGNATURE_MISMATCH", message: "Stripe webhook signature did not match raw body." };
  return { ok: true, value: true };
}

export class FixtureStripePaymentAdapter implements PaymentAdapter {
  constructor(
    private readonly webhookSecret: string,
    private readonly providerAccountId: string,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async createCheckout(input: CheckoutInput): Promise<Result<CheckoutSession>> {
    const amountMinor = input.purpose === "DEPOSIT" ? input.quote.depositMinor : input.quote.balanceMinor;
    if (amountMinor <= 0) return { ok: false, code: "INVALID_CHECKOUT_AMOUNT", message: "Checkout amount must be positive." };
    if (input.hold.workspaceId !== input.quote.workspaceId || input.hold.quoteId !== input.quote.id) {
      return { ok: false, code: "CHECKOUT_SCOPE_MISMATCH", message: "Hold and quote do not share workspace/quote scope." };
    }

    const providerSessionId = `cs_fixture_${input.hold.holdId}_${input.purpose.toLowerCase()}`;
    return {
      ok: true,
      value: {
        provider: "FIXTURE",
        providerSessionId,
        checkoutUrl: `https://checkout.fixture.local/${providerSessionId}`,
        amountMinor,
        currency: input.quote.currency,
        mode: "FIXTURE",
        evidence: {
          provider: "PAYMENT",
          mode: "FIXTURE",
          verification: "CONTRACT_TESTED",
          capturedAt: this.now(),
          controlledId: providerSessionId,
          notes: ["Fixture checkout only; Stripe sandbox receipt required before PROVIDER_VERIFIED."],
        },
      },
    };
  }

  async verifyWebhook(rawBody: string, headers: Record<string, string | undefined>): Promise<Result<VerifiedPaymentWebhook>> {
    const verified = verifyStripeSignature(rawBody, headers["stripe-signature"] ?? headers["Stripe-Signature"], this.webhookSecret);
    if (!verified.ok) return verified;

    const payload = JSON.parse(rawBody) as FixtureStripeWebhookPayload;
    if (payload.account !== this.providerAccountId) return { ok: false, code: "PAYMENT_ACCOUNT_MISMATCH", message: "Webhook account does not match configured payment account." };
    if (payload.type !== "checkout.session.completed" && payload.type !== "payment_intent.succeeded") {
      return { ok: false, code: "PAYMENT_EVENT_IGNORED", message: "Payment event is not a succeeded checkout/payment event." };
    }

    const object = payload.data.object;
    const metadata = object.metadata ?? {};
    const amountMinor = object.amount_total ?? object.amount_received;
    if (!amountMinor) return { ok: false, code: "PAYMENT_AMOUNT_MISSING", message: "Succeeded payment event did not include an amount." };
    if (!metadata.workspaceId || !metadata.purpose) return { ok: false, code: "PAYMENT_METADATA_MISSING", message: "Payment metadata is missing workspaceId or purpose." };

    return {
      ok: true,
      value: {
        event: {
          provider: "STRIPE",
          providerAccountId: payload.account,
          providerEventId: payload.id,
          providerTransactionId: object.payment_intent ?? object.id,
          purpose: metadata.purpose as "DEPOSIT" | "BALANCE" | "PLATFORM_SUBSCRIPTION",
          workspaceId: metadata.workspaceId,
          amountMinor,
          currency: object.currency.toUpperCase(),
          occurredAt: new Date(payload.created * 1000).toISOString(),
        },
        evidence: {
          provider: "PAYMENT",
          mode: "SANDBOX",
          verification: "CONTRACT_TESTED",
          capturedAt: this.now(),
          controlledId: payload.id,
          redactedReceipt: `${payload.id.slice(0, 8)}…${object.id.slice(-4)}`,
          notes: ["Webhook signature, account, purpose, amount and currency shape verified against fixture payload."],
        },
      },
    };
  }
}
