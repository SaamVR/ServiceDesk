import { describe, expect, test } from "vitest";
import {
  createSupabaseWhatsAppProviderReceiptGateway,
  createWhatsAppProviderReceiptStore,
  toWhatsAppProviderInboundReceiptRow,
  type SupabaseProviderInboundReceiptClient,
  type SupabaseProviderInboundReceiptRow,
  type WhatsAppProviderInboundReceiptGateway,
  type WhatsAppProviderInboundReceiptRow,
} from "../../src/server/integrations/whatsapp/provider-receipt-store";
import type { DurableWhatsAppInboxRecord } from "../../src/server/integrations/whatsapp/inbox-persistence";

const record: DurableWhatsAppInboxRecord = {
  provider: "WHATSAPP",
  workspaceId: "ws-1",
  providerAccountId: "phone-1",
  phoneNumberId: "phone-1",
  providerMessageId: "wamid-1",
  receiptKey: "ws-1:phone-1:wamid-1",
  senderRef: "15551234567",
  providerTimestamp: "1791110400",
  channel: "WHATSAPP",
  contentKind: "TEXT",
  text: "hello",
  rawPayloadIncluded: false,
  aiAuthoritative: false,
  rawProviderEventRef: "whatsapp_raw:ws-1:phone-1:abc",
};

class FakeSupabaseClient implements SupabaseProviderInboundReceiptClient {
  rows: SupabaseProviderInboundReceiptRow[] = [];

  from() {
    const client = this;
    const filters: Record<string, string> = {};
    return {
      insert(row: SupabaseProviderInboundReceiptRow) {
        return {
          select() {
            return {
              async maybeSingle() {
                if (client.rows.some((existing) => existing.receipt_key === row.receipt_key || (existing.provider === row.provider && existing.provider_account_id === row.provider_account_id && existing.provider_message_id === row.provider_message_id))) {
                  return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
                }
                client.rows.push(row);
                return { data: row, error: null };
              },
            };
          },
        };
      },
      select() {
        return {
          eq(column: string, value: string) {
            filters[column] = value;
            return this;
          },
          async maybeSingle() {
            const row = client.rows.find((candidate) => Object.entries(filters).every(([key, value]) => (candidate as unknown as Record<string, unknown>)[key] === value));
            return { data: row ?? null, error: null };
          },
        };
      },
    };
  }
}

describe("WhatsApp provider receipt store", () => {
  test("persists only canonical technical receipt fields and deterministic duplicate outcome", async () => {
    const rows: WhatsAppProviderInboundReceiptRow[] = [];
    const gateway: WhatsAppProviderInboundReceiptGateway = {
      async insertReceipt(row) {
        expect(row).not.toHaveProperty("rawBody");
        expect(row).not.toHaveProperty("text");
        expect(row).not.toHaveProperty("mediaProvider");
        expect(row).not.toHaveProperty("mediaProviderMediaId");
        expect(row).not.toHaveProperty("rawPayloadIncluded");
        expect(row).not.toHaveProperty("aiAuthoritative");
        if (rows.some((existing) => existing.receiptKey === row.receiptKey)) return "DUPLICATE";
        rows.push(row);
        return "INSERTED";
      },
    };

    const store = createWhatsAppProviderReceiptStore(gateway);
    await expect(store.persist(record)).resolves.toBe("INSERTED");
    await expect(store.persist(record)).resolves.toBe("DUPLICATE");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      receiptKey: "ws-1:phone-1:wamid-1",
      workspaceId: "ws-1",
      provider: "WHATSAPP",
      providerAccountId: "phone-1",
      providerMessageId: "wamid-1",
      senderRef: "15551234567",
      providerOccurredAt: "2026-10-04T10:40:00.000Z",
      rawProviderEventRef: "whatsapp_raw:ws-1:phone-1:abc",
      contentKind: "TEXT",
    });
  });

  test("fails closed on wrong provider identity and malformed timestamp", () => {
    expect(() => toWhatsAppProviderInboundReceiptRow({ ...record, provider: "EMAIL" as never })).toThrow("WHATSAPP_RECEIPT_IDENTITY_MISMATCH");
    expect(() => toWhatsAppProviderInboundReceiptRow({ ...record, providerTimestamp: "not-a-time" })).toThrow("PROVIDER_TIMESTAMP_INVALID");
  });

  test("Supabase receipt gateway inserts then detects deterministic duplicate without raw payload", async () => {
    const client = new FakeSupabaseClient();
    const gateway = createSupabaseWhatsAppProviderReceiptGateway(client);
    const row = toWhatsAppProviderInboundReceiptRow(record);

    await expect(gateway.insertReceipt(row)).resolves.toBe("INSERTED");
    await expect(gateway.insertReceipt(row)).resolves.toBe("DUPLICATE");
    expect(client.rows).toHaveLength(1);
    expect(Object.keys(client.rows[0]).sort()).toEqual([
      "content_kind",
      "provider",
      "provider_account_id",
      "provider_message_id",
      "provider_occurred_at",
      "raw_provider_event_ref",
      "receipt_key",
      "sender_ref",
      "workspace_id",
    ].sort());
  });

  test("Supabase duplicate identity mismatch fails closed", async () => {
    const client = new FakeSupabaseClient();
    client.rows.push({
      receipt_key: record.receiptKey,
      workspace_id: "other-workspace",
      provider: "WHATSAPP",
      provider_account_id: record.providerAccountId,
      provider_message_id: record.providerMessageId,
      sender_ref: record.senderRef,
      provider_occurred_at: "2026-10-04T10:40:00.000Z",
      raw_provider_event_ref: record.rawProviderEventRef,
      content_kind: record.contentKind,
    });
    const gateway = createSupabaseWhatsAppProviderReceiptGateway(client);
    await expect(gateway.insertReceipt(toWhatsAppProviderInboundReceiptRow(record))).rejects.toThrow("WHATSAPP_RECEIPT_IDENTITY_CONFLICT");
  });
});
