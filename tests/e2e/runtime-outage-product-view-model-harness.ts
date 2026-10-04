import assert from "node:assert/strict";
import { buildEditableRequestSummary } from "../../src/features/request-intake/view-models";
import { buildCrewJobView, buildCustomerPortalView, buildStaffQueueView } from "../../src/features/operations/view-models";
import { buildScheduleLaneView } from "../../src/features/schedule/view-models";
import { buildReportingView } from "../../src/features/reports/view-models";
import {
  sampleAttentionItems,
  sampleConversation,
  sampleIntegrations,
  sampleInvoice,
  sampleQuote,
  sampleRequest,
  sampleSlot,
  sampleVisit,
} from "../../src/features/operations/sample-data";

function cardValue(view: ReturnType<typeof buildReportingView>, label: string) {
  const card = view.cards.find((item) => item.label === label);
  assert.ok(card, `expected ${label} card`);
  return card;
}

const missingSummary = buildEditableRequestSummary({
  request: { ...sampleRequest, bedrooms: undefined, bathrooms: undefined, requestedStartAt: undefined },
  quote: sampleQuote,
});
assert.deepEqual(missingSummary.missingFields, ["bedrooms", "bathrooms", "preferred_time"]);
assert.equal(missingSummary.confirmationBlocked, true);
assert.equal(missingSummary.primaryAction, "Complete missing details");

const portal = buildCustomerPortalView({
  request: sampleRequest,
  quote: sampleQuote,
  slot: sampleSlot,
  visit: sampleVisit,
  invoice: sampleInvoice,
  conversation: sampleConversation,
});
assert.equal(portal.totalLabel, "$340.00");
assert.equal(portal.slotFreshness, "STALE_REVIEW_REQUIRED");
assert.equal(portal.handoverLabel, "Human handover active");

const staffQueue = buildStaffQueueView({
  request: sampleRequest,
  quote: sampleQuote,
  conversation: sampleConversation,
  attentionItems: sampleAttentionItems,
  integrations: sampleIntegrations,
});
assert.equal(staffQueue.items.length, sampleAttentionItems.length);
assert.ok(staffQueue.items.some((item) => item.nextAction.includes("Calendar freshness")));

const crew = buildCrewJobView({ request: sampleRequest, visit: sampleVisit, invoice: sampleInvoice });
assert.equal(crew.durationLabel, "240m service + 30m buffer");
assert.equal(crew.nextAction, "Start travel");

const blockedSchedule = buildScheduleLaneView({
  slot: sampleSlot,
  visit: sampleVisit,
  integrations: sampleIntegrations,
  attentionItems: sampleAttentionItems,
});
assert.equal(blockedSchedule.canInstantConfirm, false);
assert.equal(blockedSchedule.freshnessLabel, "Stale availability — staff review required");

const healthySchedule = buildScheduleLaneView({
  slot: { ...sampleSlot, availabilityFresh: true },
  integrations: [{ workspaceId: sampleRequest.workspaceId, provider: "GOOGLE_CALENDAR", status: "CONNECTED", mode: "SANDBOX" }],
  attentionItems: [],
});
assert.equal(healthySchedule.canInstantConfirm, true);

const baseReport = buildReportingView({
  workspaceId: sampleRequest.workspaceId,
  requestCount: 2,
  bookedRequestCount: 1,
  conversionRateBps: 5000,
  collectedMinor: 8500,
  outstandingMinor: 25500,
  currency: "USD",
  scheduledServiceMinutes: 240,
  scheduledBufferMinutes: 30,
  openAttentionCount: sampleAttentionItems.length,
  unresolvedQualityCount: 1,
  generatedAt: "2026-10-04T06:30:00.000Z",
});
assert.equal(cardValue(baseReport, "Conversion").value, "50.0%");
assert.equal(cardValue(baseReport, "Collected").value, "$85");
assert.equal(cardValue(baseReport, "Scheduled service").value, "4h");
assert.equal(cardValue(baseReport, "Scheduled buffer").value, "0h 30m");

const noRequestReport = buildReportingView({
  workspaceId: sampleRequest.workspaceId,
  requestCount: 0,
  bookedRequestCount: 0,
  conversionRateBps: undefined,
  collectedMinor: 0,
  outstandingMinor: 0,
  currency: "USD",
  scheduledServiceMinutes: 0,
  scheduledBufferMinutes: 0,
  openAttentionCount: 0,
  unresolvedQualityCount: 0,
  generatedAt: "2026-10-04T06:30:00.000Z",
});
assert.equal(cardValue(noRequestReport, "Conversion").value, "No data");

console.log("runtime-outage-product-view-model-harness: PASS");
