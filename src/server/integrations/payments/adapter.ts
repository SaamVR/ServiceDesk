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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasFixtureStripePayloadShape(value: unknown): value is FixtureStripeWebhookPayload {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.account !== "string" || typeof value.type !== "string" || typeof value.created !== "number") {
    return false;
  }
  if (!isRecord(value.data) || !isRecord(value.data.object)) return false;
  return typeof value.data.object.id === "string"
    && value.data.object.id.trim().length > 0
    && typeof value.data.object.currency === "string"
    && /^[a-z]{3}$/i.test(value.data.object.currency);
}

function isAllowedPaymentPurpose(value: unknown): value is "DEPOSIT" | "BALANCE" | "PLATFORM_SUBSCRIPTION" {
  return value === "DEPOSIT" || value === "BALANCE" || value === "PLATFORM_SUBSCRIPTION";
}

function hexBuffer(value: string): Result<Buffer> {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) {
    return { ok: false, code: "MALFORMED_SIGNATURE", message: "Stripe signature contains a malformed v1 digest." };
  }
  return { ok: true, value: Buffer.from(value, "hex") };
}

function safeCompare(left: string, right: string): Result<boolean> {
  const leftBuffer = hexBuffer(left);
  const rightBuffer = hexBuffer(right);
  if (!leftBuffer.ok) return leftBuffer;
  if (!rightBuffer.ok) return rightBuffer;
  if (leftBuffer.value.length !== rightBuffer.value.length) return { ok: true, value: false };
  return { ok: true, value: timingSafeEqual(leftBuffer.value, rightBuffer.value) };
}

function parseStripeSignatureHeader(signatureHeader: string): Result<{ timestamp: string; signatures: string[] }> {
  const signatures: string[] = [];
  let timestamp: string | undefined;

  for (const rawPart of signatureHeader.split(",")) {
    const [key, ...rest] = rawPart.split("=");
    const value = rest.join("=");
    if (!key || !value) continue;
    if (key.trim() === "t") timestamp = value.trim();
    if (key.trim() === "v1") signatures.push(value.trim());
  }

  if (!timestamp || signatures.length === 0) {
    return { ok: false, code: "MALFORMED_SIGNATURE", message: "Stripe signature header is malformed." };
  }
  return { ok: true, value: { timestamp, signatures } };
}

export interface StripeSignatureVerificationOptions {
  nowSeconds?: number;
  toleranceSeconds?: number;
}

export function signStripeFixturePayload(rawBody: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const signature = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
  options: StripeSignatureVerificationOptions = {},
): Result<true> {
  if (!signatureHeader) return { ok: false, code: "MISSING_SIGNATURE", message: "Missing Stripe-Signature header." };

  const parsedHeader = parseStripeSignatureHeader(signatureHeader);
  if (!parsedHeader.ok) return parsedHeader;

  const timestampSeconds = Number(parsedHeader.value.timestamp);
  if (!Number.isFinite(timestampSeconds) || timestampSeconds <= 0) {
    return { ok: false, code: "MALFORMED_SIGNATURE", message: "Stripe signature timestamp is malformed." };
  }

  if (options.nowSeconds !== undefined) {
    const toleranceSeconds = options.toleranceSeconds ?? 300;
    if (Math.abs(options.nowSeconds - timestampSeconds) > toleranceSeconds) {
      return { ok: false, code: "SIGNATURE_TIMESTAMP_OUT_OF_TOLERANCE", message: "Stripe signature timestamp is outside the allowed tolerance." };
    }
  }

  const expected = createHmac("sha256", secret).update(`${parsedHeader.value.timestamp}.${rawBody}`).digest("hex");
  for (const candidate of parsedHeader.value.signatures) {
    const compared = safeCompare(expected, candidate);
    if (!compared.ok) return compared;
    if (compared.value) return { ok: true, value: true };
  }

  return { ok: false, code: "SIGNATURE_MISMATCH", message: "Stripe webhook signature did not match raw body." };
}

export function convertStripePayloadToVerifiedPaymentWebhook(
  payload: FixtureStripeWebhookPayload,
  providerAccountId: string,
  capturedAt: string,
): Result<VerifiedPaymentWebhook> {
  if (payload.account !== providerAccountId) {
    return { ok: false, code: "PAYMENT_ACCOUNT_MISMATCH", message: "Webhook account does not match configured payment account." };
  }

  if (payload.type !== "checkout.session.completed" && payload.type !== "payment_intent.succeeded") {
    return { ok: false, code: "PAYMENT_EVENT_IGNORED", message: "Payment event is not a succeeded checkout/payment event." };
  }

  const object = payload.data.object;
  const metadata = object.metadata ?? {};
  const amountMinor = object.amount_total ?? object.amount_received;
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    return { ok: false, code: "PAYMENT_AMOUNT_INVALID", message: "Succeeded payment event did not include a positive integer amount." };
  }

  if (!metadata.workspaceId) {
    return { ok: false, code: "PAYMENT_METADATA_MISSING", message: "Payment metadata is missing workspaceId." };
  }

  if (!isAllowedPaymentPurpose(metadata.purpose)) {
    return { ok: false, code: "PAYMENT_PURPOSE_INVALID", message: "Payment metadata purpose is not allowed." };
  }

  const providerTransactionId = typeof object.payment_intent === "string" && object.payment_intent.trim()
    ? object.payment_intent
    : payload.type === "payment_intent.succeeded"
      ? object.id
      : undefined;
  if (!providerTransactionId) {
    return { ok: false, code: "PAYMENT_TRANSACTION_MISSING", message: "Succeeded payment event did not include a transaction reference." };
  }

  return {
    ok: true,
    value: {
      event: {
        provider: "STRIPE",
        providerAccountId: payload.account,
        providerEventId: payload.id,
        providerTransactionId,
        purpose: metadata.purpose,
        workspaceId: metadata.workspaceId,
        amountMinor,
        currency: object.currency.toUpperCase(),
        occurredAt: new Date(payload.created * 1000).toISOString(),
      },
      evidence: {
        provider: "PAYMENT",
        mode: "SANDBOX",
        verification: "CONTRACT_TESTED",
        capturedAt,
        controlledId: payload.id,
        redactedReceipt: `${payload.id.slice(0, 8)}…${object.id.slice(-4)}`,
        notes: ["Webhook signature, account, purpose, amount, currency and transaction shape verified against fixture payload."],
      },
    },
  };
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
    const now = this.now();
    const nowSeconds = Math.floor(new Date(now).getTime() / 1000);
    const verified = verifyStripeSignature(
      rawBody,
      headers["stripe-signature"] ?? headers["Stripe-Signature"],
      this.webhookSecret,
      { nowSeconds, toleranceSeconds: 300 },
    );
    if (!verified.ok) return verified;

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(rawBody) as unknown;
    } catch {
      return { ok: false, code: "PAYMENT_PAYLOAD_MALFORMED", message: "Verified payment webhook payload is malformed JSON." };
    }

    if (!hasFixtureStripePayloadShape(parsedPayload)) {
      return { ok: false, code: "PAYMENT_PAYLOAD_INVALID", message: "Verified payment webhook payload has an invalid object shape." };
    }

    return convertStripePayloadToVerifiedPaymentWebhook(parsedPayload, this.providerAccountId, now);
  }
}
