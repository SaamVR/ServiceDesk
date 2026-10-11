import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  directoryRecordHref,
  filterDirectoryRows,
  normalizeDirectoryQuery,
} from "../../src/features/operations/record-directory";
import { RecordDirectorySearch } from "../../src/features/operations/RecordDirectorySearch";
import { countStaffBy, indexStaffById } from "../../src/features/operations/staff-snapshot-index";

const rows = [
  { id: "first", name: "Avery Home", channel: "WHATSAPP", status: "READY" },
  { id: "second", name: "Briar House", channel: "EMAIL", status: "SENT" },
];

describe("V3 staff operational record discovery", () => {
  it("builds linear first-match snapshot indexes without mutating authorized records", () => {
    const customers = [{ id: "first", name: "Original" }, { id: "first", name: "Duplicate" }, { id: "other", name: "Other" }];
    const indexed = indexStaffById(customers);
    expect(indexed.get("first")?.name).toBe("Original");
    expect(indexed.size).toBe(2);
    expect(countStaffBy([{ customerId: "first" }, { customerId: "first" }, { customerId: undefined }], (row) => row.customerId)).toEqual(new Map([["first", 2]]));
    expect(customers).toHaveLength(3);
  });

  it("filters authorized record properties without mutating the snapshot", () => {
    const result = filterDirectoryRows(rows, "  briar ", (row) => [row.name, row.channel, row.status]);
    expect(result.map((row) => row.id)).toEqual(["second"]);
    expect(filterDirectoryRows(rows, "email", (row) => [row.name, row.channel, row.status])).toEqual([rows[1]]);
    expect(filterDirectoryRows(rows, "unused", (row) => [row.name])).toEqual([]);
    expect(filterDirectoryRows(rows, "", (row) => [row.name])).toEqual(rows);
    expect(rows[0].id).toBe("first");
  });

  it("matches multiple operator terms across different authorized record fields", () => {
    expect(filterDirectoryRows(rows, "briar email", (row) => [row.name, row.channel, row.status]).map((row) => row.id))
      .toEqual(["second"]);
    expect(filterDirectoryRows(rows, "READY WHATSAPP", (row) => [row.name, row.channel, row.status]).map((row) => row.id))
      .toEqual(["first"]);
    expect(filterDirectoryRows(rows, "briar ready", (row) => [row.name, row.channel, row.status])).toEqual([]);
    expect(filterDirectoryRows(rows, "house sent", (row) => [row.name, row.channel, row.status]).map((row) => row.id))
      .toEqual(["second"]);
    expect(filterDirectoryRows(rows, "aVERY  home", (row) => [row.name]).map((row) => row.id))
      .toEqual(["first"]);
  });

  it("bounds search input and safely encodes route + selection state", () => {
    expect(normalizeDirectoryQuery("   a   b  ")).toBe("a b");
    expect(normalizeDirectoryQuery("a".repeat(500)).length).toBe(100);
    expect(directoryRecordHref("request", "r/1&2", " Avery & Co ")).toBe("?request=r%2F1%262&search=Avery+%26+Co");
    expect(directoryRecordHref("customer", "c1")).toBe("?customer=c1");
  });

  it("renders a keyboard-usable GET search with an accurate empty-state counter", () => {
    const html = renderToStaticMarkup(createElement(RecordDirectorySearch, {
      label: "requests", search: "briar", visible: 0, total: 8,
    }));
    expect(html).toContain('role="search"');
    expect(html).toContain('type="search"');
    expect(html).toContain('name="search"');
    expect(html).toContain("0 of 8 records");
    expect(html).toContain("Clear");
  });

  it("wires real tenant-authorized customers, requests, quotes and invoices to deep-link search", () => {
    const source = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    for (const key of ["customer", "request", "quote", "invoice"]) {
      expect(route).toContain('directoryRecordHref("' + key + '"');
    }
    for (const key of ["customers", "requests", "quotes", "invoices"]) {
      expect(source("src/app/app/[workspace]/" + key + "/page.tsx")).toContain("searchQuery={query.search}");
    }
    expect(route).toContain("No matching customers");
    expect(route).toContain("No matching requests");
    expect(route).toContain("No matching quotes");
    expect(route).toContain("No matching invoices");
    expect(route).toContain("countStaffBy(data.properties");
    expect(route).toContain("indexStaffById(data.crews)");
  });
});
