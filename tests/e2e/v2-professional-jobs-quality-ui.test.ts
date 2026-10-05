import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V2 professional jobs and quality UI", () => {
  it("makes jobs a field-operations queue with selected-record context", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    expect(route).toContain("Field jobs workspace");
    expect(route).toContain("Job operation summary");
    expect(route).toContain("Evidence & notes");
    expect(route).toContain("selectedCustomer?.displayName");
    expect(route).toContain("selectedProperty?.label");
    expect(route).toContain("selectedCrew?.name");
  });

  it("preserves authoritative visit transition, note, and checklist actions", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    expect(route).toContain("transitionOperationalVisit");
    expect(route).toContain("addOperationalVisitNote");
    expect(route).toContain("setOperationalChecklistItem");
    expect(route).toContain("SUBMIT_REVIEW");
    expect(route).toContain("selectedReviewEvidenceReady");
  });

  it("turns quality into a review center tied back to the real visit", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    expect(route).toContain("Quality review workspace");
    expect(route).toContain("Service context");
    expect(route).toContain("Field proof");
    expect(route).toContain("applyOperationalQualityAction");
    expect(route).toContain("Request customer review");
    expect(route).toContain("Open job →");
  });

  it("has responsive queue/detail contracts for desktop and mobile", () => {
    const css = source("src/features/operations/OperationalProductRoute.module.css");
    expect(css).toContain("jobsWorkspace");
    expect(css).toContain("qualityWorkspace");
    expect(css).toContain("grid-template-columns:300px minmax(0,1fr)");
    expect(css).toContain("@media(max-width:760px)");
  });
});
