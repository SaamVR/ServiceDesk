import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { CatalogReadinessBanner } from "../../src/features/operations/CatalogReadinessBanner";

describe("First-run quote readiness", () => {
  it("shows a truthful blocker and owner setup path when no services exist", () => {
    const html = renderToStaticMarkup(createElement(CatalogReadinessBanner, {
      workspaceSlug: "fictional-cleaning", serviceCatalog: [],
    }));
    expect(html).toContain("Quoting setup incomplete");
    expect(html).toContain("no active cleaning service");
    expect(html).toContain("/app/fictional-cleaning/settings");
    expect(html).toContain("No sample price or provider status is being invented");
  });

  it("does not invent a failure when the catalog was not loaded, or contains an active service", () => {
    expect(renderToStaticMarkup(createElement(CatalogReadinessBanner, { workspaceSlug: "test" }))).toBe("");
    expect(renderToStaticMarkup(createElement(CatalogReadinessBanner, {
      workspaceSlug: "test",
      serviceCatalog: [{ id: "svc-1", code: "DEEP", name: "Deep cleaning", active: true, requiresReview: false, updatedAt: "2026-10-12" }],
    }))).toBe("");
  });

  it("shows a real warning for active unrelated services and clears it only for a supported active cleaning service", () => {
    const unrelated = {
      id:"svc-window", code:"WINDOWS", name:"Window cleaning",
      active:true, requiresReview:false, updatedAt:"2026-10-17",
    };
    const warning = renderToStaticMarkup(createElement(CatalogReadinessBanner, {
      workspaceSlug:"fictional-cleaning",
      serviceCatalog:[unrelated],
    }));
    expect(warning).toContain("no active cleaning service");
    expect(warning).toContain("Unrelated active services do not establish cleaning quote readiness");
    expect(warning).toContain("No sample price or provider status is being invented");
    const disabled = renderToStaticMarkup(createElement(CatalogReadinessBanner, {
      workspaceSlug:"fictional-cleaning",
      serviceCatalog:[unrelated, { ...unrelated, id:"svc-deep", code:"DEEP", active:false }],
    }));
    expect(disabled).toContain("no active cleaning service");
    const configured = renderToStaticMarkup(createElement(CatalogReadinessBanner, {
      workspaceSlug:"fictional-cleaning",
      serviceCatalog:[unrelated, { ...unrelated, id:"svc-deep", code:"DEEP" }],
    }));
    expect(configured).toBe("");
  });

  it("exposes saved catalog readiness in both Today and Requests without altering pricing authority", () => {
    const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
    const today = read("src/features/operations/StaffOverviewDashboard.tsx");
    const ops = read("src/features/operations/OperationalProductRoute.tsx");
    expect(today).toContain("serviceCatalog={snapshot.serviceCatalog}");
    expect(ops).toContain("serviceCatalog={data.serviceCatalog}");
    expect(ops).toContain("calculateOperationalQuote(workspaceSlug, requestId,");
    expect(ops).toContain('formData.get("ovenConfirmedByStaff") === "yes"');
  });
});
