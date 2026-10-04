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
  contentKind: "TEXT",
  text: "hello",
  rawPayloadIncluded: false,
  aiAuthoritative: false,
  rawProviderEventRef: "whatsapp_raw:ws-1:phone-1:abc",
};

describe("WhatsApp inbound Core handoff", () => {
  test("normalizes Unix provider timestamp before Core receives occurredAt", () => {
    expect(toInboundMessageEvent(record).occurredAt).toBe("2026-10-04T10:40:00.000Z");
  });

  test("rejects malformed provider timestamp before Core call", async () => {
    const calls: unknown[] = [];
    const processor = createWhatsAppInboundCoreHandoffProcessor({
      async applyInboundMessage(event) {
        calls.push(event);
        return { ok: true, value: { state: "APPLIED", conversation: { id: "conv-1", workspaceId: event.workspaceId, channel: "WHATSAPP", handoverActive: false, version: 1 } } };
      },
    });

    await expect(processor.process({ ...record, providerTimestamp: "bad-time" })).rejects.toThrow("PROVIDER_TIMESTAMP_INVALID");
    expect(calls).toHaveLength(0);
  });

  test("maps Core APPLIED and DUPLICATE outcomes", async () => {
    const outcomes = ["APPLIED", "DUPLICATE"] as const;
    const calls: unknown[] = [];
    const processor = createWhatsAppInboundCoreHandoffProcessor({
      async applyInboundMessage(event) {
        calls.push(event);
        const state = outcomes[calls.length - 1];
        return { ok: true, value: { state, conversation: { id: "conv-1", workspaceId: event.workspaceId, channel: "WHATSAPP", handoverActive: false, version: 1 } } };
      },
    });

    await expect(processor.process(record)).resolves.toBe("PROCESSED");
    await expect(processor.process(record)).resolves.toBe("DUPLICATE");
    expect(calls).toHaveLength(2);
  });
});
