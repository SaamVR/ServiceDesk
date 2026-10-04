import { describe, expect, test } from "vitest";
import {
  createWhatsAppProviderReceiptStore,
  toWhatsAppProviderInboundReceiptRow,
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

describe("WhatsApp provider receipt store", () => {
  test("persists only normalized receipt fields and deterministic duplicate outcome", async () => {
    const rows: WhatsAppProviderInboundReceiptRow[] = [];
    const gateway: WhatsAppProviderInboundReceiptGateway = {
      async insertReceipt(row) {
        expect(row).not.toHaveProperty("rawBody");
        if (rows.some((existing) => existing.receiptKey === row.receiptKey)) return "DUPLICATE";
        rows.push(row);
        return "INSERTED";
      },
    };

    const store = createWhatsAppProviderReceiptStore(gateway);
    await expect(store.persist(record)).resolves.toBe("INSERTED");
    await expect(store.persist(record)).resolves.toBe("DUPLICATE");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      receiptKey: "ws-1:phone-1:wamid-1",
      provider: "WHATSAPP",
      rawPayloadIncluded: false,
      aiAuthoritative: false,
    });
  });

  test("fails closed on wrong provider identity", () => {
    expect(() => toWhatsAppProviderInboundReceiptRow({ ...record, provider: "EMAIL" as never })).toThrow("WHATSAPP_RECEIPT_IDENTITY_MISMATCH");
  });
});
