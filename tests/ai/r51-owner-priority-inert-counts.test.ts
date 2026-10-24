import { describe, expect, it } from "vitest";
import { ownerPriorityActions } from "../../src/server/ai/owner-priority-actions";
import type { VerifiedOwnerQueueFacts } from "../../src/server/ai/owner-priority-actions";

const facts: VerifiedOwnerQueueFacts = {
  openRequests: 2, waitingOnCustomerQuotes: 0, quoteValidityNeedsReview: 1,
  collectibleInvoices: 0, invoiceLedgersNeedingReview: 0,
  unassignedActiveVisits: 0, unresolvedCriticalAttentions: 1,
};
const read = (value: unknown) => ownerPriorityActions(value as VerifiedOwnerQueueFacts, 7);

describe("R51 owner model-free saved-count descriptor authority", () => {
  it("preserves fixed merchant queue priorities and omits genuine zero-count categories", () => {
    expect(read(facts)).toMatchObject([
      { key: "CRITICAL_ATTENTION", count: 1, module: "overview" },
      { key: "QUOTE_VALIDITY", count: 1, module: "quotes" },
      { key: "OPEN_REQUEST", count: 2, module: "requests" },
    ]);
    expect(read({ ...facts, openRequests: 0, quoteValidityNeedsReview: 0,
      unresolvedCriticalAttentions: 0 })).toEqual([]);
  });

  it("never executes a getter that could fabricate counts or mutate business state", () => {
    let getterCalls = 0;
    const accessor = Object.defineProperty({ ...facts }, "openRequests", {
      enumerable: true, get() { getterCalls++; throw Error("side effect"); },
    });
    expect(read(accessor)).toBeNull();
    expect(getterCalls).toBe(0);
  });

  it("refuses hidden, symbol, missing, extra or inherited source identities", () => {
    expect(read(Object.defineProperty({ ...facts }, "secret", {
      value: "PII", enumerable: false,
    }))).toBeNull();
    expect(read({ ...facts, [Symbol("sent")]: true })).toBeNull();
    const missing = { ...facts } as Partial<VerifiedOwnerQueueFacts>;
    delete missing.openRequests;
    expect(read(missing)).toBeNull();
    expect(read({ ...facts, guessedRemaining: 0 })).toBeNull();
    expect(read(Object.assign(Object.create({ openRequests: 99 }), facts))).toBeNull();
  });

  it("fails closed on a throwing proxy instead of crashing an owner review", () => {
    let accessed = false;
    const hostile = new Proxy(facts, {
      ownKeys() { accessed = true; throw Error("untrusted transport"); },
    });
    expect(read(hostile)).toBeNull();
    expect(accessed).toBe(true);
  });

  it("requires finite nonnegative bounded whole counts from an exact seven-key object", () => {
    for (const bad of [NaN, Infinity, -1, 5001, 0.01, "4", null]) {
      expect(read({ ...facts, openRequests: bad })).toBeNull();
    }
  });
});
