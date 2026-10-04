import type { Result } from "../../../contracts";

export type SupportedPaymentPurpose = "DEPOSIT" | "BALANCE" | "PLATFORM_SUBSCRIPTION";

export type StripePaymentLifecycleEventType =
  | "checkout.session.completed"
  | "payment_intent.succeeded"
  | "payment_intent.payment_failed"
  | "checkout.session.expired";

export type PaymentLifecycleAction = "APPLY_VERIFIED_PAYMENT" | "PAYMENT_FAILED_REVIEW" | "CHECKOUT_EXPIRED_REVIEW";

export interface StripePaymentLifecyclePayload {
  id: string;
  account: string;
  type: StripePaymentLifecycleEventType;
  created: number;
  data: {
    object: {
      id: string;
      amount_total?: number;
      amount_received?: number;
      currency: string;
      payment_intent?: string;
      metadata?: Record<string, string | undefined>;
    };
  };
}

export interface PaymentLifecycleDecision {
  provider: "STRIPE";
  providerAccountId: string;
  providerEventId: string;
  providerTransactionId: string;
  eventType: StripePaymentLifecycleEventType;
  action: PaymentLifecycleAction;
  workspaceId: string;
  purpose: SupportedPaymentPurpose;
  amountMinor: number;
  currency: string;
  occurredAt: string;
  terminal: boolean;
  canMutateBusinessTruth: false;
  reasonCodes: string[];
}

function isSupportedPurpose(value: unknown): value is SupportedPaymentPurpose {
  return value === "DEPOSIT" || value === "BALANCE" || value === "PLATFORM_SUBSCRIPTION";
}

function actionForType(type: StripePaymentLifecycleEventType): PaymentLifecycleAction {
  if (type === "checkout.session.completed" || type === "payment_intent.succeeded") return "APPLY_VERIFIED_PAYMENT";
  if (type === "payment_intent.payment_failed") return "PAYMENT_FAILED_REVIEW";
  return "CHECKOUT_EXPIRED_REVIEW";
}

function transactionId(payload: StripePaymentLifecyclePayload): string | undefined {
  const object = payload.data.object;
  if (typeof object.payment_intent === "string" && object.payment_intent.trim()) return object.payment_intent;
  if (payload.type === "payment_intent.succeeded" || payload.type === "payment_intent.payment_failed") return object.id;
  return object.id;
}

export function classifyStripePaymentLifecycle(
  payload: StripePaymentLifecyclePayload,
  expectedProviderAccountId: string,
): Result<PaymentLifecycleDecision> {
  if (payload.account !== expectedProviderAccountId) {
    return { ok: false, code: "PAYMENT_ACCOUNT_MISMATCH", message: "Payment event account does not match configured provider account." };
  }

  const object = payload.data.object;
  const metadata = object.metadata ?? {};
  const amountMinor = object.amount_total ?? object.amount_received;
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    return { ok: false, code: "PAYMENT_AMOUNT_INVALID", message: "Payment lifecycle event is missing a positive integer amount." };
  }

  if (!metadata.workspaceId) {
    return { ok: false, code: "PAYMENT_METADATA_MISSING", message: "Payment lifecycle event is missing workspace metadata." };
  }

  if (!isSupportedPurpose(metadata.purpose)) {
    return { ok: false, code: "PAYMENT_PURPOSE_INVALID", message: "Payment lifecycle event purpose is not supported by V1." };
  }

  const providerTransactionId = transactionId(payload);
  if (!providerTransactionId) {
    return { ok: false, code: "PAYMENT_TRANSACTION_MISSING", message: "Payment lifecycle event is missing a transaction reference." };
  }

  const action = actionForType(payload.type);
  return {
    ok: true,
    value: {
      provider: "STRIPE",
      providerAccountId: payload.account,
      providerEventId: payload.id,
      providerTransactionId,
      eventType: payload.type,
      action,
      workspaceId: metadata.workspaceId,
      purpose: metadata.purpose,
      amountMinor,
      currency: object.currency.toUpperCase(),
      occurredAt: new Date(payload.created * 1000).toISOString(),
      terminal: action !== "APPLY_VERIFIED_PAYMENT",
      canMutateBusinessTruth: false,
      reasonCodes: [action],
    },
  };
}
