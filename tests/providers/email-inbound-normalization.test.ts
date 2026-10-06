import { describe, expect, it } from "vitest";
import { normalizeEmailInbound } from "../../src/server/integrations/email/inbound-normalization";

const valid = {
  workspaceId: "ws-clearnest",
  providerAccountId: "mailbox-1",
  providerMessageId: "email-msg-1",
  receiptKey: "receipt-email-1",
  senderEmail: " Person@Example.COM ",
  occurredAt: "2026-10-07T01:00:00.000Z",
  text: "Please confirm Friday's visit.",
  rawProviderEventRef: "email-event:provider:123",
};

describe("Email inbound normalization", () => {
  it("normalizes provider-neutral email into the shared inbound contract", () => {
    const result = normalizeEmailInbound(valid);

    expect(result).toEqual({
      ok: true,
      value: {
        receiptKey: "receipt-email-1",
        workspaceId: "ws-clearnest",
        channel: "EMAIL",
        providerAccountId: "mailbox-1",
        providerMessageId: "email-msg-1",
        senderRef: "person@example.com",
        occurredAt: "2026-10-07T01:00:00.000Z",
        contentKind: "TEXT",
        text: "Please confirm Friday's visit.",
        rawProviderEventRef: "email-event:provider:123",
      },
    });
  });

  it("rejects invalid sender identity", () => {
    expect(normalizeEmailInbound({ ...valid, senderEmail: "not-an-email" }))
      .toMatchObject({ ok: false, code: "EMAIL_INBOUND_SENDER_INVALID" });
  });

  it("rejects raw provider payload text masquerading as an opaque reference", () => {
    expect(normalizeEmailInbound({ ...valid, rawProviderEventRef: '{"email":"payload"}' }))
      .toMatchObject({ ok: false, code: "EMAIL_INBOUND_RAW_REF_INVALID" });
    expect(normalizeEmailInbound({ ...valid, rawProviderEventRef: "line-1\nline-2" }))
      .toMatchObject({ ok: false, code: "EMAIL_INBOUND_RAW_REF_INVALID" });
  });

  it("rejects empty and oversized text", () => {
    expect(normalizeEmailInbound({ ...valid, text: "   " }))
      .toMatchObject({ ok: false, code: "EMAIL_INBOUND_TEXT_REQUIRED" });
    expect(normalizeEmailInbound({ ...valid, text: "x".repeat(16001) }))
      .toMatchObject({ ok: false, code: "EMAIL_INBOUND_TEXT_TOO_LONG" });
  });

  it("rejects invalid timestamps without inventing provider time", () => {
    expect(normalizeEmailInbound({ ...valid, occurredAt: "not-a-date" }))
      .toMatchObject({ ok: false, code: "EMAIL_INBOUND_TIMESTAMP_INVALID" });
  });
});
