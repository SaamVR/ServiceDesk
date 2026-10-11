import { describe,expect,it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const read=(p:string)=>readFileSync(join(process.cwd(),p),"utf8");
describe("Studio OS distinct finance workspaces",()=>{
 it("shows customer collections by default, commercial contracts only when selected",()=>{
  const route=read("src/features/operations/OperationalProductRoute.tsx");
  expect(route).toContain('invoiceSurface === "commercial"');
  expect(route).toContain('module === "invoices" && invoiceSurface === "commercial"');
  expect(route).toContain('aria-label="Invoice workspace views"');
  expect(route).toContain("CommercialBillingWorkspace workspaceSlug={workspaceSlug}");
  expect(route).toContain("InvoiceCollectionFilters queue={queue}");
 });
 it("returns commercial form decisions back to the matching workspace",()=>{
  const finance=read("src/features/commercial/CommercialBillingWorkspace.tsx");
  const page=read("src/app/app/[workspace]/invoices/page.tsx");
  expect(finance).toContain('"/invoices?surface=commercial&"');
  expect(page).toContain("invoiceSurface={query.surface}");
  expect(page).toContain("selectedInvoiceQueue={query.queue}");
 });
 it("uses mobile-responsive keyboard-accessible invoice navigation",()=>{
  const css=read("src/features/operations/OperationalProductRoute.module.css");
  expect(css).toContain(".invoiceSurfaceNav a:focus-visible");
  expect(css).toContain(".invoiceSurfaceNav a[aria-current=\"page\"]");
  expect(css).toContain("@media(max-width:680px)");
 });
});
