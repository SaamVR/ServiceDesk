import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { operationalJourneyCounts } from "../../src/features/operations/operational-journey-counts";

describe("Studio OS live workflow decision badges", () => {
  it("counts authorized actionable work and excludes closed visits and paid balances", () => {
    const snapshot = {
      conversations: [{ id: "a", customerId: "c1", handoverActive: false }],
      messages: [{ conversationId: "a", direction: "INBOUND", createdAt: "2026-10-11T08:00:00Z" }],
      customers: [{ id: "c1" }],
      requests: [{ status: "NEW" }, { status: "ACCEPTED" }],
      quotes: [
        { id: "q-old", requestId: "r1", version: 1, status: "APPROVED" },
        { id: "q-current", requestId: "r1", version: 2, status: "SENT" },
        { id: "q-ready", requestId: "r2", version: 1, status: "APPROVED" },
      ],
      visits: [
        { crewId: undefined, status: "CONFIRMED" },
        { crewId: "crew-1", status: "EN_ROUTE" },
        { crewId: undefined, status: "COMPLETED" },
      ],
      invoices: [
        { balanceMinor: 2000, currency: "USD", status: "ISSUED", quoteId: "customer-q1" },
        { balanceMinor: 0, currency: "USD", status: "PAID", quoteId: "customer-q2" },
        { balanceMinor: 9000, currency: "USD", status: "ISSUED", commercialBillingDraftId: "contract-billing-1" },
        { balanceMinor: 5000, currency: "USD", status: "DRAFT", quoteId: "customer-draft" },
      ],
    };
    const counts = operationalJourneyCounts(snapshot as unknown as Parameters<typeof operationalJourneyCounts>[0]);
    expect(counts).toEqual({ inbox: 1, requests: 1, quotes: 1, schedule: 1, jobs: 1, invoices: 1 });
  });
  it("excludes commercial contract receivables from the customer-collections navigation badge", () => {
    const source = readFileSync(join(process.cwd(), "src/features/operations/operational-journey-counts.ts"), "utf8");
    expect(source).toContain('snapshot.invoices.filter((invoice) => Boolean(invoice.quoteId))');
  });

  it("keeps counts behind tenant authorization and labels them accurately", () => {
    const source = readFileSync(join(process.cwd(),
      "src/features/operations/OperationalProductRoute.tsx"), "utf8");
    expect(source).toContain("result.ok && operationalJourney.some");
    expect(source).toContain("data={result.value}");
    expect(source).toContain("counts[item.module]");
    expect(source).toContain('aria-label={counts[item.module]');
    for (const label of ["need reply", "need intake", "ready to send", "need crew", "underway", "open balances"]) {
      expect(source).toContain(label);
    }
  });
});
