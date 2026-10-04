import { describe, expect, test } from "vitest";
import { authorizeWhatsAppInboundMediaFetch } from "../../src/server/integrations/whatsapp/media";

const reference = {
  workspaceId: "ws-clearnest",
  phoneNumberId: "phone-1",
  providerMessageId: "wamid-1",
  mediaId: "media-1",
  mediaType: "image" as const,
};

describe("WhatsApp inbound media scope", () => {
  test("allows exact workspace/message/media reference", () => {
    const result = authorizeWhatsAppInboundMediaFetch(
      {
        workspaceId: "ws-clearnest",
        phoneNumberId: "phone-1",
        providerMessageId: "wamid-1",
        mediaId: "media-1",
      },
      reference,
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
        mediaId: "media-1",
        providerMessageId: "wamid-1",
        workspaceId: "ws-clearnest",
      },
    });
  });

  test("rejects cross-workspace media fetch", () => {
    const result = authorizeWhatsAppInboundMediaFetch(
      {
        workspaceId: "ws-other",
        phoneNumberId: "phone-1",
        providerMessageId: "wamid-1",
        mediaId: "media-1",
      },
      reference,
    );

    expect(result).toMatchObject({ ok: false, code: "WHATSAPP_MEDIA_WORKSPACE_MISMATCH" });
  });

  test("rejects media id borrowed from another provider message", () => {
    const result = authorizeWhatsAppInboundMediaFetch(
      {
        workspaceId: "ws-clearnest",
        phoneNumberId: "phone-1",
        providerMessageId: "wamid-other",
        mediaId: "media-1",
      },
      reference,
    );

    expect(result).toMatchObject({ ok: false, code: "WHATSAPP_MEDIA_MESSAGE_MISMATCH" });
  });

  test("rejects phone-number mapping mismatch before provider retrieval", () => {
    const result = authorizeWhatsAppInboundMediaFetch(
      {
        workspaceId: "ws-clearnest",
        phoneNumberId: "phone-other",
        providerMessageId: "wamid-1",
        mediaId: "media-1",
      },
      reference,
    );

    expect(result).toMatchObject({ ok: false, code: "WHATSAPP_MEDIA_PHONE_MISMATCH" });
  });
});
