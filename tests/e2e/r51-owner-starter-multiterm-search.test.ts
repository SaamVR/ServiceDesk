import { describe, expect, it } from "vitest";
import { automationPlaybooks } from "../../src/features/operations/automation-playbooks";
import { filterAutomationPlaybooks } from "../../src/features/operations/automation-playbook-finder";

const search = (query: string, category: "All" | "Quoting" | "Intake" = "All",
  severity: "Any" | "INFO" | "WARNING" | "CRITICAL" = "Any") =>
  filterAutomationPlaybooks(automationPlaybooks, {
    search: query, category, severity,
  });

describe("R51 usable, bounded owner multiword automation discovery", () => {
  it("matches multiword queries across the same starter's independent source attributes", () => {
    const found = search("deep warning", "Quoting", "WARNING");
    expect(found.map(item => item.id)).toContain("quote-deep");
    expect(found.every(item => item.category === "Quoting" &&
      item.severity === "WARNING")).toBe(true);
  });

  it("requires all terms in one starter, never merges unrelated matches", () => {
    expect(search("moveout critical", "Quoting")).toEqual([]);
    const found = search("critical exception", "Exceptions", "CRITICAL");
    expect(found.map(item => item.id)).toContain("critical-attention");
    expect(found.every(item =>
      item.category === "Exceptions" && item.severity === "CRITICAL")).toBe(true);
  });

  it("retains single-term, blank, case and whitespace compatibility", () => {
    expect(search(" QUOTE ")).toEqual(search("quote"));
    expect(search("  DEEP    warning ", "Quoting", "WARNING"))
      .toEqual(search("deep warning", "Quoting", "WARNING"));
    expect(search("")).toEqual(automationPlaybooks);
    expect(search("  ")).toEqual(automationPlaybooks);
  });

  it("bounds pathological search input without changing the source catalogue", () => {
    const originalCount = automationPlaybooks.length;
    expect(search("x".repeat(10000))).toEqual([]);
    expect(automationPlaybooks).toHaveLength(originalCount);
    expect(search("warning warning warning")).toEqual(search("warning"));
  });
});
