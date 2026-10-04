import { describe, expect, test } from "vitest";
import { applyWhatsAppDeliveryTransition } from "../../src/server/integrations/whatsapp/status";

describe("WhatsApp delivery lifecycle", () => {
  test("progresses provider acceptance to delivered to read", () => {
    const accepted = applyWhatsAppDeliveryTransition("PENDING", "PROVIDER_ACCEPTED");
    expect(accepted).toEqual({ result: "APPLIED", state: "PROVIDER_ACCEPTED" });

    const delivered = applyWhatsAppDeliveryTransition(accepted.state, "DELIVERED");
    expect(delivered).toEqual({ result: "APPLIED", state: "DELIVERED" });

    const read = applyWhatsAppDeliveryTransition(delivered.state, "READ");
    expect(read).toEqual({ result: "APPLIED", state: "READ" });
  });

  test("acknowledges duplicate callbacks without business effect", () => {
    expect(applyWhatsAppDeliveryTransition("DELIVERED", "DELIVERED")).toEqual({ result: "DUPLICATE", state: "DELIVERED" });
    expect(applyWhatsAppDeliveryTransition("FAILED", "FAILED")).toEqual({ result: "DUPLICATE", state: "FAILED" });
  });

  test("does not regress read or delivered state on older callbacks", () => {
    expect(applyWhatsAppDeliveryTransition("READ", "DELIVERED")).toEqual({ result: "STALE_REGRESSION", state: "READ" });
    expect(applyWhatsAppDeliveryTransition("DELIVERED", "PROVIDER_ACCEPTED")).toEqual({ result: "STALE_REGRESSION", state: "DELIVERED" });
  });

  test("preserves delivered or read proof over later failed callbacks", () => {
    expect(applyWhatsAppDeliveryTransition("DELIVERED", "FAILED")).toEqual({ result: "STALE_REGRESSION", state: "DELIVERED" });
    expect(applyWhatsAppDeliveryTransition("READ", "FAILED")).toEqual({ result: "STALE_REGRESSION", state: "READ" });
  });

  test("allows failure before delivery proof", () => {
    expect(applyWhatsAppDeliveryTransition("PENDING", "FAILED")).toEqual({ result: "APPLIED", state: "FAILED" });
    expect(applyWhatsAppDeliveryTransition("PROVIDER_ACCEPTED", "FAILED")).toEqual({ result: "APPLIED", state: "FAILED" });
  });
});
