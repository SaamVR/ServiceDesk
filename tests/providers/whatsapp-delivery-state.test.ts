import { describe, expect, test } from "vitest";
import { applyWhatsAppDeliveryTransition } from "../../src/server/integrations/whatsapp/status";

describe("WhatsApp delivery lifecycle", () => {
  test("progresses provider acceptance to delivered to read through canonical policy", () => {
    const accepted = applyWhatsAppDeliveryTransition("PENDING", "PROVIDER_ACCEPTED");
    expect(accepted).toEqual({ result: "APPLIED", state: "PROVIDER_ACCEPTED", reason: "FIRST_STATUS" });

    const delivered = applyWhatsAppDeliveryTransition(accepted.state, "DELIVERED");
    expect(delivered).toEqual({ result: "APPLIED", state: "DELIVERED", reason: "FORWARD_PROGRESS" });

    const read = applyWhatsAppDeliveryTransition(delivered.state, "READ");
    expect(read).toEqual({ result: "APPLIED", state: "READ", reason: "FORWARD_PROGRESS" });
  });

  test("acknowledges duplicate callbacks without business effect", () => {
    expect(applyWhatsAppDeliveryTransition("DELIVERED", "DELIVERED")).toEqual({ result: "DUPLICATE", state: "DELIVERED", reason: "SAME_STATE" });
    expect(applyWhatsAppDeliveryTransition("FAILED", "FAILED")).toEqual({ result: "DUPLICATE", state: "FAILED", reason: "SAME_STATE" });
  });

  test("does not regress read or delivered state on older callbacks", () => {
    expect(applyWhatsAppDeliveryTransition("READ", "DELIVERED")).toEqual({ result: "STALE_REGRESSION", state: "READ", reason: "LOWER_ORDER_STATE" });
    expect(applyWhatsAppDeliveryTransition("DELIVERED", "PROVIDER_ACCEPTED")).toEqual({ result: "STALE_REGRESSION", state: "DELIVERED", reason: "LOWER_ORDER_STATE" });
  });

  test("preserves delivered or read proof over later failed callbacks", () => {
    expect(applyWhatsAppDeliveryTransition("DELIVERED", "FAILED")).toEqual({ result: "STALE_REGRESSION", state: "DELIVERED", reason: "FAILED_AFTER_CONFIRMED_DELIVERY" });
    expect(applyWhatsAppDeliveryTransition("READ", "FAILED")).toEqual({ result: "STALE_REGRESSION", state: "READ", reason: "FAILED_AFTER_CONFIRMED_DELIVERY" });
  });

  test("allows failure before delivery proof", () => {
    expect(applyWhatsAppDeliveryTransition("PENDING", "FAILED")).toEqual({ result: "APPLIED", state: "FAILED", reason: "FIRST_STATUS" });
    expect(applyWhatsAppDeliveryTransition("PROVIDER_ACCEPTED", "FAILED")).toEqual({ result: "APPLIED", state: "FAILED", reason: "FAILURE_BEFORE_CONFIRMED_DELIVERY" });
  });
});
