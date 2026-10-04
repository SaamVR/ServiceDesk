import assert from "node:assert/strict";
import { buildCheckoutView } from "../../src/features/checkout/view-models";
import { buildInvoiceLedgerView } from "../../src/features/invoices/view-models";
import { sampleInvoice, sampleQuote, sampleSlot, sampleVisit } from "../../src/features/operations/sample-data";

const holdExpiresAt = "2026-10-04T06:30:00.000Z";

const fixtureCheckout = buildCheckoutView({
  quote: { ...sampleQuote, status: "ACCEPTED" },
  slot: { ...sampleSlot, availabilityFresh: true },
  visit: { ...sampleVisit, status: "CONFIRMED" },
  invoice: { ...sampleInvoice, allocatedMinor: sampleQuote.depositMinor },
  paymentMode: "FIXTURE",
  holdExpiresAt,
});
assert.equal(fixtureCheckout.canShowReceipt, false, "fixture checkout must never expose receipt proof");

const staleSlotCheckout = buildCheckoutView({
  quote: { ...sampleQuote, status: "ACCEPTED" },
  slot: { ...sampleSlot, availabilityFresh: false },
  visit: { ...sampleVisit, status: "CONFIRMED" },
  invoice: { ...sampleInvoice, allocatedMinor: sampleQuote.depositMinor },
  paymentMode: "LIVE",
  holdExpiresAt,
});
assert.equal(staleSlotCheckout.canShowReceipt, false, "LIVE with stale slot must fail closed");
assert.equal(staleSlotCheckout.primaryAction, "Ask staff to refresh availability");

const paymentReviewCheckout = buildCheckoutView({
  quote: { ...sampleQuote, status: "ACCEPTED" },
  slot: { ...sampleSlot, availabilityFresh: true },
  visit: { ...sampleVisit, status: "PAYMENT_REVIEW" },
  invoice: { ...sampleInvoice, allocatedMinor: sampleQuote.depositMinor },
  paymentMode: "LIVE",
  holdExpiresAt,
});
assert.equal(paymentReviewCheckout.canShowReceipt, false, "payment review must hide receipt");
assert.equal(paymentReviewCheckout.primaryAction, "Open payment review");

const awaitingPaymentCheckout = buildCheckoutView({
  quote: { ...sampleQuote, status: "ACCEPTED" },
  slot: { ...sampleSlot, availabilityFresh: true },
  visit: { ...sampleVisit, status: "AWAITING_PAYMENT" },
  invoice: { ...sampleInvoice, allocatedMinor: sampleQuote.depositMinor },
  paymentMode: "LIVE",
  holdExpiresAt,
});
assert.equal(awaitingPaymentCheckout.canShowReceipt, false, "LIVE + deposit + awaiting payment must not expose receipt");

const sentQuoteCheckout = buildCheckoutView({
  quote: { ...sampleQuote, status: "SENT" },
  slot: { ...sampleSlot, availabilityFresh: true },
  visit: { ...sampleVisit, status: "CONFIRMED" },
  invoice: { ...sampleInvoice, allocatedMinor: sampleQuote.depositMinor },
  paymentMode: "LIVE",
  holdExpiresAt,
});
assert.equal(sentQuoteCheckout.canShowReceipt, false, "LIVE alone cannot imply accepted quote receipt eligibility");

const liveEligibleCheckout = buildCheckoutView({
  quote: { ...sampleQuote, status: "ACCEPTED" },
  slot: { ...sampleSlot, availabilityFresh: true },
  visit: { ...sampleVisit, status: "CONFIRMED" },
  invoice: { ...sampleInvoice, allocatedMinor: sampleQuote.depositMinor, refundedMinor: 0 },
  paymentMode: "LIVE",
  holdExpiresAt,
});
assert.equal(liveEligibleCheckout.canShowReceipt, true, "coherent accepted/fresh/confirmed/deposit LIVE checkout remains eligible");
assert.match(liveEligibleCheckout.warning, /provider callback/i);

const partialInvoice = buildInvoiceLedgerView(sampleInvoice);
assert.equal(partialInvoice.canShowFinalReceipt, false, "partially paid invoice must not show final receipt");

const inconsistentPaidInvoice = buildInvoiceLedgerView({
  ...sampleInvoice,
  status: "PAID",
  allocatedMinor: sampleInvoice.totalMinor - 100,
  refundedMinor: 0,
  balanceMinor: 0,
});
assert.equal(inconsistentPaidInvoice.canShowFinalReceipt, false, "PAID + zero balance but insufficient net allocation must fail closed");

const overAllocatedInvoice = buildInvoiceLedgerView({
  ...sampleInvoice,
  status: "PAID",
  allocatedMinor: sampleInvoice.totalMinor * 2,
  refundedMinor: 0,
  balanceMinor: 0,
});
assert.equal(overAllocatedInvoice.progressLabel, "100% collected", "over-allocation must clamp to 100%");
assert.equal(overAllocatedInvoice.canShowFinalReceipt, true, "coherent fully paid invoice can show final receipt");

const refundedOverAllocatedInvoice = buildInvoiceLedgerView({
  ...sampleInvoice,
  status: "PAID",
  allocatedMinor: sampleInvoice.totalMinor * 2,
  refundedMinor: sampleInvoice.totalMinor / 2,
  balanceMinor: 0,
});
assert.equal(refundedOverAllocatedInvoice.progressLabel, "100% collected", "net over-allocation after refund must still clamp to 100%");

const fullyPaidInvoice = buildInvoiceLedgerView({
  ...sampleInvoice,
  status: "PAID",
  allocatedMinor: sampleInvoice.totalMinor,
  refundedMinor: 0,
  balanceMinor: 0,
});
assert.equal(fullyPaidInvoice.progressLabel, "100% collected");
assert.equal(fullyPaidInvoice.canShowFinalReceipt, true, "coherent fully paid invoice remains eligible");

console.log("runtime-outage-payment-view-model-harness PASS");
