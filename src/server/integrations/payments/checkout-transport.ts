import type { Result } from "../../../contracts";
import type { CheckoutInput, CheckoutSession, ProviderMode, RedactedProviderEvidence } from "../types";

export interface StripeCheckoutTransportConfig {
  apiBaseUrl: string;
  secretKey: string;
  mode: ProviderMode;
  connectedAccountId?: string;
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
  metadataKeys: string[];
  amountMinor: number | null;
  currency: string | null;
}

function amountFor(input: CheckoutInput): number {
  if (input.purpose === "DEPOSIT") return input.quote.depositMinor;
  if (input.purpose === "BALANCE") return input.balanceMinor ?? 0;
  return input.quote.totalMinor;
}

function validatedCheckoutReturnUrl(value: string): URL | null {
  if (!value || value.trim() !== value || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname.includes(".") ||
        url.username || url.password || url.hash || url.port ||
        url.hostname === "localhost" || url.hostname.endsWith(".localhost") ||
        url.hostname.endsWith(".local") || url.hostname.endsWith(".internal") ||
        /^\d{1,3}(?:\.\d{1,3}){3}$/.test(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

/** Stripe must return its own hosted checkout, not an arbitrary HTTPS redirect. */
function validatedStripeCheckoutUrl(value: string): boolean {
  if (!value || value.trim() !== value || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "checkout.stripe.com" &&
      !url.port && !url.username && !url.password && !url.hash &&
      url.pathname.length > 1;
  } catch {
    return false;
  }
}

function authorizedStripeApiBase(value: string): boolean {
  if (!value || value.trim() !== value) return false;
  try {
    const url = new URL(value);
    return url.origin === "https://api.stripe.com" &&
      (url.pathname === "/" || url.pathname === "") &&
      !url.username && !url.password && !url.port && !url.search && !url.hash;
  } catch {
    return false;
  }
}

function baseUrl(config: StripeCheckoutTransportConfig): string {
  return config.apiBaseUrl.replace(/\/+$/, "");
}

function buildCheckoutBody(input: CheckoutInput, amountMinor: number): URLSearchParams {
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", input.successUrl);
  body.set("cancel_url", input.cancelUrl);
  body.set("client_reference_id", input.hold?.holdId ?? input.invoiceId ?? input.quote.id);
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", input.quote.currency.toLowerCase());
  body.set("line_items[0][price_data][unit_amount]", String(amountMinor));
  body.set("line_items[0][price_data][product_data][name]", `ServiceDesk ${input.purpose.toLowerCase()} payment`);

  const metadata: Record<string, string> = {
    workspaceId: input.quote.workspaceId,
    quoteId: input.quote.id,
    purpose: input.purpose,
    ...(input.hold ? { holdId: input.hold.holdId } : {}),
    ...(input.invoiceId ? { invoiceId: input.invoiceId } : {}),
  };

  for (const [key, value] of Object.entries(metadata)) {
    body.set(`metadata[${key}]`, value);
    body.set(`payment_intent_data[metadata][${key}]`, value);
  }

  return body;
}

function normalizedFailure(status: number): Result<never> {
  if (status === 401 || status === 403) {
    return { ok: false, code: "PAYMENT_CONFIGURATION_BLOCKED", message: "Payment provider authentication or account authorization failed." };
  }
  if (status === 400) {
    return { ok: false, code: "PAYMENT_INVALID_REQUEST", message: "Payment provider rejected the checkout request." };
  }
  if (status === 409) {
    return { ok: false, code: "PAYMENT_PROVIDER_CONFLICT", message: "Payment provider rejected the checkout request due to a conflict." };
  }
  if (status === 429) {
    return { ok: false, code: "PAYMENT_RATE_LIMITED", message: "Payment provider rate limit reached." };
  }
  if (status >= 500) {
    return { ok: false, code: "PAYMENT_TRANSIENT_FAILURE", message: "Payment provider returned a transient server failure." };
  }
  return { ok: false, code: "PAYMENT_PROVIDER_REJECTED", message: "Payment provider rejected the checkout request." };
}

function parseCheckoutResponse(body: string, mode: ProviderMode): Result<{ id: string; url: string }> {
  // HTTPS 2xx is not enough to establish a Stripe checkout. Bound the actual
  // provider envelope before JSON parsing or retaining any returned fields.
  if (typeof body !== "string" || Buffer.byteLength(body, "utf8") > 16_384 || !body.trim()) {
    return { ok: false, code: "PAYMENT_PROVIDER_RESPONSE_INVALID",
      message: "Payment provider checkout response is missing or exceeds the accepted envelope." };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { ok: false, code: "PAYMENT_PROVIDER_RESPONSE_INVALID", message: "Payment provider checkout response is malformed JSON." };
  }

  // A 200 status carrying null/arrays is an invalid provider contract, not
  // a network failure or a confirmed checkout session.
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, code: "PAYMENT_PROVIDER_RESPONSE_INVALID",
      message: "Payment provider checkout response was not an object." };
  }
  const id = (parsed as { id?: unknown }).id;
  const url = (parsed as { url?: unknown }).url;
  if (typeof id !== "string" || id.length > 512 || !/^cs_(?:test|live)_[A-Za-z0-9_]+$/.test(id) ||
      (mode === "LIVE" ? !id.startsWith("cs_live_") : !id.startsWith("cs_test_")) ||
      typeof url !== "string" || !validatedStripeCheckoutUrl(url)) {
    return { ok: false, code: "PAYMENT_PROVIDER_RESPONSE_INVALID", message: "Payment provider checkout response is missing a valid session ID or URL." };
  }

  return { ok: true, value: { id, url } };
}

function evidence(config: StripeCheckoutTransportConfig, providerSessionId: string): RedactedProviderEvidence {
  return {
    provider: "PAYMENT",
    mode: config.mode,
    verification: "CONTRACT_TESTED",
    capturedAt: config.now(),
    controlledId: providerSessionId,
    redactedReceipt: `${providerSessionId.slice(0, 8)}…${providerSessionId.slice(-4)}`,
    notes: [
      "Stripe-style checkout session accepted by injected transport.",
      "Amount, currency, purpose and workspace metadata were derived server-side from CheckoutInput.",
      "Sandbox provider receipt is still required before PROVIDER_VERIFIED.",
    ],
  };
}

export function redactedStripeCheckoutRequestSummary(request: StripeCheckoutHttpRequest): RedactedStripeCheckoutRequestSummary {
  const url = new URL(request.url);
  const body = new URLSearchParams(request.body);
  const metadataKeys: string[] = [];
  for (const key of body.keys()) {
    const match = key.match(/^metadata\[([^\]]+)\]$/);
    if (match) metadataKeys.push(match[1]);
  }

  const amount = body.get("line_items[0][price_data][unit_amount]");
  return {
    method: "POST",
    host: url.host,
    endpoint: url.pathname,
    hasBearerAuthorization: request.headers.authorization?.startsWith("Bearer ") === true,
    hasConnectedAccount: Boolean(request.headers["stripe-account"]),
    metadataKeys: metadataKeys.sort(),
    amountMinor: amount ? Number(amount) : null,
    currency: body.get("line_items[0][price_data][currency]")?.toUpperCase() ?? null,
  };
}

export async function createStripeCheckoutSession(
  input: CheckoutInput,
  config: StripeCheckoutTransportConfig,
  http: StripeCheckoutHttpTransport,
): Promise<Result<CheckoutSession>> {
  if (!config.apiBaseUrl || !config.secretKey ||
      !authorizedStripeApiBase(config.apiBaseUrl) ||
      (config.mode === "SANDBOX" && !/^(?:sk|rk)_test_/.test(config.secretKey)) ||
      (config.mode === "LIVE" && !/^(?:sk|rk)_live_/.test(config.secretKey))) {
    return { ok: false, code: "PAYMENT_CONFIGURATION_BLOCKED", message: "Payment checkout configuration is incomplete or not valid for the selected provider mode." };
  }

  if (input.purpose === "DEPOSIT") {
    if (!input.hold) {
      return { ok: false, code: "PAYMENT_HOLD_REFERENCE_MISSING", message: "Deposit checkout requires an authoritative hold." };
    }
    if (input.hold.workspaceId !== input.quote.workspaceId || input.hold.quoteId !== input.quote.id) {
      return { ok: false, code: "CHECKOUT_SCOPE_MISMATCH", message: "Hold and quote do not share workspace/quote scope." };
    }
    const expiry = Date.parse(input.hold.expiresAt);
    const now = Date.parse(config.now());
    if (!Number.isFinite(expiry) || !Number.isFinite(now)) {
      return { ok: false, code: "PAYMENT_HOLD_EXPIRY_INVALID",
        message: "Authoritative checkout hold timestamps are invalid." };
    }
    if (expiry <= now) {
      return { ok: false, code: "PAYMENT_HOLD_EXPIRED",
        message: "An expired checkout hold cannot create a new provider session." };
    }
  }
  if (input.purpose === "BALANCE" && (!input.invoiceId?.trim() || !Number.isInteger(input.balanceMinor) || (input.balanceMinor ?? 0) <= 0)) {
    return { ok: false, code: "PAYMENT_INVOICE_BALANCE_INVALID", message: "Balance checkout requires invoiceId and the current authoritative invoice balance." };
  }

  const successReturn = validatedCheckoutReturnUrl(input.successUrl);
  const cancelReturn = validatedCheckoutReturnUrl(input.cancelUrl);
  if (!successReturn || !cancelReturn ||
      successReturn.origin !== cancelReturn.origin) {
    return { ok: false, code: "CHECKOUT_REDIRECT_URL_INVALID",
      message: "Checkout success and cancel URLs must be safe HTTPS URLs on one approved application origin." };
  }

  const amountMinor = amountFor(input);
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    return { ok: false, code: "INVALID_CHECKOUT_AMOUNT", message: "Checkout amount must be a positive integer minor-unit value." };
  }

  const controller = new AbortController();
  const timeoutMs = Math.max(250, Math.min(config.timeoutMs ?? 10_000, 30_000));
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      authorization: `Bearer ${config.secretKey}`,
      "content-type": "application/x-www-form-urlencoded",
      "idempotency-key": `checkout:${input.quote.workspaceId}:${input.hold?.holdId ?? input.invoiceId ?? input.quote.id}:${input.purpose}`,
    };
    if (config.connectedAccountId) headers["stripe-account"] = config.connectedAccountId;

    const response = await http({
      url: `${baseUrl(config)}/v1/checkout/sessions`,
      method: "POST",
      headers,
      body: buildCheckoutBody(input, amountMinor).toString(),
      signal: controller.signal,
    });

    if (response.status < 200 || response.status >= 300) return normalizedFailure(response.status);
    const parsed = parseCheckoutResponse(response.body, config.mode);
    if (!parsed.ok) return parsed;

    return {
      ok: true,
      value: {
        provider: "STRIPE",
        providerSessionId: parsed.value.id,
        checkoutUrl: parsed.value.url,
        amountMinor,
        currency: input.quote.currency,
        mode: config.mode,
        evidence: evidence(config, parsed.value.id),
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