import type { Result } from "../../contracts";
import { routePaymentWebhookToReview, type PaymentReviewRouteStore } from "../integrations/payments/review-bridge";
import type { PaymentWebhookApplicationResult, PaymentWebhookApplicationStore } from "../integrations/payments/core-application-bridge";
import type { PaymentAdapter, VerifiedPaymentWebhook } from "../integrations/types";

export interface StripeProviderHandlerResult {
  statusCode: number;
  body?: string;
  acknowledged: boolean;
  retryable: boolean;
}

export type { PaymentWebhookApplicationResult, PaymentWebhookApplicationStore };

export interface PaymentWebhookReviewRouteConfig {
  store: PaymentReviewRouteStore;
  expectedWorkspaceId?: string;
  expectedCurrency?: string;
  expectedAmountMinor?: number;
  expectedProviderAccountId?: string;
  expectedPurpose?: VerifiedPaymentWebhook["event"]["purpose"];
  holdExpiresAt?: string;
}

export interface StripePaymentWebhookHandlerInput {
  rawBody: string;
  headers: Record<string, string | undefined>;
  adapter: PaymentAdapter;
  store: PaymentWebhookApplicationStore;
  review?: PaymentWebhookReviewRouteConfig;
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

function retryableFailure(body: string): StripeProviderHandlerResult {
  return {
    statusCode: 503,
    body,
    acknowledged: false,
    retryable: true,
  };
}

async function routeReviewOrRetry(webhook: VerifiedPaymentWebhook, review: PaymentWebhookReviewRouteConfig | undefined): Promise<StripeProviderHandlerResult> {
  if (!review) {
    return retryableFailure("Verified payment requested review but no durable payment-review store was configured.");
  }

  const routed = await routePaymentWebhookToReview({
    store: review.store,
    webhook,
    applicationResult: "PAYMENT_REVIEW",
    expectedWorkspaceId: review.expectedWorkspaceId ?? webhook.event.workspaceId,
    expectedCurrency: review.expectedCurrency ?? webhook.event.currency,
    expectedAmountMinor: review.expectedAmountMinor ?? webhook.event.amountMinor,
    expectedProviderAccountId: review.expectedProviderAccountId ?? webhook.event.providerAccountId,
    expectedPurpose: review.expectedPurpose ?? webhook.event.purpose,
    holdExpiresAt: review.holdExpiresAt,
  });

  if (!routed.ok) {
    return retryableFailure(`${routed.code}: ${routed.message}`);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      result: "PAYMENT_REVIEW",
      providerEventId: webhook.event.providerEventId,
      providerTransactionId: webhook.event.providerTransactionId,
      reviewId: routed.value.reviewId,
      reviewState: routed.value.state,
      reviewReason: routed.value.reason,
    }),
    acknowledged: true,
    retryable: false,
  };
}

export async function handleStripePaymentWebhook(input: StripePaymentWebhookHandlerInput): Promise<StripeProviderHandlerResult> {
  const verified = await input.adapter.verifyWebhook(input.rawBody, input.headers);
  if (!verified.ok) return resultToStatus(verified);
  const webhook = verified.value;

  try {
    const applicationResult = await input.store.applyVerifiedPayment(webhook);
    if (applicationResult === "PAYMENT_REVIEW") {
      return await routeReviewOrRetry(webhook, input.review);
    }

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
    return retryableFailure(`Verified payment could not be durably applied: ${detail}`);
  }
}
