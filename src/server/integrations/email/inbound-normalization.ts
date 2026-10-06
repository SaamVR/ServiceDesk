import type { Result } from "../../../contracts";
import type { InboundMessageEvent } from "../../core/facade";

export interface NormalizedEmailInboundEnvelope {
  workspaceId: string;
  providerAccountId: string;
  providerMessageId: string;
  receiptKey: string;
  senderEmail: string;
  occurredAt: string;
  text: string;
  rawProviderEventRef: string;
}

function fail(code: string, message: string): Result<InboundMessageEvent> {
  return { ok: false, code, message };
}

function nonblank(value: string): boolean {
  return value.trim().length > 0;
}

function validEmail(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function opaqueRef(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 3 && trimmed.length <= 240 && !/[\r\n{}]/.test(trimmed);
}

export function normalizeEmailInbound(
  input: NormalizedEmailInboundEnvelope,
): Result<InboundMessageEvent> {
  if (!nonblank(input.workspaceId)) return fail("EMAIL_INBOUND_WORKSPACE_REQUIRED", "Workspace identity is required.");
  if (!nonblank(input.providerAccountId)) return fail("EMAIL_INBOUND_ACCOUNT_REQUIRED", "Provider account identity is required.");
  if (!nonblank(input.providerMessageId)) return fail("EMAIL_INBOUND_MESSAGE_ID_REQUIRED", "Provider message identity is required.");
  if (!nonblank(input.receiptKey)) return fail("EMAIL_INBOUND_RECEIPT_REQUIRED", "Provider receipt identity is required.");
  if (!validEmail(input.senderEmail)) return fail("EMAIL_INBOUND_SENDER_INVALID", "Inbound sender must be a normalized email address.");
  if (!Number.isFinite(new Date(input.occurredAt).getTime())) {
    return fail("EMAIL_INBOUND_TIMESTAMP_INVALID", "Inbound email timestamp is invalid.");
  }
  const text = input.text.trim();
  if (!text) return fail("EMAIL_INBOUND_TEXT_REQUIRED", "Inbound email text is required.");
  if (text.length > 16000) return fail("EMAIL_INBOUND_TEXT_TOO_LONG", "Inbound email text exceeds the supported intake size.");
  if (!opaqueRef(input.rawProviderEventRef)) {
    return fail("EMAIL_INBOUND_RAW_REF_INVALID", "Inbound email requires an opaque provider event reference.");
  }

  return {
    ok: true,
    value: {
      receiptKey: input.receiptKey.trim(),
      workspaceId: input.workspaceId.trim(),
      channel: "EMAIL",
      providerAccountId: input.providerAccountId.trim(),
      providerMessageId: input.providerMessageId.trim(),
      senderRef: input.senderEmail.trim().toLowerCase(),
      occurredAt: new Date(input.occurredAt).toISOString(),
      contentKind: "TEXT",
      text,
      rawProviderEventRef: input.rawProviderEventRef.trim(),
    },
  };
}
