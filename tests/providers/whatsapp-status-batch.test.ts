import { describe, expect, test } from "vitest";
import {
  applyWhatsAppStatusBatch,
  type WhatsAppStatusApplicationStore,
} from "../../src/server/integrations/whatsapp/status-batch";
import type { WhatsAppDeliverySnapshot } from "../../src/server/integrations/whatsapp/status-transition";

function incoming(deliveryState: WhatsAppDeliverySnapshot["deliveryState"], timestamp: string, label = deliveryState.toLowerCase()): WhatsAppDeliverySnapshot {
  return {
    deliveryState,
    providerTimestamp: timestamp,
    callbackKey: `phone-1:wamid-1:${label}:${timestamp}`,
  };
}

class Store implements WhatsAppStatusApplicationStore {
  current: WhatsAppDeliverySnapshot | undefined;
  readonly applied: WhatsAppDeliverySnapshot[] = [];

  async loadCurrent() {
    return this.current;
  }

  async apply(snapshot: WhatsAppDeliverySnapshot) {
    this.current = snapshot;
    this.applied.push(snapshot);
  }
}

describe("WhatsApp status batch application", () => {
  test("applies forward progress while summarizing duplicate and stale callbacks", async () => {
    const store = new Store();
    store.current = incoming("DELIVERED", "1791108100");

    const summary = await applyWhatsAppStatusBatch({
      callbacks: [
        incoming("READ", "1791108200"),
        incoming("READ", "1791108200"),
        incoming("DELIVERED", "1791108100"),
        incoming("PROVIDER_ACCEPTED", "1791108300"),
        incoming("FAILED", "1791108400"),
      ],
      store,
    });

    expect(summary).toEqual({ received: 5, applied: 1, duplicate: 1, stale: 3, failed: 0 });
    expect(store.applied.map((snapshot) => snapshot.deliveryState)).toEqual(["READ"]);
  });

  test("counts failed callback as applied failure before confirmed delivery", async () => {
    const store = new Store();
    store.current = incoming("PROVIDER_ACCEPTED", "1791108000", "sent");

    const summary = await applyWhatsAppStatusBatch({ callbacks: [incoming("FAILED", "1791108100")], store });

    expect(summary).toEqual({ received: 1, applied: 1, duplicate: 0, stale: 0, failed: 1 });
    expect(store.current?.deliveryState).toBe("FAILED");
  });

  test("does not apply later non-failed callbacks after terminal failed", async () => {
    const store = new Store();
    const failed = incoming("FAILED", "1791108300");
    store.current = failed;

    const summary = await applyWhatsAppStatusBatch({
      callbacks: [
        incoming("PROVIDER_ACCEPTED", "1791108400", "sent-late"),
        incoming("DELIVERED", "1791108500", "delivered-late"),
        incoming("READ", "1791108600", "read-late"),
        failed,
      ],
      store,
    });

    expect(summary).toEqual({ received: 4, applied: 0, duplicate: 1, stale: 3, failed: 0 });
    expect(store.current).toEqual(failed);
    expect(store.applied).toEqual([]);
  });
});
