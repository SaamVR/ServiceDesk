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

  test("fails closed on signed invalid timestamp and corrupted digest shape", () => {
    const envelope = buildBookingConfirmedWebhook({
      workspaceId:"ws-a",eventId:"evt-1",occurredAt:"2026-10-04T10:00:00Z",
      bookingId:"visit-1",requestId:"req-1",customerRef:"redacted",
      scheduledStartAt:"2026-10-04T12:00:00Z",totalMinor:2500,
      depositMinor:0,currency:"USD",
    });
    const invalid=signOutboundWebhook({envelope,secret:"signing-key",
      now:"not-a-timestamp"});
    expect(verifyOutboundWebhookSignature({
      body:invalid.body,headers:invalid.headers,secret:"signing-key",
      now:"2026-10-04T10:00:00Z",
    })).toMatchObject({ok:false,code:"WEBHOOK_SIGNATURE_STALE"});
    const valid=signOutboundWebhook({envelope,secret:"signing-key",
      now:"2026-10-04T10:00:00.000Z"});
    for(const signature of [
      "sha256=a", "sha256="+"0".repeat(64)+"garbage",
      "sha256="+"g".repeat(64),
    ]) {
      expect(verifyOutboundWebhookSignature({
        body:valid.body,headers:{...valid.headers,"x-servicedesk-signature":signature},
        secret:"signing-key",now:"2026-10-04T10:00:00.000Z",
      }).ok).toBe(false);
    }
  });

  test("refuses invalid verifier clock and out-of-range tolerances", () => {
    const envelope=buildBookingConfirmedWebhook({
      workspaceId:"ws-a",eventId:"evt-2",occurredAt:"2026-10-04T10:00:00Z",
      bookingId:"visit-2",requestId:"req-2",customerRef:"redacted",
      scheduledStartAt:"2026-10-04T12:00:00Z",totalMinor:2500,
      depositMinor:0,currency:"USD",
    });
    const signed=signOutboundWebhook({envelope,secret:"signing-key",
      now:"2026-10-04T10:00:00.000Z"});
    for(const [now,toleranceSeconds] of [
      ["not-a-clock",300],["2026-10-04T10:00:00.000Z",-1],
      ["2026-10-04T10:00:00.000Z",Infinity],
      ["2026-10-04T10:00:00.000Z",86400],
    ] as const) {
      expect(verifyOutboundWebhookSignature({
        body:signed.body,headers:signed.headers,secret:"signing-key",
        now,toleranceSeconds,
      })).toMatchObject({ok:false,code:"WEBHOOK_SIGNATURE_STALE"});
    }
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
