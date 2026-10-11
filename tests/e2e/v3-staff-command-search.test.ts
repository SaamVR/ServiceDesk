import { describe, expect, it } from "vitest";
import { buildStaffModuleHref } from "../../src/features/operations/staff-modules";
import { searchStaffDestinations } from "../../src/features/operations/staff-command-search";

describe("V3 staff command palette navigation model", () => {
  it("lists real routes in deterministic workday-first order", () => {
    const matches = searchStaffDestinations("west-side", "");
    expect(matches.map(entry => entry.module).slice(0, 4)).toEqual(["overview", "inbox", "schedule", "jobs"]);
    expect(matches).toHaveLength(13);
    for (const entry of matches) expect(entry.href).toBe(buildStaffModuleHref("west-side", entry.module));
  });
  it("never fabricates a customer search result or provider action", () => {
    expect(searchStaffDestinations("west-side", "invoice").map(entry => entry.module)).toEqual(["invoices"]);
    expect(searchStaffDestinations("west-side", "person@example.com")).toEqual([]);
  });
  it("prioritizes direct labels over incidental descriptions", () => {
    expect(searchStaffDestinations("west-side", "jobs")[0].module).toBe("jobs");
    expect(searchStaffDestinations("west-side", "inbox")[0].module).toBe("inbox");
  });
  it("supports multiword matching without leaking or decoding untrusted workspace slugs", () => {
    expect(searchStaffDestinations("north/office", "service quality")[0].href)
      .toBe("/app/north%2Foffice/quality");
  });
  it("applies a stable bounded limit to every query", () => {
    expect(searchStaffDestinations("north", "", 2)).toHaveLength(2);
    expect(searchStaffDestinations("north", "", -5)).toHaveLength(0);
    expect(searchStaffDestinations("north", "", Number.POSITIVE_INFINITY)).toHaveLength(13);
  });
  it("does not match extra spaces or depend on letter casing", () => {
    expect(searchStaffDestinations("north", "   INBOX  ")[0].module).toBe("inbox");
  });
});
