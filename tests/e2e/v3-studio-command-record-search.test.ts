import { describe,expect,it } from "vitest";
import { buildStaffRecordSearches } from "@/features/operations/staff-command-search";
import { readFileSync } from "node:fs";
import { join } from "node:path";
describe("Studio OS command palette authorized record lookup",()=>{
 it("offers only existing authenticated filtered directories without fetching or inventing records",()=>{
  const targets=buildStaffRecordSearches("west-side","Jane Smith");
  expect(targets.map(x=>x.module)).toEqual(["inbox","customers","requests","quotes","jobs","quality","invoices"]);
  expect(targets[1].href).toBe("/app/west-side/customers?search=Jane%20Smith");
  expect(targets[4].href).toBe("/app/west-side/jobs?search=Jane%20Smith");
  expect(targets[5].href).toBe("/app/west-side/quality?q=Jane%20Smith");
  expect(targets[6].href).toBe("/app/west-side/invoices?search=Jane%20Smith");
 });
 it("encodes untrusted names, workspace slug and strips unsafe controls",()=>{
  const query=buildStaffRecordSearches("a&b","  abc\n<script>  ");
  expect(query[0].href).toContain("/app/a%26b/inbox?search=abc%20%3Cscript%3E");
  expect(query.every(x=>!x.href.includes("<"))).toBe(true);
  expect(buildStaffRecordSearches("a","x")).toEqual([]);
  expect(buildStaffRecordSearches("a"," ")).toEqual([]);
  expect(decodeURIComponent(buildStaffRecordSearches("a","x".repeat(250))[1].href.split("search=")[1])).toHaveLength(100);
  expect(buildStaffRecordSearches("west/branch","Review overdue")[5].href).toBe("/app/west%2Fbranch/quality?q=Review%20overdue");
 });
 it("retains keyboard movement, focus and clear limits for actual routes",()=>{
  const component=readFileSync(join(process.cwd(),"src/components/product/StaffCommandPalette.tsx"),"utf8");
  expect(component).toContain("maxLength={100}");
  expect(component).toContain("buildStaffRecordSearches(workspace, query)");
  expect(component).toContain('aria-label="Search authorized workspace records"');
  expect(component).toContain("handleResultKeyDown");
  expect(component).toContain("↑ ↓ to navigate");
 });
});
