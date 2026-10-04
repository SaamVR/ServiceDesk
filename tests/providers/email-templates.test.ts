import { describe, expect, test } from "vitest";
import { buildTransactionalEmailJob, TRANSACTIONAL_EMAIL_TEMPLATES } from "../../src/server/integrations/email/templates";

describe("transactional email templates", () => {
  test("supports every V1 transactional purpose with deterministic subjects and idempotency", () => {
    expect(Object.keys(TRANSACTIONAL_EMAIL_TEMPLATES).sort()).toEqual([
      "BOOKING_CONFIRMED",
      "CUSTOMER_REPLY",
      "INVOICE_ISSUED",
      "PAYMENT_RECEIPT",
      "PAYMENT_REMINDER",
      "QUOTE_READY",
      "VISIT_REMINDER",
    ]);

    const job = buildTransactionalEmailJob({
      workspaceId: "ws-clearnest",
      purpose: "BOOKING_CONFIRMED",
      to: "customer@example.test",
      resourceId: "visit-1",
      publicUrl: "https://servicedesk.test/visits/visit-1",
      policy: { bookingStatus: "BOOKED" },
    });

    expect(job).toMatchObject({
      workspaceId: "ws-clearnest",
      purpose: "BOOKING_CONFIRMED",
      idempotencyKey: "email:ws-clearnest:BOOKING_CONFIRMED:visit-1",
      subject: "Booking confirmed",
    });
    expect(job.text).toContain("https://servicedesk.test/visits/visit-1");
    expect(job.html).toContain("https://servicedesk.test/visits/visit-1");
  });

  test("does not create marketing purposes or unsupported template keys", () => {
    expect(TRANSACTIONAL_EMAIL_TEMPLATES).not.toHaveProperty("MARKETING_BLAST");
    expect(TRANSACTIONAL_EMAIL_TEMPLATES).not.toHaveProperty("NEWSLETTER");
  });

  test("normalizes missing public URL without leaking customer details", () => {
    const job = buildTransactionalEmailJob({
      workspaceId: "ws-clearnest",
      purpose: "PAYMENT_REMINDER",
      to: "customer@example.test",
      resourceId: "invoice-1",
      policy: { invoiceStatus: "SENT" },
    });

    expect(job.subject).toBe("Payment reminder");
    expect(job.text).toContain("Open your ServiceDesk workspace");
    expect(JSON.stringify(job)).not.toContain("bedroom");
    expect(JSON.stringify(job)).not.toContain("address");
  });
});
