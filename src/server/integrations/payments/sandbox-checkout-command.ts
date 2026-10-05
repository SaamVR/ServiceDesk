import type { QuoteDTO, Result } from "../../../contracts";
import type { CheckoutSession, ProviderMode, RedactedProviderEvidence } from "../types";
import { createStripeCheckoutSession, type StripeCheckoutHttpTransport, type StripeCheckoutTransportConfig } from "./checkout-transport";

export type SandboxCheckoutPurpose = "DEPOSIT" | "BALANCE";

export interface AuthoritativeCheckoutHold {
  holdId: string;
  workspaceId: string;
  quoteId: string;
  expiresAt: string;
}

export interface SandboxCheckoutCommand {
  quote: QuoteDTO;
  hold?: AuthoritativeCheckoutHold;
  purpose: SandboxCheckoutPurpose;
  invoiceId?: string;
  balanceMinor?: number;
  successUrl: string;
  cancelUrl: string;
  requestedMode?: ProviderMode;
}

export interface ProductSafeSandboxCheckout {
  providerSessionId: string;
  checkoutUrl: string;
  amountMinor: number;
  currency: string;
  mode: "SANDBOX";
  evidence: RedactedProviderEvidence;
  businessTruthMutation: false;
}

export interface SandboxCheckoutProviderResolution {
  config: StripeCheckoutTransportConfig & { mode: "SANDBOX" };
  http: StripeCheckoutHttpTransport;
}

export interface SandboxCheckoutProviderConfigResolver {
  resolve(input: { workspaceId: string; quoteId: string; purpose: SandboxCheckoutPurpose }): Promise<Result<SandboxCheckoutProviderResolution>>;
}

export interface SandboxCheckoutCommandHandler {
  execute(command: SandboxCheckoutCommand): Promise<Result<ProductSafeSandboxCheckout>>;
}

const secretLike = /(sk_live_|sk_test_|whsec_|Bearer\s+|access_token|refresh_token|client_secret|api[_-]?key\s*[:=]|signing[_-]?secret\s*[:=]|authorization\s*[:=])/i;

function isHttpsProductRedirect(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function amountFor(command: SandboxCheckoutCommand): number {
  return command.purpose === "DEPOSIT" ? command.quote.depositMinor : (command.balanceMinor ?? 0);
}

function validateCommand(command: SandboxCheckoutCommand, now: string): Result<true> {
  if (command.requestedMode && command.requestedMode !== "SANDBOX") {
    return { ok: false, code: "PAYMENT_LIVE_MODE_REJECTED", message: "V1 checkout is Stripe-style SANDBOX/DEMO only." };
  }
  if (command.purpose !== "DEPOSIT" && command.purpose !== "BALANCE") {
    return { ok: false, code: "PAYMENT_PURPOSE_INVALID", message: "Only DEPOSIT and BALANCE checkout purposes are supported by the Product-facing boundary." };
  }
  if (command.purpose === "DEPOSIT") {
    if (!command.hold) {
      return { ok: false, code: "PAYMENT_HOLD_REFERENCE_MISSING", message: "Deposit checkout requires an authoritative active hold." };
    }
    if (command.hold.workspaceId !== command.quote.workspaceId || command.hold.quoteId !== command.quote.id) {
      return { ok: false, code: "CHECKOUT_SCOPE_MISMATCH", message: "Authoritative hold and quote scope do not match." };
    }
    if (command.quote.status !== "ACCEPTED") {
      return { ok: false, code: "QUOTE_NOT_ACCEPTED", message: "Deposit checkout requires an ACCEPTED quote." };
    }
    const expiresAt = new Date(command.hold.expiresAt).getTime();
    const nowMs = new Date(now).getTime();
    if (!Number.isFinite(expiresAt) || !Number.isFinite(nowMs)) {
      return { ok: false, code: "PAYMENT_HOLD_EXPIRY_INVALID", message: "Checkout hold expiry timestamp is invalid." };
    }
    if (expiresAt <= nowMs) {
      return { ok: false, code: "PAYMENT_HOLD_EXPIRED", message: "Checkout hold has expired." };
    }
  }
  if (command.purpose === "BALANCE") {
    if (!command.invoiceId?.trim()) {
      return { ok: false, code: "PAYMENT_INVOICE_REFERENCE_MISSING", message: "Balance checkout requires an authoritative invoiceId." };
    }
    if (!Number.isInteger(command.balanceMinor) || (command.balanceMinor ?? 0) <= 0) {
      return { ok: false, code: "PAYMENT_INVOICE_BALANCE_INVALID", message: "Balance checkout requires the current authoritative invoice balance." };
    }
  }
  if (!isHttpsProductRedirect(command.successUrl) || !isHttpsProductRedirect(command.cancelUrl)) {
    return { ok: false, code: "CHECKOUT_REDIRECT_URL_INVALID", message: "Checkout redirect URLs must be HTTPS and must not contain embedded credentials." };
  }
  if (!/^[A-Z]{3}$/.test(command.quote.currency)) {
    return { ok: false, code: "PAYMENT_CURRENCY_INVALID", message: "Quote currency must be a three-letter uppercase currency code." };
  }
  const amountMinor = amountFor(command);
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    return { ok: false, code: "INVALID_CHECKOUT_AMOUNT", message: "Checkout amount must come from authoritative quote/invoice state and be a positive integer minor-unit value." };
  }
  return { ok: true, value: true };
}

function sanitizeEvidence(evidence: RedactedProviderEvidence): Result<RedactedProviderEvidence> {
  if (secretLike.test(JSON.stringify(evidence))) {
    return { ok: false, code: "PAYMENT_EVIDENCE_SECRET_LEAK", message: "Checkout evidence contains secret-like material." };
  }
  return {
    ok: true,
    value: {
      provider: evidence.provider,
      mode: "SANDBOX",
      verification: evidence.verification,
      capturedAt: evidence.capturedAt,
      controlledId: evidence.controlledId,
      redactedReceipt: evidence.redactedReceipt,
      notes: evidence.notes,
    },
  };
}

function toCheckoutInput(command: SandboxCheckoutCommand) {
  return {
    ...(command.hold ? { hold: command.hold } : {}),
    quote: command.quote,
    purpose: command.purpose,
    successUrl: command.successUrl,
    cancelUrl: command.cancelUrl,
    ...(command.invoiceId ? { invoiceId: command.invoiceId } : {}),
    ...(command.balanceMinor !== undefined ? { balanceMinor: command.balanceMinor } : {}),
  };
}

export function createSandboxCheckoutCommandHandler(deps: {
  configResolver: SandboxCheckoutProviderConfigResolver;
  now?: () => string;
}): SandboxCheckoutCommandHandler {
  return {
    async execute(command: SandboxCheckoutCommand): Promise<Result<ProductSafeSandboxCheckout>> {
      const now = deps.now?.() ?? new Date().toISOString();
      const valid = validateCommand(command, now);
      if (!valid.ok) return valid;

      const resolved = await deps.configResolver.resolve({ workspaceId: command.quote.workspaceId, quoteId: command.quote.id, purpose: command.purpose });
      if (!resolved.ok) return resolved;
      if (resolved.value.config.mode !== "SANDBOX") {
        return { ok: false, code: "PAYMENT_LIVE_MODE_REJECTED", message: "V1 checkout command rejects LIVE payment mode under current owner policy." };
      }

      const checkout = await createStripeCheckoutSession(toCheckoutInput(command), resolved.value.config, resolved.value.http);
      if (!checkout.ok) return checkout;
      if (checkout.value.mode !== "SANDBOX") {
        return { ok: false, code: "PAYMENT_LIVE_MODE_REJECTED", message: "Payment adapter returned non-sandbox checkout mode." };
      }

      const evidence = sanitizeEvidence(checkout.value.evidence);
      if (!evidence.ok) return evidence;
      return {
        ok: true,
        value: {
          providerSessionId: checkout.value.providerSessionId,
          checkoutUrl: checkout.value.checkoutUrl,
          amountMinor: checkout.value.amountMinor,
          currency: checkout.value.currency,
          mode: "SANDBOX",
          evidence: evidence.value,
          businessTruthMutation: false,
        },
      };
    },
  };
}

export function buildSandboxCheckoutProductResponse(session: CheckoutSession): Result<ProductSafeSandboxCheckout> {
  if (session.mode !== "SANDBOX") {
    return { ok: false, code: "PAYMENT_LIVE_MODE_REJECTED", message: "Only sandbox checkout sessions may be exposed to Product in V1." };
  }
  const evidence = sanitizeEvidence(session.evidence);
  if (!evidence.ok) return evidence;
  return {
    ok: true,
    value: {
      providerSessionId: session.providerSessionId,
      checkoutUrl: session.checkoutUrl,
      amountMinor: session.amountMinor,
      currency: session.currency,
      mode: "SANDBOX",
      evidence: evidence.value,
      businessTruthMutation: false,
    },
  };
}

export function buildSandboxCheckoutPreflight(input: {
  quoteAccepted: boolean;
  activeHold: boolean;
  sandboxCheckoutCommandAvailable: boolean;
  webhookCoreBridgeAvailable: boolean;
  mode: ProviderMode;
}) {
  const blockers: string[] = [];
  if (!input.quoteAccepted) blockers.push("QUOTE_ACCEPTED_REQUIRED");
  if (!input.activeHold) blockers.push("AUTHORITATIVE_ACTIVE_HOLD_REQUIRED");
  if (!input.sandboxCheckoutCommandAvailable) blockers.push("SANDBOX_CHECKOUT_COMMAND_REQUIRED");
  if (!input.webhookCoreBridgeAvailable) blockers.push("VERIFIED_WEBHOOK_CORE_BRIDGE_REQUIRED");
  if (input.mode !== "SANDBOX") blockers.push("LIVE_MODE_REJECTED_BY_OWNER_POLICY");
  return {
    provider: "PAYMENT" as const,
    operation: "stripe_sandbox_checkout" as const,
    mode: "SANDBOX" as const,
    contractEvidenceOnly: true,
    providerVerifiedClaim: false,
    pass: blockers.length === 0,
    blockers,
  };
}
