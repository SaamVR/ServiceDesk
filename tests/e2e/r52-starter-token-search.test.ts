import { describe, expect, it } from "vitest";
import { automationPlaybooks } from "../../src/features/operations/automation-playbooks";
import { filterAutomationPlaybooks } from "../../src/features/operations/automation-playbook-finder";

const run = (search: string, category: "All" | "Quoting" | "Intake" = "All") =>
  filterAutomationPlaybooks(automationPlaybooks, {
    search, category, severity: "Any",
  });

describe("R52 automation starter punctuation-aware local discovery", () => {
  it("matches visual dashes, ASCII dashes and machine underscored service codes", () => {
    for (const query of ["move-out", "move out", "MOVE_OUT", "move—out", "move–out"]) {
      expect(run(query, "Quoting").map(p => p.id)).toContain("quote-moveout");
    }
  });

  it("requires all terms inside the same rule and honors the selected category", () => {
    const matching = run("move out warning", "Quoting");
    expect(matching.map(p => p.id)).toContain("quote-moveout");
    expect(matching.every(p => p.category === "Quoting")).toBe(true);
    expect(run("move out", "Intake").map(p => p.id)).not.toContain("quote-moveout");
    expect(run("moveout critical", "Quoting")).toEqual([]);
  });

  it("preserves untouched immutable starter catalogue and blank query behavior", () => {
    expect(run("")).toEqual(automationPlaybooks);
    expect(run("   ")).toEqual(automationPlaybooks);
    expect(run("warning")).toEqual(run("WARNING"));
    expect(automationPlaybooks).toHaveLength(27);
  });

  it("fails closed on malformed client search input rather than throwing", () => {
    for (const invalid of [null, undefined, {}, [], 123]) {
      expect(filterAutomationPlaybooks(automationPlaybooks, {
        search: invalid as string, category: "All", severity: "Any",
      })).toEqual([]);
    }
  });
});
