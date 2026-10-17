import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { automationPlaybooks } from "../../src/features/operations/automation-playbooks";
import { filterAutomationPlaybooks } from "../../src/features/operations/automation-playbook-finder";

const text=(path:string)=>readFileSync(join(process.cwd(),path),"utf8");
describe("SONIC interactive internal workflow starter discovery",()=>{
  it("searches all 27 safe starters deterministically without changing the catalog",()=>{
    const original=JSON.stringify(automationPlaybooks);
    expect(filterAutomationPlaybooks(automationPlaybooks,
      {search:"",category:"All",severity:"Any"})).toHaveLength(27);
    const deep=filterAutomationPlaybooks(automationPlaybooks,
      {search:"deep clean",category:"All",severity:"Any"});
    expect(deep.length).toBeGreaterThan(0);
    expect(deep.every(item=>
      (item.name+" "+item.description).toLowerCase().includes("deep clean"))).toBe(true);
    expect(JSON.stringify(automationPlaybooks)).toBe(original);
  });
  it("constrains area, review severity, zero-result and normalized whitespace",()=>{
    const warning=filterAutomationPlaybooks(automationPlaybooks,
      {search:"  incident ",category:"Field work",severity:"CRITICAL"});
    expect(warning).toHaveLength(1);
    expect(warning[0].id).toBe("incident-visit");
    const none=filterAutomationPlaybooks(automationPlaybooks,
      {search:"does-not-exist",category:"All",severity:"Any"});
    expect(none).toEqual([]);
  });
  it("never initiates AI request, publish or external delivery in discovery component",()=>{
    const browser=text("src/features/operations/AutomationPlaybookBrowser.tsx");
    const route=text("src/features/operations/OperationalProductRoute.tsx");
    expect(route).toContain("<AutomationPlaybookBrowser selectedId={playbook?.id} />");
    expect(browser).toContain('href={"?template=" + encodeURIComponent(item.id)}');
    expect(browser).toContain("automationPlaybookCategories.map(category");
    expect(browser).toContain('aria-live="polite"');
    expect(browser).toContain('type="search"');
    expect(browser).toContain('aria-current={item.id === selectedId ? "page" : undefined}');
    expect(browser).not.toContain("fetch(");
    expect(browser).not.toContain("publishOperationalWorkflowVersion(");
    expect(browser).not.toContain("process.env");
    expect(browser).toContain("Selecting a starter does not save, preview, publish");
  });
  it("provides touch, small-screen, keyboard and reduced-motion affordances",()=>{
    const css=text("src/features/operations/AutomationPlaybookBrowser.module.css");
    expect(css).toContain("min-height:44px");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("@media(max-width:540px)");
    expect(css).toContain("prefers-reduced-motion:reduce");
  });
});
