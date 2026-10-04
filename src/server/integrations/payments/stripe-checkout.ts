import type { Result } from "../../../contracts";
import type { CheckoutInput, CheckoutSession, ProviderMode, RedactedProviderEvidence } from "../types";

export interface StripeCheckoutConfig {
  apiBaseUrl: string;
  secretKey: string;
  providerAccountId: string;
  connectedAccountId?: string;
  mode: ProviderMode;
  timeoutMs?: number;
  now: () => string;
}

export interface StripeCheckoutHttpRequest {
  url: string;
  method: "POST";
  headers: Record<string, string>;
  body: string;
  signal: AbortSignal;
}

export interface StripeCheckoutHttpResponse {
  status: number;
  body: string;
}

export type StripeCheckoutHttpTransport = (request: StripeCheckoutHttpRequest) => Promise<StripeCheckoutHttpResponse>;

function amountForPurpose(input: CheckoutInput): number {
  if (input.purpose === "DEPOSIT") return input.quote.depositMinor;
  if (input.purpose === "BALANCE") return input.quote.balanceMinor;
  return input.quote.totalMinor;
}

function checkoutUrlSafe(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeCheckoutInput(input: CheckoutInput): Result<{ amountMinor: number; currency: string; idempotencyKey: string }> {
  if (input.hold.workspaceId !== input.quote.workspaceId || input.hold.quoteId !== input.quote.id) {
    return { ok: false, code: "CHECKOUT_SCOPE_MISMATCH", message: "Hold and quote do not share workspace/quote scope." };
  }

  const amountMinor = amountForPurpose(input);
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    return { ok: false, code: "INVALID_CHECKOUT_AMOUNT", message: "Checkout amount must be a positive integer minor-unit value." };
  }

  if (!checkoutUrlSafe(input.successUrl) || !checkoutUrlSafe(input.cancelUrl)) {
    return { ok: false, code: "PAYMENT_CHECKOUT_URL_INVALID", message: "Checkout success/cancel URLs must use HTTPS." };
  }

  const currency = input.quote.currency.toLowerCase();
  if (!/^[a-z]{3}$/.test(currency)) {
    return { ok: false, code: "PAYMENT_CURRENCY_INVALID", message: "Checkout currency must be a three-letter code." };
  }

  return {
    ok: true,
    value: {
      amountMinor,
      currency,
      idempotencyKey: `checkout:${input.quote.workspaceId}:${input.hold.holdId}:${input.purpose}`,
    },
  };
}

function stripeBaseUrl(config: StripeCheckoutConfig): string {
  return config.apiBaseUrl.replace(/\/+$/, "");
}

function buildCheckoutBody(input: CheckoutInput, amountMinor: number, currency: string): string {
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", input.successUrl);
  params.set("cancel_url", input.cancelUrl);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", currency);
  params.set("line_items[0][price_data][unit_amount]", String(amountMinor));
  params.set("line_items[0][price_data][product_data][name]", `ServiceDesk ${input.purpose.toLowerCase()} payment`);
  params.set("metadata[workspaceId]", input.quote.workspaceId);
  params.set("metadata[quoteId]", input.quote.id);
  params.set("metadata[holdId]", input.hold.holdId);
  params.set("metadata[purpose]", input.purpose);
  return params.toString();
}

function normalizedCheckoutFailure(status: number): Result<never> {
  if (status === 401 || status === 403) {
    return { ok: false, code: "PAYMENT_CONFIGURATION_BLOCKED", message: "Payment provider authentication or authorization failed." };
  }
  if (status === 400) {
    return { ok: false, code: "PAYMENT_INVALID_REQUEST", message: "Payment provider rejected the checkout request." };
  }
  if (status === 409) {
    return { ok: false, code: "PAYMENT_PROVIDER_CONFLICT", message: "Payment provider reported a checkout conflict." };
  }
  if (status === 429) {
    return { ok: false, code: "PAYMENT_RATE_LIMITED", message: "Payment provider rate limit reached." };
  }
  if (status >= 500) {
    return { ok: false, code: "PAYMENT_TRANSIENT_FAILURE", message: "Payment provider returned a transient server failure." };
  }
  return { ok: false, code: "PAYMENT_PROVIDER_REJECTED", message: "Payment provider rejected the checkout request." };
}

function evidence(config: StripeCheckoutConfig, providerSessionId: string): RedactedProviderEvidence {
  return {
    provider: "PAYMENT",
    mode: config.mode,
    verification: "CONTRACT_TESTED",
    capturedAt: config.now(),
    controlledId: providerSessionId,
    redactedReceipt: `${providerSessionId.slice(0, 8)}…${providerSessionId.slice(-4)}`,
    notes: ["Stripe-style checkout session accepted by injected transport; controlled provider receipt required before PROVIDER_VERIFIED."],
  };
}

export async function createStripeCheckoutSession(
  config: StripeCheckoutConfig,
  input: CheckoutInput,
  http: StripeCheckoutHttpTransport,
): Promise<Result<CheckoutSession>> {
  if (!config.apiBaseUrl || !config.secretKey || !config.providerAccountId) {
    return { ok: false, code: "PAYMENT_CONFIGURATION_BLOCKED", message: "Stripe checkout configuration is incomplete." };
  }

  const normalized = normalizeCheckoutInput(input);
  if (!normalized.ok) return normalized;

  const controller = new AbortController();
  const timeoutMs = Math.max(250, Math.min(config.timeoutMs ?? 10_000, 30_000));
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      authorization: `Bearer ${config.secretKey}`,
      "content-type": "application/x-www-form-urlencoded",
      "idempotency-key": normalized.value.idempotencyKey,
    };
    if (config.connectedAccountId) headers["stripe-account"] = config.connectedAccountId;

    const response = await http({
      url: `${stripeBaseUrl(config)}/checkout/sessions`,
      method: "POST",
      headers,
      body: buildCheckoutBody(input, normalized.value.amountMinor, normalized.value.currency),
      signal: controller.signal,
    });

    if (response.status < 200 || response.status >= 300) return normalizedCheckoutFailure(response.status);

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.body);
    } catch {
      return { ok: false, code: "PAYMENT_PROVIDER_INVALID_RESPONSE", message: "Payment provider checkout response was malformed JSON." };
    }

    const providerSessionId = (parsed as { id?: unknown }).id;
    const checkoutUrl = (parsed as { url?: unknown }).url;
    if (typeof providerSessionId !== "string" || !providerSessionId.trim() || typeof checkoutUrl !== "string" || !checkoutUrlSafe(checkoutUrl)) {
      return { ok: false, code: "PAYMENT_PROVIDER_INVALID_RESPONSE", message: "Payment provider checkout response is missing a valid session ID or HTTPS URL." };
    }

    return {
      ok: true,
      value: {
        provider: "STRIPE",
        providerSessionId,
        checkoutUrl,
        amountMinor: normalized.value.amountMinor,
        currency: normalized.value.currency.toUpperCase(),
        mode: config.mode,
        evidence: evidence(config, providerSessionId),
      },
    };
  } catch (error) {
    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      return { ok: false, code: "PAYMENT_PROVIDER_TIMEOUT", message: "Payment provider checkout request timed out." };
    }
    return { ok: false, code: "PAYMENT_PROVIDER_NETWORK_FAILURE", message: "Payment provider checkout request failed before a valid response was received." };
  } finally {
    clearTimeout(timeout);
  }
}
