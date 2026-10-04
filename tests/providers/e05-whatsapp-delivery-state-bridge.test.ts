import { describe, expect, test } from "vitest";
import { buildWhatsAppDeliveryStateUpdate } from "../../src/server/integrations/whatsapp/delivery-state-bridge";

describe("WhatsApp delivery-state bridge", () => {
  test("builds Core delivery command only for monotonic applies", () => {
    const applied = buildWhatsAppDeliveryStateUpdate({
      workspaceId: "ws-1",
      messageId: "msg-1",
      providerMessageId: "wamid-1",
      current: { deliveryState: "PROVIDER_ACCEPTED", providerTimestamp: "1791110400", callbackKey: "sent" },
      incoming: { deliveryState: "DELIVERED", providerTimestamp: "1791110500", callbackKey: "delivered" },
    });
    expect(applied.decision.result).toBe("APPLY");
    expect(applied.command).toMatchObject({ deliveryState: "DELIVERED", messageId: "msg-1" });

    const failedTerminal = buildWhatsAppDeliveryStateUpdate({
      workspaceId: "ws-1",
      messageId: "msg-1",
      providerMessageId: "wamid-1",
      current: { deliveryState: "FAILED", providerTimestamp: "1791110600", callbackKey: "failed" },
      incoming: { deliveryState: "READ", providerTimestamp: "1791110700", callbackKey: "read" },
    });
    expect(failedTerminal.decision.result).toBe("STALE_REGRESSION");
    expect(failedTerminal.command).toBeUndefined();
  });
});
