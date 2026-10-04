import { createHmac } from "node:crypto";
import { describe, expect, test } from "vitest";
import { signStripeFixturePayload, verifyStripeSignature } from "../../src/server/integrations/payments/adapter";

function sig(rawBody: string, secret: string, timestamp: number): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

describe("Stripe-style webhook signature hardening", () => {
  test("accepts any valid v1 signature among multiple signatures", () => {
    const rawBody = JSON.stringify({ id: "evt_1" });
    const timestamp = 1791115200;
    const valid = sig(rawBody, "whsec_valid", timestamp);
    const header = `t=${timestamp},v1=badbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadb,v1=${valid}`;

    expect(verifyStripeSignature(rawBody, header, "whsec_valid", { nowSeconds: timestamp, toleranceSeconds: 300 })).toEqual({ ok: true, value: true });
  });

  test("rejects stale timestamps and malformed signatures without leaking the secret", () => {
    const rawBody = JSON.stringify({ id: "evt_1" });
    const oldHeader = signStripeFixturePayload(rawBody, "whsec_secret", 1791110000);
    const stale = verifyStripeSignature(rawBody, oldHeader, "whsec_secret", { nowSeconds: 1791115200, toleranceSeconds: 300 });
    const malformed = verifyStripeSignature(rawBody, "t=not-a-number,v1=abcd", "whsec_secret", { nowSeconds: 1791115200, toleranceSeconds: 300 });

    expect(stale).toMatchObject({ ok: false, code: "SIGNATURE_TIMESTAMP_OUT_OF_TOLERANCE" });
    expect(malformed).toMatchObject({ ok: false, code: "MALFORMED_SIGNATURE" });
    expect(JSON.stringify(stale)).not.toContain("whsec_secret");
    expect(JSON.stringify(malformed)).not.toContain("whsec_secret");
  });

  test("rejects tampered payloads even when header format is otherwise valid", () => {
    const rawBody = JSON.stringify({ id: "evt_1", amount: 8500 });
    const tampered = JSON.stringify({ id: "evt_1", amount: 1 });
    const timestamp = 1791115200;
    const header = signStripeFixturePayload(rawBody, "whsec_secret", timestamp);

    expect(verifyStripeSignature(tampered, header, "whsec_secret", { nowSeconds: timestamp, toleranceSeconds: 300 })).toMatchObject({
      ok: false,
      code: "SIGNATURE_MISMATCH",
    });
  });

  test("rejects malformed non-hex signatures safely", () => {
    const rawBody = JSON.stringify({ id: "evt_1" });
    const result = verifyStripeSignature(rawBody, "t=1791115200,v1=not-hex", "whsec_secret", { nowSeconds: 1791115200 });

    expect(result).toMatchObject({ ok: false, code: "MALFORMED_SIGNATURE" });
  });
});
