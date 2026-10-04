import { describe, expect, test } from "vitest";
import { bridgeWhatsAppStatusOutcomeToRecovery } from "../../src/server/integrations/whatsapp/status-recovery";

describe("WhatsApp status recovery bridge", () => {
  test("routes retryable persistence failures to provider retry without business truth mutation", () => {
    expect(
      bridgeWhatsAppStatusOutcomeToRecovery({
        workspaceId: "ws-clearnest",
        providerMessageId: "wamid-1",
        outcome: "PERSISTENCE_RETRYABLE_FAILURE",
        occurredAt: "2026-10-04T12:00:00.000Z",
        detail: "database unavailable",
      }),
    ).toMatchObject({
      provider: "WHATSAPP",
      queue: "provider-retry",
      action: "RETRY",
      mutatesBusinessTruth: false,
      operatorVisible: false,
    });
  });

  test("routes permanent delivery failure to operator review without delivery proof", () => {
    const record = bridgeWhatsAppStatusOutcomeToRecovery({
      workspaceId: "ws-clearnest",
      providerMessageId: "wamid-1",
      outcome: "PERMANENT_DELIVERY_FAILURE",
      occurredAt: "2026-10-04T12:00:00.000Z",
      detail: "Message undeliverable",
    });

    expect(record).toMatchObject({
      provider: "WHATSAPP",
      queue: "provider-operator-review",
      action: "OPERATOR_REVIEW",
      mutatesBusinessTruth: false,
      operatorVisible: true,
    });
    expect(record.notes.join(" ")).toContain("Message undeliverable");
    expect(record.notes.join(" ")).not.toContain("DELIVERED");
  });
});
