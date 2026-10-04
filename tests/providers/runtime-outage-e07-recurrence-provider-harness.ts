import assert from "node:assert/strict";
import { FixtureCalendarAdapter } from "../../src/server/integrations/google-calendar/adapter";
import { planGoogleCalendarExternalEventReview } from "../../src/server/integrations/google-calendar/external-conflict";
import { FixtureEmailAdapter } from "../../src/server/integrations/email/adapter";
import { FixtureWhatsAppAdapter } from "../../src/server/integrations/whatsapp/adapter";
import { CalendarVisitCommittedOutboxDispatcher } from "../../src/server/integrations/outbox/calendar-dispatcher";
import { EmailCommittedOutboxDispatcher } from "../../src/server/integrations/outbox/email-dispatcher";
import { WhatsAppCommittedOutboxDispatcher } from "../../src/server/integrations/outbox/whatsapp-dispatcher";
import { planRecurrenceRuleProviderMutation, resolveMaterializedRecurrenceCalendarIntent } from "../../src/server/integrations/outbox/recurrence-calendar-intent";
import { resolveVisitReminderOutboxIntent } from "../../src/server/integrations/outbox/visit-reminder-intent";
import type { VisitDTO } from "../../src/contracts";
import type { ClaimedOutboxEvent } from "../../src/contracts/outbox";

const now = "2026-10-04T16:00:00.000Z";
const visit: VisitDTO = { id: "visit-1", workspaceId: "ws-1", requestId: "req-1", quoteId: "quote-1", crewId: "crew-1", status: "CONFIRMED", startAt: "2026-10-05T10:00:00.000Z", serviceMinutes: 60, bufferMinutes: 15, version: 7 };
const recurrenceEvent: ClaimedOutboxEvent = { id: "outbox-rec-1", workspaceId: "ws-1", topic: "recurrence.visit.materialized", payload: { recurrenceRuleId: "rrule-1", occurrenceSequence: 3, visitId: "visit-1" }, idempotencyKey: "recurrence:rrule-1:3:visit-1", attempt: 1, claimedAt: now };
const reminderEvent: ClaimedOutboxEvent = { id: "outbox-rem-1", workspaceId: "ws-1", topic: "visit.reminder", payload: { reminderId: "reminder-1", visitId: "visit-1" }, idempotencyKey: "visit-reminder:visit-1:24h", attempt: 1, claimedAt: now };

async function run() {
  const recurrenceSource = {
    eventId: recurrenceEvent.id,
    workspaceId: "ws-1",
    recurrenceRuleId: "rrule-1",
    occurrenceSequence: 3,
    visit,
    binding: { workspaceId: "ws-1", crewId: "crew-1", calendarId: "cal-1", status: "CONNECTED" as const, syncToken: "sync", lastSyncedAt: now, stale: false, timezone: "UTC" },
    summary: "Service visit",
    idempotencyKey: "recurrence:rrule-1:3:visit-1",
  };
  const recurrence = await resolveMaterializedRecurrenceCalendarIntent(recurrenceEvent, { async load() { return { ok: true, value: recurrenceSource }; } });
  assert.equal(recurrence.ok, true);
  if (!recurrence.ok) throw new Error("recurrence failed");
  assert.equal(recurrence.value.channel, "GOOGLE_CALENDAR");
  assert.equal(recurrence.value.purpose, "CALENDAR_VISIT");
  assert.equal((recurrence.value.payload.recurrence as any).googleCalendarSeriesMode, "NO_RRULE_SERIES");
  assert.equal(JSON.stringify(recurrence.value).includes("RRULE:"), false);

  const calendarDispatcher = new CalendarVisitCommittedOutboxDispatcher(new FixtureCalendarAdapter(), () => now);
  const calendarFirst = await calendarDispatcher.dispatch({ job: recurrence.value, committedAt: now, attempt: 1, expectedChannel: "GOOGLE_CALENDAR" });
  const calendarRetry = await calendarDispatcher.dispatch({ job: recurrence.value, committedAt: now, attempt: 2, expectedChannel: "GOOGLE_CALENDAR" });
  assert.equal(calendarFirst.ok && calendarFirst.value.outcome, "ACCEPTED");
  assert.equal(calendarRetry.ok && calendarRetry.value.outcome, "ACCEPTED");
  assert.equal(calendarFirst.ok && calendarRetry.ok && calendarFirst.value.providerMessageId, calendarRetry.ok && calendarRetry.value.providerMessageId);

  assert.equal(planRecurrenceRuleProviderMutation("PAUSE").shouldMutateProviderEvents, false);
  assert.equal(planRecurrenceRuleProviderMutation("SKIP_NEXT").shouldMutateProviderEvents, false);
  const review = planGoogleCalendarExternalEventReview({ appVisit: { workspaceId: "ws-1", crewId: "crew-1", visitId: "visit-1", providerEventId: "gcal_fixture_visit-1", startAt: visit.startAt, endAt: "2026-10-05T11:15:00.000Z", summary: "Service visit" }, providerEvent: { id: "gcal_fixture_visit-1", status: "cancelled" } });
  assert.equal(review.action, "OPERATOR_REVIEW");
  assert.equal(review.canMutateBookingTruth, false);

  const reminderSource = (overrides: Record<string, unknown> = {}) => ({
    eventId: reminderEvent.id,
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
  });
  const waReminder = await resolveVisitReminderOutboxIntent(reminderEvent, { async load() { return { ok: true, value: reminderSource() }; } });
  assert.equal(waReminder.ok, true);
  if (!waReminder.ok) throw new Error("wa reminder failed");
  assert.equal(waReminder.value.purpose, "VISIT_REMINDER");
  const waSent = await new WhatsAppCommittedOutboxDispatcher(new FixtureWhatsAppAdapter(() => now)).dispatch({ job: waReminder.value, committedAt: now, attempt: 1, expectedChannel: "WHATSAPP" });
  assert.equal(waSent.ok && waSent.value.outcome, "ACCEPTED");

  const emailReminder = await resolveVisitReminderOutboxIntent(reminderEvent, { async load() { return { ok: true, value: reminderSource({ channel: "EMAIL", recipient: { recipientRef: "customer@example.com", consentRequired: true, hasOptIn: true, optedOut: false }, message: { body: "Text", subject: "Visit reminder", text: "Text", html: "<p>Text</p>" } }) }; } });
  assert.equal(emailReminder.ok, true);
  if (!emailReminder.ok) throw new Error("email reminder failed");
  const emailSent = await new EmailCommittedOutboxDispatcher(new FixtureEmailAdapter(() => now)).dispatch({ job: emailReminder.value, committedAt: now, attempt: 1, expectedChannel: "EMAIL" });
  assert.equal(emailSent.ok && emailSent.value.outcome, "ACCEPTED");

  for (const override of [
    { recipient: { recipientRef: "15551234567", consentRequired: true, hasOptIn: true, optedOut: true } },
    { recipient: { recipientRef: "15551234567", consentRequired: true, hasOptIn: false, optedOut: false } },
    { recipient: { recipientRef: "15551234567", consentRequired: true, hasOptIn: true, optedOut: false, quietHoursBlocked: true } },
    { handoverActive: true },
  ]) {
    const suppressed = await resolveVisitReminderOutboxIntent(reminderEvent, { async load() { return { ok: true, value: reminderSource(override) }; } });
    assert.equal(suppressed.ok, true);
    if (!suppressed.ok) throw new Error("suppressed reminder failed");
    const result = await new WhatsAppCommittedOutboxDispatcher(new FixtureWhatsAppAdapter(() => now)).dispatch({ job: suppressed.value, committedAt: now, attempt: 1, expectedChannel: "WHATSAPP" });
    assert.equal(result.ok && result.value.outcome, "SUPPRESSED");
  }

  const providerResultsOnly = JSON.stringify({ calendarFirst, calendarRetry, waSent, emailSent });
  assert.equal(providerResultsOnly.includes("access_token"), false);
  assert.equal(providerResultsOnly.includes("Bearer "), false);
  assert.equal(providerResultsOnly.includes("customer@example.com"), false);
  assert.equal(providerResultsOnly.includes("15551234567"), false);
  console.log("runtime-outage-e07-recurrence-provider-harness PASS");
}

void run();
