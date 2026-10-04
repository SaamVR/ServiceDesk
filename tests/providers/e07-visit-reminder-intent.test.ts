import { describe, expect, test } from "vitest";
import type { ClaimedOutboxEvent } from "../../src/contracts/outbox";
import type { VisitDTO } from "../../src/contracts";
import { FixtureEmailAdapter } from "../../src/server/integrations/email/adapter";
import { FixtureWhatsAppAdapter } from "../../src/server/integrations/whatsapp/adapter";
import { EmailCommittedOutboxDispatcher } from "../../src/server/integrations/outbox/email-dispatcher";
import { WhatsAppCommittedOutboxDispatcher } from "../../src/server/integrations/outbox/whatsapp-dispatcher";
import { resolveVisitReminderOutboxIntent } from "../../src/server/integrations/outbox/visit-reminder-intent";

const now = "2026-10-04T16:00:00.000Z";
const visit: VisitDTO = { id: "visit-1", workspaceId: "ws-1", requestId: "req-1", quoteId: "quote-1", crewId: "crew-1", status: "CONFIRMED", startAt: "2026-10-05T10:00:00.000Z", serviceMinutes: 60, bufferMinutes: 15, version: 7 };
const event: ClaimedOutboxEvent = { id: "outbox-rem-1", workspaceId: "ws-1", topic: "visit.reminder", payload: { reminderId: "reminder-1", visitId: "visit-1" }, idempotencyKey: "visit-reminder:visit-1:24h", attempt: 1, claimedAt: now };

function source(overrides: Record<string, unknown> = {}) {
  return {
    eventId: event.id,
    workspaceId: "ws-1",
    reminderId: "reminder-1",
    visit,
    conversationId: "conv-1",
    expectedConversationVersion: 4,
    channel: "WHATSAPP" as const,
    recipient: { recipientRef: "15551234567", consentRequired: true, hasOptIn: true, optedOut: false, quietHoursBlocked: false },
    handoverActive: false,
    message: { body: "Reminder: your service visit is tomorrow.", templateKey: "visit_reminder", lastInboundAt: "2026-10-04T15:30:00.000Z" },
    idempotencyKey: "visit-reminder:visit-1:24h",
    ...overrides,
  };
}

describe("E07 visit reminder intent", () => {
  test("routes WhatsApp reminder through existing dispatcher", async () => {
    const resolved = await resolveVisitReminderOutboxIntent(event, { async load() { return { ok: true, value: source() }; } });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.value.purpose).toBe("VISIT_REMINDER");
    const sent = await new WhatsAppCommittedOutboxDispatcher(new FixtureWhatsAppAdapter(() => now)).dispatch({ job: resolved.value, committedAt: now, attempt: 1, expectedChannel: "WHATSAPP" });
    expect(sent.ok && sent.value.outcome).toBe("ACCEPTED");
  });

  test("routes Email reminder through existing dispatcher", async () => {
    const resolved = await resolveVisitReminderOutboxIntent(event, { async load() { return { ok: true, value: source({ channel: "EMAIL", recipient: { recipientRef: "customer@example.com", consentRequired: true, hasOptIn: true, optedOut: false }, message: { body: "Text", subject: "Visit reminder", text: "Text", html: "<p>Text</p>" } }) }; } });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const sent = await new EmailCommittedOutboxDispatcher(new FixtureEmailAdapter(() => now)).dispatch({ job: resolved.value, committedAt: now, attempt: 1, expectedChannel: "EMAIL" });
    expect(sent.ok && sent.value.outcome).toBe("ACCEPTED");
  });

  test("suppresses opt-out, missing opt-in, quiet hours, and automated handover reminders", async () => {
    const wa = new WhatsAppCommittedOutboxDispatcher(new FixtureWhatsAppAdapter(() => now));
    for (const override of [
      { recipient: { recipientRef: "15551234567", consentRequired: true, hasOptIn: true, optedOut: true } },
      { recipient: { recipientRef: "15551234567", consentRequired: true, hasOptIn: false, optedOut: false } },
      { recipient: { recipientRef: "15551234567", consentRequired: true, hasOptIn: true, optedOut: false, quietHoursBlocked: true } },
      { handoverActive: true },
    ]) {
      const resolved = await resolveVisitReminderOutboxIntent(event, { async load() { return { ok: true, value: source(override) }; } });
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;
      const sent = await wa.dispatch({ job: resolved.value, committedAt: now, attempt: 1, expectedChannel: "WHATSAPP" });
      expect(sent.ok && sent.value.outcome).toBe("SUPPRESSED");
    }
  });
});
