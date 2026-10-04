import { describe, expect, test } from "vitest";
import { createWhatsAppInboundCoreHandoffProcessor, toWhatsAppInboundBusinessCommandInput, type WhatsAppInboundBusinessCommandPort } from "../../src/server/integrations/whatsapp/inbound-core-handoff";
import type { DurableWhatsAppInboxRecord } from "../../src/server/integrations/whatsapp/inbox-persistence";

function record(overrides: Partial<DurableWhatsAppInboxRecord> = {}): DurableWhatsAppInboxRecord {
  return {
    provider: "WHATSAPP",
    workspaceId: "ws-1",
    providerAccountId: "phone-1",
    phoneNumberId: "phone-1",
    providerMessageId: "wamid-1",
    receiptKey: "ws-1:phone-1:wamid-1",
    senderRef: "15550000000",
    providerTimestamp: "1791108000",
    channel: "WHATSAPP",
    contentKind: "TEXT",
    text: "Need a quote",
    rawPayloadIncluded: false,
    aiAuthoritative: false,
    rawProviderEventRef: "raw-ref-1",
    ...overrides,
  };
}

describe("WhatsApp inbound Core handoff boundary", () => {
  test("preserves receipt identity and maps duplicate business command safely", async () => {
    const command: WhatsAppInboundBusinessCommandPort = { async execute(input) { return input.receiptKey.endsWith("dup") ? { ok: true, value: "DUPLICATE" } : { ok: true, value: "APPLIED" }; } };
    const processor = createWhatsAppInboundCoreHandoffProcessor(command);

    await expect(processor.process(record())).resolves.toBe("PROCESSED");
    await expect(processor.process(record({ receiptKey: "ws-1:phone-1:dup", providerMessageId: "dup" }))).resolves.toBe("DUPLICATE");
  });

  test("preserves normalized text, media, unsupported semantics and retryable failure identity", async () => {
    expect(toWhatsAppInboundBusinessCommandInput(record()).text).toBe("Need a quote");
    expect(toWhatsAppInboundBusinessCommandInput(record({ contentKind: "MEDIA_REFERENCE", text: undefined, media: { provider: "WHATSAPP", providerMediaId: "media-1" } })).media?.providerMediaId).toBe("media-1");
    expect(toWhatsAppInboundBusinessCommandInput(record({ contentKind: "UNSUPPORTED", text: undefined, media: undefined })).contentKind).toBe("UNSUPPORTED");

    const processor = createWhatsAppInboundCoreHandoffProcessor({ async execute() { return { ok: false, code: "CORE_COMMAND_RETRYABLE", message: "core unavailable" }; } });
    await expect(processor.process(record())).rejects.toThrow(/CORE_COMMAND_RETRYABLE/);
  });
});
