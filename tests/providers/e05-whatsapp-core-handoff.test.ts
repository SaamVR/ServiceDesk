import { describe, expect, test } from "vitest";
import { createWhatsAppInboundCoreHandoffProcessor, toInboundMessageEvent } from "../../src/server/integrations/whatsapp/inbound-core-handoff";
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
  contentKind: "MEDIA_REFERENCE",
  media: { provider: "WHATSAPP", providerMediaId: "media-1" },
  rawPayloadIncluded: false,
  aiAuthoritative: false,
  rawProviderEventRef: "whatsapp_raw:ws-1:phone-1:abc",
};

describe("WhatsApp inbound Core handoff", () => {
  test("maps durable records to frozen InboundMessageEvent without raw body", () => {
    expect(toInboundMessageEvent(record)).toEqual({
      receiptKey: record.receiptKey,
      workspaceId: "ws-1",
      channel: "WHATSAPP",
      providerAccountId: "phone-1",
      providerMessageId: "wamid-1",
      senderRef: "15551234567",
      occurredAt: "1791110400",
      contentKind: "MEDIA_REFERENCE",
      text: undefined,
      media: { provider: "WHATSAPP", providerMediaId: "media-1" },
      rawProviderEventRef: "whatsapp_raw:ws-1:phone-1:abc",
    });
  });

  test("maps Core APPLIED/DUPLICATE and throws on Core failure for retry", async () => {
    const applied = createWhatsAppInboundCoreHandoffProcessor({
      async applyInboundMessage() {
        return { ok: true, value: { state: "APPLIED", conversation: { id: "c", workspaceId: "ws-1", channel: "WHATSAPP", handoverActive: false, version: 1 } } };
      },
    });
    await expect(applied.process(record)).resolves.toBe("PROCESSED");

    const duplicate = createWhatsAppInboundCoreHandoffProcessor({
      async applyInboundMessage() {
        return { ok: true, value: { state: "DUPLICATE", conversation: { id: "c", workspaceId: "ws-1", channel: "WHATSAPP", handoverActive: false, version: 1 } } };
      },
    });
    await expect(duplicate.process(record)).resolves.toBe("DUPLICATE");

    const failing = createWhatsAppInboundCoreHandoffProcessor({
      async applyInboundMessage() {
        return { ok: false, code: "CORE_WRITE_FAILED", message: "temporary" };
      },
    });
    await expect(failing.process(record)).rejects.toThrow("CORE_WRITE_FAILED");
  });
});
