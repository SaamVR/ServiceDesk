import { describe, expect, test } from "vitest";
import { buildBookingConfirmedWebhook, signOutboundWebhook, verifyOutboundWebhookSignature } from "../../src/server/integrations/webhook/signed";

describe("signed outbound webhooks", () => {
  test("signs booking.confirmed payload with timestamped HMAC headers", () => {
    const envelope = buildBookingConfirmedWebhook({
      workspaceId: "ws-clearnest",
      eventId: "evt-booking-1",
      occurredAt: "2026-10-04T10:00:00.000Z",
      bookingId: "visit-1",
      requestId: "req-1",
      customerRef: "cust_1234",
      scheduledStartAt: "2026-10-10T09:00:00.000Z",
      totalMinor: 34000,
      depositMinor: 8500,
      currency: "USD",
    });

    const signed = signOutboundWebhook({
      envelope,
      secret: "whsec_internal",
      now: "2026-10-04T10:00:01.000Z",
    });

    expect(signed.headers["x-servicedesk-event"]).toBe("booking.confirmed");
    expect(signed.headers["x-servicedesk-event-id"]).toBe("evt-booking-1");
    expect(signed.headers["x-servicedesk-timestamp"]).toBe("2026-10-04T10:00:01.000Z");
    expect(signed.headers["x-servicedesk-signature"]).toMatch(/^sha256=/);
    expect(signed.body).not.toContain("+1555");
  });

  test("verifies valid signatures and rejects tampered bodies", () => {
    const envelope = buildBookingConfirmedWebhook({
      workspaceId: "ws-clearnest",
      eventId: "evt-booking-1",
      occurredAt: "2026-10-04T10:00:00.000Z",
      bookingId: "visit-1",
      requestId: "req-1",
      customerRef: "cust_1234",
      scheduledStartAt: "2026-10-10T09:00:00.000Z",
      totalMinor: 34000,
      depositMinor: 8500,
      currency: "USD",
    });
    const signed = signOutboundWebhook({ envelope, secret: "whsec_internal", now: "2026-10-04T10:00:01.000Z" });

    expect(verifyOutboundWebhookSignature({ body: signed.body, headers: signed.headers, secret: "whsec_internal", now: "2026-10-04T10:01:01.000Z" })).toEqual({ ok: true, value: true });
    expect(verifyOutboundWebhookSignature({ body: signed.body.replace("34000", "1"), headers: signed.headers, secret: "whsec_internal", now: "2026-10-04T10:01:01.000Z" }).ok).toBe(false);
  });

  test("rejects stale signatures outside tolerance", () => {
    const envelope = buildBookingConfirmedWebhook({
      workspaceId: "ws-clearnest",
      eventId: "evt-booking-1",
      occurredAt: "2026-10-04T10:00:00.000Z",
      bookingId: "visit-1",
      requestId: "req-1",
      customerRef: "cust_1234",
      scheduledStartAt: "2026-10-10T09:00:00.000Z",
      totalMinor: 34000,
      depositMinor: 8500,
      currency: "USD",
    });
    const signed = signOutboundWebhook({ envelope, secret: "whsec_internal", now: "2026-10-04T10:00:01.000Z" });

    const result = verifyOutboundWebhookSignature({
      body: signed.body,
      headers: signed.headers,
      secret: "whsec_internal",
      now: "2026-10-04T10:20:01.000Z",
      toleranceSeconds: 300,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("WEBHOOK_SIGNATURE_STALE");
  });
});
