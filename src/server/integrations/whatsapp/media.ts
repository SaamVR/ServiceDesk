import type { Result } from "../../../contracts";

export interface WhatsAppInboundMediaReference {
  workspaceId: string;
  phoneNumberId: string;
  providerMessageId: string;
  mediaId: string;
  mediaType: "image";
}

export interface WhatsAppInboundMediaFetchInput {
  workspaceId: string;
  phoneNumberId: string;
  providerMessageId: string;
  mediaId: string;
}

export interface AuthorizedWhatsAppMediaFetch {
  workspaceId: string;
  phoneNumberId: string;
  providerMessageId: string;
  mediaId: string;
  mediaType: "image";
  providerFetchAllowed: true;
}

export function authorizeWhatsAppInboundMediaFetch(
  input: WhatsAppInboundMediaFetchInput,
  reference: WhatsAppInboundMediaReference,
): Result<AuthorizedWhatsAppMediaFetch> {
  if (input.workspaceId !== reference.workspaceId) {
    return {
      ok: false,
      code: "WHATSAPP_MEDIA_WORKSPACE_MISMATCH",
      message: "Inbound WhatsApp media does not belong to the requested workspace.",
    };
  }

  if (input.phoneNumberId !== reference.phoneNumberId) {
    return {
      ok: false,
      code: "WHATSAPP_MEDIA_PHONE_MISMATCH",
      message: "Inbound WhatsApp media phone-number mapping does not match the stored message reference.",
    };
  }

  if (input.providerMessageId !== reference.providerMessageId) {
    return {
      ok: false,
      code: "WHATSAPP_MEDIA_MESSAGE_MISMATCH",
      message: "Inbound WhatsApp media is not attached to the requested provider message.",
    };
  }

  if (input.mediaId !== reference.mediaId) {
    return {
      ok: false,
      code: "WHATSAPP_MEDIA_ID_MISMATCH",
      message: "Inbound WhatsApp media ID does not match the stored provider message reference.",
    };
  }

  return {
    ok: true,
    value: {
      workspaceId: reference.workspaceId,
      phoneNumberId: reference.phoneNumberId,
      providerMessageId: reference.providerMessageId,
      mediaId: reference.mediaId,
      mediaType: reference.mediaType,
      providerFetchAllowed: true,
    },
  };
}
