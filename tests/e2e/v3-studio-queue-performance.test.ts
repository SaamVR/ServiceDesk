import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { indexCurrentQuoteByRequest, indexStaffById } from "@/features/operations/staff-snapshot-index";

describe("operational queue lookup performance", () => {
  it("preserves first matching record as Array.find did", () => {
    const rows = [{ id: "same", title: "first" }, { id: "same", title: "second" }];
    expect(indexStaffById(rows).get("same")?.title).toBe("first");
  });
  it("rejects tied newest versions regardless of row order, but accepts a later unique version", () => {
    const quotes = [
      { requestId: "r1", version: 2, status: "APPROVED", id: "old" },
      { requestId: "r2", version: 1, status: "SENT", id: "r2" },
      { requestId: "r1", version: 5, status: "SUPERSEDED", id: "superseded" },
      { requestId: "r1", version: 3, status: "DRAFT", id: "latest" },
      { requestId: "r1", version: 3, status: "DRAFT", id: "duplicate" },
    ];
    // Two unsuperseded same-highest versions provide no authoritative
    // current offer; previous first-row selection depended on SQL row order.
    expect(indexCurrentQuoteByRequest(quotes).has("r1")).toBe(false);
    expect(indexCurrentQuoteByRequest([...quotes].reverse()).has("r1")).toBe(false);
    expect(indexCurrentQuoteByRequest(quotes).get("r2")?.id).toBe("r2");
    expect(indexCurrentQuoteByRequest(quotes).size).toBe(1);
    const newer={requestId:"r1",version:4,status:"APPROVED",id:"unique-newer"};
    expect(indexCurrentQuoteByRequest([...quotes,newer]).get("r1")?.id).toBe("unique-newer");
    expect(indexCurrentQuoteByRequest([{ requestId: "r3", version: 1, status: "SUPERSEDED" }]).size).toBe(0);
  });

  it("does not rescan every quote for each request count", () => {
    const route = readFileSync(join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"), "utf8");
    const requests = route.slice(route.indexOf("function RequestsView("), route.indexOf("function QuotesView("));
    expect(requests).toContain("const quoteByRequestId = indexCurrentQuoteByRequest(data.quotes)");
    expect(requests).toContain("!quoteByRequestId.has(request.id)");
    expect(requests).not.toContain("!data.quotes.some(");
  });

  it("reuses indexed customer, request and crew records from an authorized snapshot", () => {
    const route = readFileSync(join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"), "utf8");
    const inbox = route.slice(route.indexOf("function InboxView("), route.indexOf("function CustomersView("));
    const dispatch = route.slice(route.indexOf("function ScheduleView("), route.indexOf("function JobsView("));
    expect(inbox).toContain("customersById.get(conversation.customerId ??");
    expect(inbox).not.toContain("data.customers.find((item) => item.id === conversation.customerId)");
    expect(dispatch).toContain("const requestById = indexStaffById(data.requests)");
    expect(dispatch).toContain("const crewById = indexStaffById(data.crews)");
    expect(dispatch).toContain("const activeHoldByQuote = new Map");
    expect(dispatch).not.toContain("data.requests.find((item) => item.id === visit.requestId)");
  });
});
