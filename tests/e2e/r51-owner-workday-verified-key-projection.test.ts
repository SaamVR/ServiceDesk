import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestOwnerVerifiedWorkdayReview } from
  "../../src/features/operations/owner-verified-workday-action";
import { loadOwnerWorkdayPriorities } from
  "../../src/server/ai/owner-workday-priorities";

vi.mock("../../src/server/ai/owner-workday-priorities", () => ({
  loadOwnerWorkdayPriorities: vi.fn(),
}));

const approvedRows = [
  { key: "CRITICAL_ATTENTION", module: "overview", priority: "CRITICAL" },
  { key: "LEDGER_REVIEW", module: "invoices", priority: "HIGH" },
  { key: "QUOTE_VALIDITY", module: "quotes", priority: "HIGH" },
  { key: "UNASSIGNED_VISIT", module: "schedule", priority: "HIGH" },
  { key: "COLLECTIBLE_INVOICE", module: "invoices", priority: "NORMAL" },
  { key: "WAITING_QUOTE", module: "quotes", priority: "NORMAL" },
  { key: "OPEN_REQUEST", module: "requests", priority: "NORMAL" },
].map(item => ({ ...item, count: 1, source: "VERIFIED_SAVED_QUEUE_COUNT" }));

const saved = (priorities: unknown) => ({
  ok: true, value: {
    state: "VERIFIED_OWNER_WORKDAY_REVIEW",
    source: "DOUBLE_CHECKED_SAVED_WORKSPACE_COUNTS",
    priorities,
    attentionSla: {
      state: "SAVED_ATTENTION_SLA_OWNER_REVIEW",
      overdueCount: 1, unscheduledCount: 0,
      workflowExecuted: false, customerMessaged: false,
    },
    manualReviewRequired: true, modelInvoked: false,
    providerMessageSent: false, paymentChanged: false,
  },
});
const deliver = async (priorities: unknown) => {
  vi.mocked(loadOwnerWorkdayPriorities).mockResolvedValueOnce(saved(priorities) as never);
  return requestOwnerVerifiedWorkdayReview("qa-cleaning");
};

describe("R51 double-saved-workday view-model key and navigation scope", () => {
  beforeEach(() => vi.resetAllMocks());

  it("projects five safe queue destinations from seven accepted verified rows", async () => {
    expect(await deliver(approvedRows)).toMatchObject({
      ok: true, priorities: [
        { key: "CRITICAL_ATTENTION", module: "overview", priority: "CRITICAL", count: 1, source: "VERIFIED_SAVED_QUEUE_COUNT" },
        { key: "LEDGER_REVIEW", module: "invoices", priority: "HIGH", count: 1, source: "VERIFIED_SAVED_QUEUE_COUNT" },
        { key: "QUOTE_VALIDITY", module: "quotes", priority: "HIGH", count: 1, source: "VERIFIED_SAVED_QUEUE_COUNT" },
        { key: "UNASSIGNED_VISIT", module: "schedule", priority: "HIGH", count: 1, source: "VERIFIED_SAVED_QUEUE_COUNT" },
        { key: "COLLECTIBLE_INVOICE", module: "invoices", priority: "NORMAL", count: 1, source: "VERIFIED_SAVED_QUEUE_COUNT" },
      ],
      manualReviewRequired: true, workflowExecuted: false,
    });
  });

  it("accepts an authentic empty owner queue without claiming operations completed", async () => {
    expect(await deliver([])).toMatchObject({
      ok: true, priorities: [], modelInvoked: false, customerMessaged: false,
    });
  });

  it("blocks forged navigation destinations, urgency, unknown and duplicate keys", async () => {
    for (const rows of [
      [{ ...approvedRows[0], module: "requests" }],
      [{ ...approvedRows[0], priority: "NORMAL" }],
      [{ ...approvedRows[0], key: "PAY_CUSTOMER" }],
      [approvedRows[0], approvedRows[0]],
      [null], [false], [{ ...approvedRows[0], count: 0 }],
    ]) {
      expect(await deliver(rows)).toEqual({
        ok: false, state: "SAVED_WORKDAY_UNAVAILABLE",
      });
    }
  });

  it("validates every source row, even items hidden behind the five-row UI limit", async () => {
    for (const rows of [
      [...approvedRows.slice(0, 6), { ...approvedRows[6], module: "invoices" }],
      [...approvedRows.slice(0, 6), { ...approvedRows[6], priority: "CRITICAL" }],
      [...approvedRows.slice(0, 6), { ...approvedRows[6], count: 99999 }],
    ]) {
      expect(await deliver(rows)).toEqual({
        ok: false, state: "SAVED_WORKDAY_UNAVAILABLE",
      });
    }
  });
});
