import {readFileSync} from "node:fs";
import {join} from "node:path";
import {describe,expect,it} from "vitest";
import {automationPlaybooks} from "../../src/features/operations/automation-playbooks";
import {filterAutomationPlaybooks} from "../../src/features/operations/automation-playbook-finder";

const read=(p:string)=>readFileSync(join(process.cwd(),p),"utf8");
describe("R50 owner bulk starter filter and selection independence",()=>{
 it("filters only trusted internal-attention templates by category and review severity",()=>{
  const items=filterAutomationPlaybooks(automationPlaybooks,{
   search:"quote",category:"Quoting",severity:"WARNING",
  });
  expect(items.length).toBeGreaterThan(0);
  expect(items.every(p=>p.category==="Quoting"&&p.severity==="WARNING")).toBe(true);
  expect(items.every(p=>p.name.toLowerCase().includes("quote")||
   p.description.toLowerCase().includes("quote")||p.actionDetail.toLowerCase().includes("quote")||
   p.eventType.toLowerCase().includes("quote")||p.code.toLowerCase().includes("quote"))).toBe(true);
 });
 it("does not alter selected starters outside visible search results",()=>{
  const ui=read("src/features/operations/OwnerStarterBatchWorkbench.tsx");
  expect(ui).toContain("const visible=filterAutomationPlaybooks(");
  expect(ui).toContain("visible.map(item=>");
  expect(ui).toContain("const [selected,setSelected]=useState<string[]>([]);");
  expect(ui).toContain("const selectedIds=[...selected];");
  expect(ui).toContain("selected.length>=12");
  expect(ui).toContain("selected.length} selected across all categories.");
  expect(ui).not.toContain("setSelected(visible");
 });
 it("keeps filter UI keyboard and mobile accessible without introducing provider effects",()=>{
  const ui=read("src/features/operations/OwnerStarterBatchWorkbench.tsx");
  const css=read("src/features/operations/OwnerStarterBatchWorkbench.module.css");
  expect(ui).toContain('type="search" autoComplete="off"');
  expect(ui).toContain('aria-live="polite"');
  expect(ui).toContain("Reset filters");
  expect(css).toContain(".filters");
  expect(css).toContain("min-height:44px");
  expect(css).toContain("@media(max-width:540px)");
  expect(ui).not.toContain("sendCustomerMessage(");
  expect(ui).not.toContain("callAiModel(");
  expect(ui).not.toContain("publishOperationalWorkflowVersion(");
 });
});
