import { describe, expect, test } from "vitest";
import { decideWhatsAppStatusTransition, type WhatsAppDeliverySnapshot } from "../../src/server/integrations/whatsapp/status-transition";

const delivered: WhatsAppDeliverySnapshot = {
  deliveryState: "DELIVERED",
  providerTimestamp: "1791108100",
  callbackKey: "phone-1:wamid-1:delivered:1791108100",
};

const read: WhatsAppDeliverySnapshot = {
  deliveryState: "READ",
  providerTimestamp: "1791108200",
  callbackKey: "phone-1:wamid-1:read:1791108200",
};

describe("WhatsApp delivery status transition policy", () => {
  test("applies first provider accepted callback when no current state exists", () => {
    expect(
      decideWhatsAppStatusTransition(undefined, {
        deliveryState: "PROVIDER_ACCEPTED",
        providerTimestamp: "1791108000",
        callbackKey: "phone-1:wamid-1:sent:1791108000",
      }),
    ).toEqual({ result: "APPLY", nextState: "PROVIDER_ACCEPTED", reason: "FIRST_STATUS" });
  });

  test("acknowledges exact duplicate callback without applying again", () => {
    expect(decideWhatsAppStatusTransition(delivered, delivered)).toEqual({ result: "DUPLICATE", nextState: "DELIVERED", reason: "SAME_CALLBACK_KEY" });
  });

  test("applies forward progress from accepted to delivered and delivered to read", () => {
    const accepted: WhatsAppDeliverySnapshot = {
      deliveryState: "PROVIDER_ACCEPTED",
      providerTimestamp: "1791108000",
      callbackKey: "phone-1:wamid-1:sent:1791108000",
    };

    expect(decideWhatsAppStatusTransition(accepted, delivered)).toEqual({ result: "APPLY", nextState: "DELIVERED", reason: "FORWARD_PROGRESS" });
    expect(decideWhatsAppStatusTransition(delivered, read)).toEqual({ result: "APPLY", nextState: "READ", reason: "FORWARD_PROGRESS" });
  });

  test("does not regress delivered or read messages to failed", () => {
    const failed = {
      deliveryState: "FAILED" as const,
      providerTimestamp: "1791108300",
      callbackKey: "phone-1:wamid-1:failed:1791108300",
    };

    expect(decideWhatsAppStatusTransition(delivered, failed)).toEqual({ result: "STALE_REGRESSION", nextState: "DELIVERED", reason: "FAILED_AFTER_CONFIRMED_DELIVERY" });
    expect(decideWhatsAppStatusTransition(read, failed)).toEqual({ result: "STALE_REGRESSION", nextState: "READ", reason: "FAILED_AFTER_CONFIRMED_DELIVERY" });
  });

  test("does not regress read or delivered state back to provider accepted", () => {
    expect(
      decideWhatsAppStatusTransition(read, {
        deliveryState: "PROVIDER_ACCEPTED",
        providerTimestamp: "1791108300",
        callbackKey: "phone-1:wamid-1:sent:1791108300",
      }),
    ).toEqual({ result: "STALE_REGRESSION", nextState: "READ", reason: "LOWER_ORDER_STATE" });
  });

  test("treats older provider timestamps as stale even when the status appears stronger", () => {
    expect(
      decideWhatsAppStatusTransition(delivered, {
        deliveryState: "READ",
        providerTimestamp: "1791107000",
        callbackKey: "phone-1:wamid-1:read:1791107000",
      }),
    ).toEqual({ result: "STALE_REGRESSION", nextState: "DELIVERED", reason: "OLDER_PROVIDER_TIMESTAMP" });
  });

  test("allows a failed callback after provider acceptance when delivery was never confirmed", () => {
    const accepted: WhatsAppDeliverySnapshot = {
      deliveryState: "PROVIDER_ACCEPTED",
      providerTimestamp: "1791108000",
      callbackKey: "phone-1:wamid-1:sent:1791108000",
    };

    expect(
      decideWhatsAppStatusTransition(accepted, {
        deliveryState: "FAILED",
        providerTimestamp: "1791108100",
        callbackKey: "phone-1:wamid-1:failed:1791108100",
      }),
    ).toEqual({ result: "APPLY", nextState: "FAILED", reason: "FAILURE_BEFORE_CONFIRMED_DELIVERY" });
  });
});
