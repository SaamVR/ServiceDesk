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
  requests: [sampleRequest, { ...sampleRequest, id: "req_lost", status: "LOST" }],
  quotes: [sampleQuote],
  visits: [sampleVisit],
  invoices: [sampleInvoice],
});
assert.equal(cardValue(baseReport, "Conversion").value, "50%");
assert.equal(cardValue(baseReport, "Collected").value, "$85");
assert.equal(cardValue(baseReport, "Scheduled capacity").value, "4h 30m");

const orphanVisitReport = buildReportingView({
  requests: [{ ...sampleRequest, id: "req_supplied", status: "NEW" }],
  quotes: [],
  visits: [
    { ...sampleVisit, id: "visit_orphan_1", requestId: "missing_req_1" },
    { ...sampleVisit, id: "visit_orphan_2", requestId: "missing_req_2" },
  ],
  invoices: [],
});
assert.equal(cardValue(orphanVisitReport, "Conversion").value, "0%");
assert.equal(cardValue(orphanVisitReport, "Conversion").evidence, "0 booked / 1 requests");
assert.equal(cardValue(orphanVisitReport, "Scheduled capacity").value, "9h");

const duplicateVisitReport = buildReportingView({
  requests: [{ ...sampleRequest, id: "req_bookable", status: "NEW" }],
  quotes: [],
  visits: [
    { ...sampleVisit, id: "visit_duplicate_1", requestId: "req_bookable" },
    { ...sampleVisit, id: "visit_duplicate_2", requestId: "req_bookable" },
  ],
  invoices: [],
});
assert.equal(cardValue(duplicateVisitReport, "Conversion").value, "100%");
assert.equal(cardValue(duplicateVisitReport, "Conversion").evidence, "1 booked / 1 requests");
assert.equal(cardValue(duplicateVisitReport, "Scheduled capacity").value, "9h");

const noRequestReport = buildReportingView({
  requests: [],
  quotes: [],
  visits: [{ ...sampleVisit, id: "visit_no_request", requestId: "missing_req" }],
  invoices: [],
});
assert.equal(cardValue(noRequestReport, "Conversion").value, "No data");
assert.equal(cardValue(noRequestReport, "Conversion").evidence, "No request records supplied");
assert.equal(cardValue(noRequestReport, "Scheduled capacity").value, "4h 30m");

console.log("runtime-outage-product-view-model-harness: PASS");
