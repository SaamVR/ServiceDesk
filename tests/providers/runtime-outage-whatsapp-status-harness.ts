import assert from "node:assert/strict";
import { applyWhatsAppStatusBatch, type WhatsAppStatusApplicationStore } from "../../src/server/integrations/whatsapp/status-batch";
import { decideWhatsAppStatusTransition, type WhatsAppDeliverySnapshot } from "../../src/server/integrations/whatsapp/status-transition";

function snapshot(deliveryState: WhatsAppDeliverySnapshot["deliveryState"], timestamp: string, suffix = deliveryState.toLowerCase()): WhatsAppDeliverySnapshot {
  return {
    deliveryState,
    providerTimestamp: timestamp,
    callbackKey: `phone-1:wamid-1:${suffix}:${timestamp}`,
  };
}

class Store implements WhatsAppStatusApplicationStore {
  current: WhatsAppDeliverySnapshot | undefined;
  readonly applied: WhatsAppDeliverySnapshot[] = [];

  async loadCurrent(): Promise<WhatsAppDeliverySnapshot | undefined> {
    return this.current;
  }

  async apply(next: WhatsAppDeliverySnapshot): Promise<void> {
    this.current = next;
    this.applied.push(next);
  }
}

const accepted = snapshot("PROVIDER_ACCEPTED", "1791108000", "sent");
const delivered = snapshot("DELIVERED", "1791108100");
const read = snapshot("READ", "1791108200");
const failed = snapshot("FAILED", "1791108300");

async function main(): Promise<void> {
  assert.deepEqual(decideWhatsAppStatusTransition(undefined, accepted), {
    result: "APPLY",
    nextState: "PROVIDER_ACCEPTED",
    reason: "FIRST_STATUS",
  });
  assert.deepEqual(decideWhatsAppStatusTransition(accepted, delivered), {
    result: "APPLY",
    nextState: "DELIVERED",
    reason: "FORWARD_PROGRESS",
  });
  assert.deepEqual(decideWhatsAppStatusTransition(delivered, read), {
    result: "APPLY",
    nextState: "READ",
    reason: "FORWARD_PROGRESS",
  });
  assert.deepEqual(decideWhatsAppStatusTransition(delivered, delivered), {
    result: "DUPLICATE",
    nextState: "DELIVERED",
    reason: "SAME_CALLBACK_KEY",
  });
  assert.deepEqual(decideWhatsAppStatusTransition(delivered, snapshot("READ", "1791107000")), {
    result: "STALE_REGRESSION",
    nextState: "DELIVERED",
    reason: "OLDER_PROVIDER_TIMESTAMP",
  });
  assert.deepEqual(decideWhatsAppStatusTransition(accepted, failed), {
    result: "APPLY",
    nextState: "FAILED",
    reason: "FAILURE_BEFORE_CONFIRMED_DELIVERY",
  });
  for (const next of [
    snapshot("PROVIDER_ACCEPTED", "1791108400", "sent-late"),
    snapshot("DELIVERED", "1791108500", "delivered-late"),
    snapshot("READ", "1791108600", "read-late"),
  ]) {
    assert.deepEqual(decideWhatsAppStatusTransition(failed, next), {
      result: "STALE_REGRESSION",
      nextState: "FAILED",
      reason: "STATUS_AFTER_TERMINAL_FAILURE",
    });
  }
  assert.deepEqual(decideWhatsAppStatusTransition(failed, failed), {
    result: "DUPLICATE",
    nextState: "FAILED",
    reason: "SAME_CALLBACK_KEY",
  });
  assert.deepEqual(decideWhatsAppStatusTransition(read, snapshot("FAILED", "1791108700")), {
    result: "STALE_REGRESSION",
    nextState: "READ",
    reason: "FAILED_AFTER_CONFIRMED_DELIVERY",
  });

  const store = new Store();
  store.current = accepted;
  const failedSummary = await applyWhatsAppStatusBatch({ callbacks: [failed], store });
  assert.deepEqual(failedSummary, { received: 1, applied: 1, duplicate: 0, stale: 0, failed: 1 });
  assert.equal(store.current?.deliveryState, "FAILED");
  assert.equal(store.applied.length, 1);

  const afterFailureSummary = await applyWhatsAppStatusBatch({
    callbacks: [
      snapshot("PROVIDER_ACCEPTED", "1791108400", "sent-late"),
      snapshot("DELIVERED", "1791108500", "delivered-late"),
      snapshot("READ", "1791108600", "read-late"),
      failed,
    ],
    store,
  });
  assert.deepEqual(afterFailureSummary, { received: 4, applied: 0, duplicate: 1, stale: 3, failed: 0 });
  assert.equal(store.current?.deliveryState, "FAILED");
  assert.equal(store.applied.length, 1);

  console.log("runtime-outage-whatsapp-status-harness PASS");
}

void main();
