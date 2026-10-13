import { describe, expect, test } from "vitest";
import { redactEmailRecipientRef, toEmailCallbackReceiptRow } from "../../src/server/integrations/email/callback-receipt";

describe("durable email callback receipt redaction", () => {
  test("preserves only a bounded safe recipient hint", () => {
    expect(redactEmailRecipientRef("Jane.Doe@example.com")).toBe("email:ja…@example.com");
    expect(redactEmailRecipientRef("customer_abcdef")).toBe("recipient:cu…ef");
  });
  test("does not permit newline, Unicode bidi overrides or HTML in operator evidence", () => {
    for (const malicious of [
      "customer\nInjected: Delivered", "user@example.com\r\nBcc: secret@example.com",
      "customer\u202Eabc", "user@example.com\u200B", "<script>secret</script>",
      "z".repeat(600),
    ]) {
      expect(redactEmailRecipientRef(malicious)).toBe("recipient:redacted");
      const saved = toEmailCallbackReceiptRow({
        callbackKey: "cb-safe", providerMessageId: "msg-safe",
        eventType: "BOUNCE", occurredAt: "2026-10-14T03:00:00.000Z",
        recipientRef: malicious,
      });
      expect(saved.redactedRecipientRef).toBe("recipient:redacted");
      expect(JSON.stringify(saved)).not.toContain(malicious.slice(0,20));
    }
  });
});
