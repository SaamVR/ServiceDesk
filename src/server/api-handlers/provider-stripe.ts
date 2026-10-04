import type { Result } from "../../contracts";
import type { PaymentAdapter, VerifiedPaymentWebhook } from "../integrations/types";

export interface StripeProviderHandlerResult {
  statusCode: number;
  body?: string;
  acknowledged: boolean;
  retryable: boolean;
}

export type PaymentWebhookApplicationResult = "APPLIED" | "DUPLICATE" | "OUT_OF_ORDER_IGNORED" | "PAYMENT_REVIEW";

export interface PaymentWebhookApplicationStore {
  applyVerifiedPayment(input: VerifiedPaymentWebhook): Promise<PaymentWebhookApplicationResult>;
}

export interface StripePaymentWebhookHandlerInput {
  rawBody: string;
  headers: Record<string, string | undefined>;
  adapter: PaymentAdapter;
  store: PaymentWebhookApplicationStore;
}

function resultToStatus(result: Exclude<Result<VerifiedPaymentWebhook>, { ok: true }>): StripeProviderHandlerResult {
  const signatureFailure =
    result.code === "MISSING_SIGNATURE"
    || result.code === "SIGNATURE_MISMATCH"
    || result.code === "MALFORMED_SIGNATURE"
    || result.code === "SIGNATURE_TIMESTAMP_OUT_OF_TOLERANCE";
  const statusCode = signatureFailure ? 400 : 422;
  return {
    statusCode,
    body: result.message,
    acknowledged: false,
    retryable: false,
  };
}

export async function handleStripePaymentWebhook(input: StripePaymentWebhookHandlerInput): Promise<StripeProviderHandlerResult> {
  const verified = await input.adapter.verifyWebhook(input.rawBody, input.headers);
  if (!verified.ok) return resultToStatus(verified);
  const webhook = verified.value;

  try {
    const applicationResult = await input.store.applyVerifiedPayment(webhook);
    return {
      statusCode: 200,
      body: JSON.stringify({
        result: applicationResult,
        providerEventId: webhook.event.providerEventId,
        providerTransactionId: webhook.event.providerTransactionId,
      }),
      acknowledged: true,
      retryable: false,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown payment application error";
    return {
      statusCode: 503,
      body: `Verified payment could not be durably applied: ${detail}`,
      acknowledged: false,
      retryable: true,
    };
  }
}
