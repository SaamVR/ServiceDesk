import { describe, expect, test } from "vitest";
import { FixtureEmailAdapter, shouldSuppressTransactionalEmail } from "../../src/server/integrations/email/adapter";

describe("transactional email adapter", () => {
  test("suppresses all outbound email for opted-out recipients", () => {
    const suppression = shouldSuppressTransactionalEmail({
      purpose: "BOOKING_CONFIRMED",
      to: "customer@example.test",
      policy: { optedOut: true },
    });

    expect(suppression).toBe("RECIPIENT_OPTED_OUT");
  });

  test("suppresses quote email when booking is already booked or customer replied", () => {
    expect(
      shouldSuppressTransactionalEmail({
        purpose: "QUOTE_READY",
        to: "customer@example.test",
        policy: { bookingStatus: "BOOKED" },
      }),
    ).toBe("BOOKING_ALREADY_CONFIRMED");

    expect(
      shouldSuppressTransactionalEmail({
        purpose: "QUOTE_READY",
        to: "customer@example.test",
        policy: { hasRecentReply: true },
      }),
    ).toBe("CUSTOMER_REPLIED_NEEDS_REVIEW");
  });

  test("suppresses payment reminders when invoice is already paid", () => {
    const suppression = shouldSuppressTransactionalEmail({
      purpose: "PAYMENT_REMINDER",
      to: "customer@example.test",
      policy: { invoiceStatus: "PAID" },
    });

    expect(suppression).toBe("INVOICE_ALREADY_PAID");
  });

  test("suppresses send for cancelled bookings before provider call", async () => {
    const adapter = new FixtureEmailAdapter(() => "2026-10-04T09:00:00.000Z");
    const result = await adapter.send({
      idempotencyKey: "email-1",
      workspaceId: "ws-clearnest",
      purpose: "BOOKING_CONFIRMED",
      to: "customer@example.test",
      subject: "Booking confirmed",
      html: "<p>Confirmed</p>",
      text: "Confirmed",
      policy: { bookingStatus: "CANCELLED" },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("BOOKING_CANCELLED");
  });

  test("returns redacted fixture evidence for accepted email", async () => {
    const adapter = new FixtureEmailAdapter(() => "2026-10-04T09:00:00.000Z");
    const result = await adapter.send({
      idempotencyKey: "email-2",
      workspaceId: "ws-clearnest",
      purpose: "INVOICE_ISSUED",
      to: "customer@example.test",
      subject: "Invoice issued",
      html: "<p>Invoice</p>",
      text: "Invoice",
      policy: {},
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.providerMessageId).toBe("email_fixture_email-2");
      expect(result.value.evidence.verification).toBe("CONTRACT_TESTED");
      expect(result.value.evidence.notes.join(" ")).not.toContain("customer@example.test");
    }
  });
});
