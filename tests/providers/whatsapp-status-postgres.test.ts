import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseWhatsAppStatusPersistence } from "../../src/server/integrations/whatsapp/status-postgres";
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
      return matched.map(m => ({
        ...m, delivery_state: change.deliveryState, provider_occurred_at: change.providerOccurredAt,
      }));
    },
  };
  return { port, updates, setMessage: (v: WhatsAppOutboundMessage[]) => { messages = v; } };
}

describe("Supabase conditional delivery persistence transport", () => {
  it("uses workspace-scoped outbox/message identities and an atomic state+timestamp CAS", async () => {
    const operations: Array<{ table: string; name: string; values: unknown[] }> = [];
    let table = "";
    let reply: unknown[] = [];
    function chain() {
      const query = {
        eq(...args: unknown[]) { operations.push({ table, name: "eq", values: args }); return this; },
        in(...args: unknown[]) { operations.push({ table, name: "in", values: args }); return this; },
        or(...args: unknown[]) { operations.push({ table, name: "or", values: args }); return this; },
        limit(...args: unknown[]) { operations.push({ table, name: "limit", values: args }); return this; },
        select(...args: unknown[]) { operations.push({ table, name: "select", values: args }); return this; },
        then(resolve: (input: unknown) => unknown) { return Promise.resolve(resolve({ data: reply, error: null })); },
      };
      return query;
    }
    const client = {
      from(name: string) {
        table = name;
        return {
          select(columns: string) {
            operations.push({ table, name: "select", values: [columns] });
            return chain();
          },
          update(patch: unknown) {
            operations.push({ table, name: "update", values: [patch] });
            return chain();
          },
        };
      },
    } as unknown as SupabaseClient;
    const db = createSupabaseWhatsAppStatusPersistence(client);
    reply = [receipt];
    expect(await db.findReceipts("ws-1", "wamid-controlled")).toEqual([receipt]);
    reply = [stored];
    expect(await db.findMessages("ws-1", "outbox-1")).toEqual([stored]);
    reply = [{ ...stored, delivery_state: "READ", provider_occurred_at: "2026-10-11T04:00:00.000Z" }];
    await db.updateIfCurrent({
      workspaceId: "ws-1", messageId: "message-1",
      previousStates: ["QUEUED", "DELIVERED"], deliveryState: "READ",
      providerMessageId: "wamid-controlled", providerAccountId: "phone-123",
      providerOccurredAt: "2026-10-11T04:00:00.000Z",
    });
    const update = operations.find(o => o.name === "update");
    expect(update?.values[0]).toMatchObject({
      delivery_state: "READ", provider_message_id: "wamid-controlled",
      provider_account_id: "phone-123",
    });
    expect(operations.some(o => o.name === "in" &&
      o.values[0] === "delivery_state")).toBe(true);
    expect(operations.some(o => o.name === "or" &&
      String(o.values[0]).includes("provider_occurred_at.lte.2026-10-11T04:00:00.000Z"))).toBe(true);
    expect(operations.some(o => o.name === "eq" &&
      o.values[0] === "workspace_id" && o.values[1] === "ws-1")).toBe(true);
  });
});

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
