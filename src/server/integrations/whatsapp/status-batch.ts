import { decideWhatsAppStatusTransition, type WhatsAppDeliverySnapshot } from "./status-transition";

export interface WhatsAppStatusBatchSummary {
  received: number;
  applied: number;
  duplicate: number;
  stale: number;
  failed: number;
}

export interface WhatsAppStatusApplicationStore {
  loadCurrent(snapshot: WhatsAppDeliverySnapshot): Promise<WhatsAppDeliverySnapshot | undefined>;
  apply(snapshot: WhatsAppDeliverySnapshot): Promise<void>;
}

export interface ApplyWhatsAppStatusBatchInput {
  callbacks: WhatsAppDeliverySnapshot[];
  store: WhatsAppStatusApplicationStore;
}

export async function applyWhatsAppStatusBatch(input: ApplyWhatsAppStatusBatchInput): Promise<WhatsAppStatusBatchSummary> {
  const summary: WhatsAppStatusBatchSummary = {
    received: input.callbacks.length,
    applied: 0,
    duplicate: 0,
    stale: 0,
    failed: 0,
  };

  for (const callback of input.callbacks) {
    const current = await input.store.loadCurrent(callback);
    const decision = decideWhatsAppStatusTransition(current, callback);

    if (decision.result === "DUPLICATE") {
      summary.duplicate += 1;
      continue;
    }

    if (decision.result === "STALE_REGRESSION") {
      summary.stale += 1;
      continue;
    }

    await input.store.apply({
      ...callback,
      deliveryState: decision.nextState,
    });
    summary.applied += 1;
    if (decision.nextState === "FAILED") summary.failed += 1;
  }

  return summary;
}
