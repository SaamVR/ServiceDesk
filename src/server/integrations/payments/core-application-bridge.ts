import type { Result } from "../../../contracts";
import type { VerifiedPaymentApplicationOutcome, VerifiedPaymentEvent } from "../../core/facade";
import type { VerifiedPaymentWebhook } from "../types";

export type PaymentWebhookApplicationResult = "APPLIED" | "DUPLICATE" | "PAYMENT_REVIEW";

export interface CorePaymentApplicationPort {
  applyVerifiedPayment(event: VerifiedPaymentEvent): Promise<Result<VerifiedPaymentApplicationOutcome>>;
}

export interface PaymentWebhookApplicationStore {
  applyVerifiedPayment(input: VerifiedPaymentWebhook): Promise<PaymentWebhookApplicationResult>;
}

export interface PaymentWebhookApplicationReceipt {
  result: PaymentWebhookApplicationResult;
  providerEventId: string;
  providerTransactionId: string;
  attentionItemId?: string;
  invoiceId?: string;
  visitId?: string;
}

export async function applyVerifiedPaymentToCore(input: {
  webhook: VerifiedPaymentWebhook;
  core: CorePaymentApplicationPort;
}): Promise<Result<PaymentWebhookApplicationReceipt>> {
  const applied = await input.core.applyVerifiedPayment(input.webhook.event);
  if (!applied.ok) {
    return {
      ok: false,
      code: applied.code,
      message: applied.message,
    };
  }

  const outcome = applied.value;
  return {
    ok: true,
    value: {
      result: outcome.state,
      providerEventId: input.webhook.event.providerEventId,
      providerTransactionId: input.webhook.event.providerTransactionId,
      attentionItemId: outcome.attentionItemId,
      invoiceId: outcome.invoice?.id,
      visitId: outcome.visit?.id,
    },
  };
}

export function createPaymentWebhookApplicationStore(core: CorePaymentApplicationPort): PaymentWebhookApplicationStore {
  return {
    async applyVerifiedPayment(webhook: VerifiedPaymentWebhook): Promise<PaymentWebhookApplicationResult> {
      const result = await applyVerifiedPaymentToCore({ webhook, core });
      if (!result.ok) {
        throw new Error(`${result.code}: ${result.message}`);
      }
      return result.value.result;
    },
  };
}
