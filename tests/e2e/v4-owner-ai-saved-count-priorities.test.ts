import { describe, expect, it } from "vitest";
import { buildOwnerPriorityCards } from "../../src/features/operations/owner-operations-brief-priorities";
import { parseVerifiedOwnerBrief } from "../../src/features/operations/owner-operations-brief-proof";

const empty = {
  openRequests: 0, waitingOnCustomerQuotes: 0,
  quoteValidityNeedsReview: 0, collectibleInvoices: 0,
  invoiceLedgersNeedingReview: 0, unassignedActiveVisits: 0,
  unresolvedCriticalAttentions: 0,
};

describe("Owner priorities from authoritative saved queue counts", () => {
  it("uses fixed human-review order, not largest count or AI-generated priority", () => {
    const facts = { ...empty, openRequests: 20,
      unresolvedCriticalAttentions: 1, invoiceLedgersNeedingReview: 2,
      quoteValidityNeedsReview: 3, unassignedActiveVisits: 10 };
    const result = buildOwnerPriorityCards(facts);
    expect(result.map(item => item.kind)).toEqual([
      "critical-attention", "invoice-ledger-review", "quote-validity",
    ]);
    expect(result.map(item => item.count)).toEqual([1, 2, 3]);
    expect(result.map(item => item.module)).toEqual([
      "overview", "invoices", "quotes",
    ]);
  });
  it("shows only positive saved categories and never fabricates due dates", () => {
    expect(buildOwnerPriorityCards(empty)).toEqual([]);
    const result = buildOwnerPriorityCards({
      ...empty, waitingOnCustomerQuotes: 1, collectibleInvoices: 2,
    });
    expect(result.map(item => item.kind)).toEqual([
      "customer-quote-wait", "collectible-invoice",
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /overdue|tomorrow|deadline|past.due|customer.email|phone|paid/i,
    );
  });
  it("preserves only exactly seven verified nonnegative bounded integer facts", () => {
    const ok = {
      ok: true, model: "test-model",
      source: "AUTHORIZED_SAVED_WORKSPACE_COUNTS",
      brief: "Review saved open requests.", facts: empty,
    };
    expect(parseVerifiedOwnerBrief(ok)?.facts).toEqual(empty);
    for (const bad of [
      { ...empty, openRequests: 1.5 },
      { ...empty, openRequests: -1 },
      { ...empty, collectibleInvoices: Number.POSITIVE_INFINITY },
      { ...empty, openRequests: Number.NaN },
      { ...empty, openRequests: 5001 },
      { ...empty, secret: "private-customer" },
    ]) {
      expect(parseVerifiedOwnerBrief({ ...ok, facts: bad })).toBeNull();
    }
    expect(parseVerifiedOwnerBrief({
      ...ok, facts: { ...empty, openRequests: undefined },
    })).toBeNull();
  });
  it("copies verified counts so a mutated response object cannot change displayed priorities", () => {
    const input = {
      ok: true, model: "approved-test-model",
      source: "AUTHORIZED_SAVED_WORKSPACE_COUNTS",
      brief: "Review saved requests.",
      facts: { ...empty, openRequests: 2 },
    };
    const parsed = parseVerifiedOwnerBrief(input);
    input.facts.openRequests = 99;
    expect(parsed?.facts.openRequests).toBe(2);
    expect(buildOwnerPriorityCards(parsed!.facts)[0]).toMatchObject({
      kind: "open-request", count: 2, module: "requests",
    });
  });

  it("shows owner counts only from the existing double-read server result", () => {
    const action = require("node:fs").readFileSync(
      require("node:path").join(process.cwd(),
        "src/features/operations/owner-operations-brief-action.ts"), "utf8") as string;
    expect(action).toContain("facts:result.value.facts");
    expect(action).toContain("generateOwnerOperationsBrief(workspaceSlug)");
    expect(action).not.toContain("result.value.requests");
    expect(action).not.toContain("result.value.invoices");
    expect(action).not.toContain("result.value.snapshot");
  });

  it("never permits provider response extras into the verified priority DTO", () => {
    const result = parseVerifiedOwnerBrief({
      ok: true, model: "configured-model",
      source: "AUTHORIZED_SAVED_WORKSPACE_COUNTS",
      brief: "Review saved requests.", facts: { ...empty, openRequests: 2 },
      customerName: "PRIVATE USER", creditCard: "PRIVATE PAYMENT",
    });
    expect(result?.facts.openRequests).toBe(2);
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE USER|PRIVATE PAYMENT/);
  });
});
