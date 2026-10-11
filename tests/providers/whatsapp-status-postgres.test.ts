import { describe, expect, it } from "vitest";
import { createPostgresWhatsAppDeliveryStatusStore, type WhatsAppOutboundMessage,
  type WhatsAppOutboundReceipt, type WhatsAppStatusPersistencePort, type WhatsAppStatusUpdate
} from "../../src/server/integrations/whatsapp/status-postgres";
import type { WhatsAppStatusCallbackInput } from "../../src/server/api-handlers/provider-whatsapp";

const receipt: WhatsAppOutboundReceipt = {
  id: "outbox-1", workspace_id: "ws-1", topic: "conversation.reply",
  status: "SENT", provider_reference: "wamid-controlled",
  payload: { channel: "WHATSAPP", recipient: "+15553334444" },
};
const stored: WhatsAppOutboundMessage = {
  id: "message-1", workspace_id: "ws-1", outbox_event_id: "outbox-1",
  direction: "OUTBOUND", sender_kind: "STAFF",
  delivery_state: "PROVIDER_ACCEPTED", provider_occurred_at: "2026-10-11T02:00:00.000Z",
};
const callback: WhatsAppStatusCallbackInput = {
  provider: "WHATSAPP", workspaceId: "ws-1", providerAccountId: "phone-123",
  phoneNumberId: "phone-123", providerMessageId: "wamid-controlled", providerStatus: "delivered",
  deliveryState: "DELIVERED", recipientId: "15553334444", providerTimestamp: "1791687600",
  callbackKey: "phone-123:wamid-controlled:delivered:1791687600",
  rawProviderEvent: "{}",
};

function memory(options: {
  receiptRows?: WhatsAppOutboundReceipt[];
  messageRows?: WhatsAppOutboundMessage[];
  skipWrite?: boolean;
} = {}) {
  let messages = options.messageRows ?? [{ ...stored }];
  const updates: WhatsAppStatusUpdate[] = [];
  const port: WhatsAppStatusPersistencePort = {
    async findReceipts() { return options.receiptRows ?? [receipt]; },
    async findMessages() { return messages.map(m => ({ ...m })); },
    async updateIfCurrent(change) {
      updates.push(change);
      if (options.skipWrite) return [];
      const matched = messages.filter(m => change.previousStates.includes(m.delivery_state as never) &&
        (!m.provider_occurred_at || new Date(m.provider_occurred_at).getTime() <= new Date(change.providerOccurredAt).getTime()));
      messages = messages.map(m => matched.includes(m) ? {
        ...m, delivery_state: change.deliveryState, provider_occurred_at: change.providerOccurredAt,
      } : m);
      return matched;
    },
  };
  return { port, updates, setMessage: (v: WhatsAppOutboundMessage[]) => { messages = v; } };
}

describe("PostgreSQL WhatsApp delivery callback reconciliation", () => {
  it("advances a matching SENT WhatsApp outbox + staff message and replays idempotently", async () => {
    const db = memory();
    const store = createPostgresWhatsAppDeliveryStatusStore(db.port);
    expect(await store.applyStatusCallback(callback)).toBe("APPLIED");
    expect(db.updates).toMatchObject([{
      workspaceId: "ws-1", messageId: "message-1", providerMessageId: "wamid-controlled",
      providerAccountId: "phone-123", deliveryState: "DELIVERED",
    }]);
    expect(db.updates[0].previousStates).not.toContain("READ");
    expect(await store.applyStatusCallback(callback)).toBe("DUPLICATE");
    expect(db.updates).toHaveLength(1);
  });

  it("never regresses READ to delivered or DELIVERED to failed", async () => {
    for (const [current, incoming] of [
      ["READ", "DELIVERED"], ["DELIVERED", "FAILED"],
      ["FAILED", "DELIVERED"], ["SUPPRESSED", "READ"],
    ] as const) {
      const db = memory({ messageRows: [{ ...stored, delivery_state: current }] });
      const store = createPostgresWhatsAppDeliveryStatusStore(db.port);
      const state = await store.applyStatusCallback({ ...callback,
        deliveryState: incoming,
        providerStatus: incoming === "FAILED" ? "failed" : incoming === "READ" ? "read" : "delivered" });
      expect(state).toBe("STALE_REGRESSION");
      expect(db.updates).toHaveLength(0);
    }
  });

  it("rejects delayed callbacks by provider timestamp despite higher status rank", async () => {
    const db = memory({ messageRows: [{ ...stored, delivery_state: "DELIVERED",
      provider_occurred_at: "2026-10-11T10:00:00.000Z" }] });
    const store = createPostgresWhatsAppDeliveryStatusStore(db.port);
    expect(await store.applyStatusCallback({
      ...callback, providerStatus: "read", deliveryState: "READ", providerTimestamp: "1791687600",
    })).toBe("STALE_REGRESSION");
    expect(db.updates).toHaveLength(0);
  });

  it("never acknowledges missing, ambiguous, wrong-channel or cross-tenant provider receipt", async () => {
    for (const rows of [
      [], [receipt, receipt],
      [{ ...receipt, topic: "retention.campaign" }],
      [{ ...receipt, payload: { channel: "EMAIL", recipient: "+15553334444" } }],
      [{ ...receipt, workspace_id: "ws-other" }],
      [{ ...receipt, provider_reference: "different" }],
    ]) {
      const db = memory({ receiptRows: rows });
      await expect(createPostgresWhatsAppDeliveryStatusStore(db.port).applyStatusCallback(callback))
        .rejects.toThrow();
      expect(db.updates).toHaveLength(0);
    }
  });

  it("rejects missing or mismatching recipient and unrelated inbound or foreign messages", async () => {
    for (const corrupted of [
      { ...callback, recipientId: undefined },
      { ...callback, recipientId: "15550000000" },
      { ...callback, providerAccountId: "different" },
    ]) {
      const db = memory();
      await expect(createPostgresWhatsAppDeliveryStatusStore(db.port).applyStatusCallback(corrupted))
        .rejects.toThrow();
      expect(db.updates).toHaveLength(0);
    }
    for (const corrupt of [
      { ...stored, workspace_id: "ws-other" },
      { ...stored, direction: "INBOUND" },
      { ...stored, sender_kind: "CUSTOMER" },
      { ...stored, outbox_event_id: "foreign-outbox" },
    ]) {
      const db = memory({ messageRows: [corrupt] });
      await expect(createPostgresWhatsAppDeliveryStatusStore(db.port).applyStatusCallback(callback))
        .rejects.toThrow();
      expect(db.updates).toHaveLength(0);
    }
  });

  it("reclassifies lost CAS into duplicate/stale but retries truly unresolved writes", async () => {
    const db = memory({ skipWrite: true });
    const store = createPostgresWhatsAppDeliveryStatusStore(db.port);
    await expect(store.applyStatusCallback(callback)).rejects.toThrow("WHATSAPP_STATUS_CONDITIONAL_UPDATE_UNRESOLVED");
    // A competing worker has advanced the authoritative record to READ.
    const port = {
      ...db.port,
      async updateIfCurrent(change: WhatsAppStatusUpdate) {
        db.setMessage([{ ...stored, delivery_state: "READ", provider_occurred_at: change.providerOccurredAt }]);
        return [];
      },
    };
    expect(await createPostgresWhatsAppDeliveryStatusStore(port).applyStatusCallback(callback))
      .toBe("STALE_REGRESSION");
  });

  it("never swallows durable storage exceptions as a successful Meta callback", async () => {
    const db = memory();
    const store = createPostgresWhatsAppDeliveryStatusStore({
      ...db.port, async updateIfCurrent() {
        throw new Error("database unavailable");
      },
    });
    await expect(store.applyStatusCallback(callback)).rejects.toThrow("database unavailable");
  });
});
