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

export interface RedactedStripeCheckoutRequestSummary {
  method: "POST";
  host: string;
  endpoint: string;
  hasBearerAuthorization: boolean;
  hasConnectedAccount: boolean;
  hasIdempotencyKey: boolean;
  bodyKeys: string[];
}

export function redactedStripeCheckoutRequestSummary(request: StripeCheckoutHttpRequest): RedactedStripeCheckoutRequestSummary {
  const url = new URL(request.url);
  const bodyKeys: string[] = [];
  const params = new URLSearchParams(request.body);
  for (const key of params.keys()) bodyKeys.push(key);

  return {
    method: request.method,
    host: url.host,
    endpoint: url.pathname,
    hasBearerAuthorization: request.headers.authorization?.startsWith("Bearer ") === true,
    hasConnectedAccount: Boolean(request.headers["stripe-account"]),
    hasIdempotencyKey: Boolean(request.headers["idempotency-key"]),
    bodyKeys: Array.from(new Set(bodyKeys)).sort(),
  };
}

function isCheckoutPurpose(value: unknown): value is CheckoutInput["purpose"] {
  return value === "DEPOSIT" || value === "BALANCE" || value === "PLATFORM_SUBSCRIPTION";
}

function amountForPurpose(input: CheckoutInput): Result<number> {
  if (!isCheckoutPurpose(input.purpose)) {
    return { ok: false, code: "PAYMENT_PURPOSE_INVALID", message: "Checkout purpose is not supported by the payment connector." };
  }
  if (input.purpose === "DEPOSIT") return { ok: true, value: input.quote.depositMinor };
  if (input.purpose === "BALANCE") {
    if (!Number.isInteger(input.balanceMinor) || (input.balanceMinor ?? 0) <= 0) {
      return { ok: false, code: "PAYMENT_INVOICE_BALANCE_INVALID", message: "Balance checkout requires the current authoritative invoice balance." };
    }
    return { ok: true, value: input.balanceMinor! };
  }
  return { ok: true, value: input.quote.totalMinor };
}

function checkoutUrlSafe(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function checkoutMetadata(input: CheckoutInput): Record<string, string> {
  return {
    workspaceId: input.quote.workspaceId,
    quoteId: input.quote.id,
    purpose: input.purpose,
    ...(input.hold ? { holdId: input.hold.holdId } : {}),
    ...(input.invoiceId ? { invoiceId: input.invoiceId } : {}),
  };
}

function normalizeCheckoutInput(input: CheckoutInput, now: string): Result<{ amountMinor: number; currency: string; idempotencyKey: string; metadata: Record<string, string> }> {
  if (input.purpose === "DEPOSIT") {
    if (!input.hold) {
      return { ok: false, code: "PAYMENT_HOLD_REFERENCE_MISSING", message: "Deposit checkout requires an authoritative hold." };
    }
    if (input.hold.workspaceId !== input.quote.workspaceId || input.hold.quoteId !== input.quote.id) {
      return { ok: false, code: "CHECKOUT_SCOPE_MISMATCH", message: "Hold and quote do not share workspace/quote scope." };
    }
    const holdExpiresAtMs = new Date(input.hold.expiresAt).getTime();
    const nowMs = new Date(now).getTime();
    if (!Number.isFinite(holdExpiresAtMs) || !Number.isFinite(nowMs)) {
      return { ok: false, code: "PAYMENT_HOLD_EXPIRY_INVALID", message: "Checkout hold expiry timestamp is invalid." };
    }
    if (holdExpiresAtMs <= nowMs) {
      return { ok: false, code: "PAYMENT_HOLD_EXPIRED", message: "Checkout hold has expired before provider session creation." };
    }
  }

  if (input.purpose === "BALANCE" && !input.invoiceId?.trim()) {
    return { ok: false, code: "PAYMENT_INVOICE_REFERENCE_MISSING", message: "Balance checkout requires invoiceId metadata." };
  }

  const amount = amountForPurpose(input);
  if (!amount.ok) return amount;
  const amountMinor = amount.value;
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
      idempotencyKey: `checkout:${input.quote.workspaceId}:${input.hold?.holdId ?? input.invoiceId ?? input.quote.id}:${input.purpose}`,
      metadata: checkoutMetadata(input),
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
  params.set("line_items[0][price_data][product_data][name]", `ServiceDesk ${String(input.purpose).toLowerCase()} payment`);
  for (const [key, value] of Object.entries(checkoutMetadata(input))) {
    params.set(`metadata[${key}]`, value);
  }
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
    notes: ["Stripe-style sandbox checkout session accepted by injected transport; live provider receipt is not claimed for V1."],
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

  const normalized = normalizeCheckoutInput(input, config.now());
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
        metadata: normalized.value.metadata,
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