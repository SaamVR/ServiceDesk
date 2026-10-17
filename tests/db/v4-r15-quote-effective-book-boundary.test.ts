import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {persistedPriceBookInstant} from "../../src/server/core/operational-quote-rate-card";
const zero="2026-10-17T00:00:00Z";
describe("R15 persisted quote effective price-book time",()=>{
 it("accepts real UTC and PostgreSQL timezone-offset instants",()=>{
  expect(persistedPriceBookInstant(zero)).toBe(Date.parse(zero));
  expect(persistedPriceBookInstant("2026-10-17T06:00:00.123456+06:00")).toBe(Date.parse("2026-10-17T00:00:00.123Z"));
  expect(persistedPriceBookInstant("2024-02-29T12:13:14+00:00")).toBeGreaterThan(0);
 });
 it("rejects date-only/local timestamps, normalized invalid dates and misleading offset",()=>{
  for(const v of [undefined,null,true,{},[],0,"2026-10-17","2026-10-17T00:00:00",
   "2026-02-30T00:00:00Z","2025-02-29T00:00:00Z",
   "2026-10-17T25:00:00Z","2026-10-17T01:60:00Z",
   "2026-10-17T01:02:60Z","2026-10-17T00:00:00+14:30",
   "2026-10-17T00:00:00+25:00","2026-10-17T00:00:00Z extra"])
    expect(persistedPriceBookInstant(v),String(v)).toBeNull();
 });
 it("enforces the same strict timestamp read in the actual tenant rate loader",()=>{
  const src=readFileSync(join(process.cwd(),"src/server/core/operational-quote-rate-card.ts"),"utf8");
  expect(src).toContain("books.data.some(book =>");
  expect(src).toContain("persistedPriceBookInstant(book.starts_at) === null");
  expect(src).toContain('QUOTE_RATE_BOOK_UNAVAILABLE');
  expect(src).not.toContain("Date.parse(book.starts_at)");
 });
});
