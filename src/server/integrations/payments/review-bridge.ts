import type { Result } from "../../../contracts";
import {
  classifyPaymentReview,
  enqueuePaymentReview,
  type PaymentApplicationResult,
  type PaymentReviewClassificationInput,
  type PaymentReviewItem,
  type PaymentReviewStore,
} from "./review";

export type PaymentReviewRouteStore = PaymentReviewStore;

export interface PaymentReviewRouteInput extends PaymentReviewClassificationInput {
  store: PaymentReviewRouteStore;
}

export interface PaymentReviewRouteReceipt {
  reviewId: string;
  state: "INSERTED" | "DUPLICATE";
  reason: PaymentReviewItem["reason"];
  dedupeKey: string;
  providerEventId: string;
  providerTransactionRef: string;
  canMutateBusinessTruth: false;
  applicationResult: PaymentApplicationResult;
}

export async function routePaymentWebhookToReview(input: PaymentReviewRouteInput): Promise<Result<PaymentReviewRouteReceipt>> {
  const item = classifyPaymentReview(input);
  try {
    const persisted = await enqueuePaymentReview(input.store, item);
    return {
      ok: true,
      value: {
        reviewId: persisted.reviewId,
        state: persisted.state,
        reason: item.reason,
        dedupeKey: item.dedupeKey,
        providerEventId: item.providerEventId,
        providerTransactionRef: item.providerTransactionRef,
        canMutateBusinessTruth: false,
        applicationResult: input.applicationResult,
      },
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown review enqueue error";
    return { ok: false, code: "PAYMENT_REVIEW_ENQUEUE_FAILED", message: `Payment review enqueue failed: ${detail}` };
  }
}
