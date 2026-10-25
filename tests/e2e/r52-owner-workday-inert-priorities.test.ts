import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestOwnerVerifiedWorkdayReview } from "../../src/features/operations/owner-verified-workday-action";
import { loadOwnerWorkdayPriorities } from "../../src/server/ai/owner-workday-priorities";

vi.mock("../../src/server/ai/owner-workday-priorities", () => ({
  loadOwnerWorkdayPriorities: vi.fn(),
}));

const good = {
  key: "OPEN_REQUEST", module: "requests", priority: "NORMAL",
  count: 3, source: "VERIFIED_SAVED_QUEUE_COUNT", label: "Open service requests",
  instruction: "Review saved requests only.",
};
const response = (priorities: unknown) => ({
  ok: true,
  value: {
    state: "VERIFIED_OWNER_WORKDAY_REVIEW", source: "DOUBLE_CHECKED_SAVED_WORKSPACE_COUNTS",
    priorities, attentionSla: {
      state: "SAVED_ATTENTION_SLA_OWNER_REVIEW",
      overdueCount: 2, unscheduledCount: 0,
      workflowExecuted: false, customerMessaged: false,
    },
    manualReviewRequired: true, modelInvoked: false, providerMessageSent: false, paymentChanged: false,
  },
});
async function review(value: unknown) {
  vi.mocked(loadOwnerWorkdayPriorities).mockResolvedValueOnce(response(value) as never);
  return requestOwnerVerifiedWorkdayReview("qa-cleaning");
}

describe("R52 owner workday inert row projection", () => {
  beforeEach(() => vi.resetAllMocks());

  it("preserves safe navigation and read-only source facts", async () => {
    expect(await review([good])).toEqual({
      ok: true, state: "SAVED_WORKDAY_REVIEW_ONLY",
      source: "DOUBLE_CHECKED_SAVED_WORKSPACE_COUNTS",
      priorities: [{ key: "OPEN_REQUEST", module: "requests",
        priority: "NORMAL", count: 3, source: "VERIFIED_SAVED_QUEUE_COUNT" }],
      overdueCount: 2, unscheduledCount: 0,
      manualReviewRequired: true, modelInvoked: false,
      workflowExecuted: false, customerMessaged: false, paymentChanged: false,
    });
  });

  it("does not invoke an accessor getter that might have a side effect", async () => {
    let called = 0;
    const poisoned = Object.defineProperty({ ...good }, "count", {
      enumerable: true,
      get() { called++; throw Error("never execute me"); },
    });
    expect(await review([poisoned])).toEqual({
      ok: false, state: "SAVED_WORKDAY_UNAVAILABLE",
    });
    expect(called).toBe(0);
  });

  it("rejects hidden or symbol fields even if the safe first five look valid", async () => {
    for (const poisoned of [
      Object.defineProperty({ ...good }, "customerContact", { value: "private", enumerable: false }),
      { ...good, [Symbol("approval")]: true },
      { ...good, unrelatedCommand: "PUBLISH" },
    ]) {
      expect(await review([good, poisoned])).toEqual({
        ok: false, state: "SAVED_WORKDAY_UNAVAILABLE",
      });
    }
  });

  it("rejects inherited and proxy-trapped rows without allowing a false verification", async () => {
    expect(await review([Object.assign(Object.create({ modelInvoked: true }), good)]))
      .toEqual({ ok: false, state: "SAVED_WORKDAY_UNAVAILABLE" });
    const hostile = new Proxy(good, { ownKeys() { throw Error("hostile"); } });
    expect(await review([hostile])).toEqual({
      ok: false, state: "SAVED_WORKDAY_UNAVAILABLE",
    });
  });
});
