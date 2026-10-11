import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { indexStaffById } from "@/features/operations/staff-snapshot-index";

describe("operational queue lookup performance", () => {
  it("preserves first matching record as Array.find did", () => {
    const rows = [{ id: "same", title: "first" }, { id: "same", title: "second" }];
    expect(indexStaffById(rows).get("same")?.title).toBe("first");
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
