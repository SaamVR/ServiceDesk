import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  normalizeStaffCommandQuery, searchStaffDestinations, buildStaffRecordSearches,
} from "../../src/features/operations/staff-command-search";

const source = readFileSync(join(process.cwd(),
  "src/components/product/StaffCommandPalette.tsx"),"utf8");

describe("R35 L13 direct AI Studio command-navigation lane",()=>{
  it("opens existing authorized Studio route only for relevant nonempty queries",()=>{
    const blank=searchStaffDestinations("owner-demo","");
    expect(blank).toHaveLength(13);
    expect(blank.some(x=>x.href.endsWith("/ai-studio"))).toBe(false);
    const results=searchStaffDestinations("owner-demo","AI Studio");
    expect(results[0]).toMatchObject({
      module:"automations",label:"AI Studio",
      href:"/app/owner-demo/automations/ai-studio",
    });
    expect(searchStaffDestinations("north/branch","model diagnostics")[0].href)
      .toBe("/app/north%2Fbranch/automations/ai-studio");
    expect(searchStaffDestinations("owner-demo","record not found")).toEqual([]);
  });
  it("preserves real module and direct search semantics",()=>{
    expect(searchStaffDestinations("owner-demo","invoice")[0].module).toBe("invoices");
    expect(searchStaffDestinations("owner-demo","",2)).toHaveLength(2);
    expect(searchStaffDestinations("owner-demo","quality")[0].module).toBe("quality");
  });
  it("strips bidi/format controls from navigation and authorized directory deep links",()=>{
    const hidden="\u202E\u200B\u2066";
    expect(normalizeStaffCommandQuery("  AI "+hidden+" Studio  ")).toBe("AI Studio");
    expect(searchStaffDestinations("demo","AI "+hidden+" Studio")[0].label)
      .toBe("AI Studio");
    const link=buildStaffRecordSearches("demo","  case "+hidden+" 123")[0].href;
    expect(link).toContain("search=case%20123");
    expect(link).not.toContain("%E2%80%AE");
    expect(normalizeStaffCommandQuery("  বাংলা   কাজ  ")).toBe("বাংলা কাজ");
  });
  it("never splits Unicode code points or builds an invalid escaped search URI",()=>{
    const emoji="😀";
    const long="a".repeat(99)+emoji+" more";
    expect(normalizeStaffCommandQuery(long)).toBe("a".repeat(99)+emoji);
    expect(buildStaffRecordSearches("owner-demo",long)[0].href)
      .toContain(encodeURIComponent("a".repeat(99)+emoji));
    expect(normalizeStaffCommandQuery("বাংলা 😀 কাজ")).toBe("বাংলা 😀 কাজ");
    expect(normalizeStaffCommandQuery("bad\uD800 query")).toBe("bad query");
    expect(normalizeStaffCommandQuery("bad\uDC00 query")).toBe("bad query");
    expect(()=>buildStaffRecordSearches("owner-demo","bad\uD800 query")).not.toThrow();
    expect(normalizeStaffCommandQuery("😀".repeat(110))).toBe("😀".repeat(100));
  });
  it("uses unique route identity and closes outdated tenant navigation",()=>{
    expect(source).toContain("key={destination.href}");
    expect(source).toContain("}, [pathname, workspace]);");
    expect(source).not.toContain("credentials:"); // no in-dialog data fetch
    expect(source).not.toContain("fetch(");
    expect(source).toContain('aria-current={pathname === destination.href ? "page" : undefined}');
  });
});
