import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { filterStudioRecordChoices, verifiedStudioRecordChoices } from "../../src/features/operations/ai-studio-records";

const uuidA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const uuidB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const uuidC = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const source = () => readFileSync(join(process.cwd(), "src/features/operations/AiStudioWorkbench.tsx"), "utf8");
const css = () => readFileSync(join(process.cwd(), "src/features/operations/AiStudioWorkspace.module.css"), "utf8");

describe("Frontend AI Studio keyboard-first authorized record picker", () => {
  // Named fixture avoids excess-property rejection while deliberately testing
  // that private source fields are never serialized into browser choices.
  const rawRecords = [
    {id: uuidA, status:"NEW", customerName:"Private Customer", totalMinor:120000},
    {id: uuidB, status:"PENDING_APPROVAL", phone:"secret phone"},
    {id: uuidC, status:"NEW", address:"secret address"},
    {id:"unsafe<script>",status:"NEW"},
  ];
  const choices = verifiedStudioRecordChoices("Request", rawRecords);
  it("searches within authorized short record labels and UUIDs, without including private notes",()=>{
    expect(filterStudioRecordChoices(choices, "pending approval")).toEqual([choices[1]]);
    expect(filterStudioRecordChoices(choices, "  REQUEST 3 ")).toEqual([choices[2]]);
    expect(filterStudioRecordChoices(choices, uuidA.slice(0,12))).toEqual([choices[0]]);
    expect(filterStudioRecordChoices(choices, "ID bbbbbbbb")).toEqual([choices[1]]);
    expect(filterStudioRecordChoices(choices, "no such customer")).toEqual([]);
    expect(filterStudioRecordChoices(choices, "private")).toEqual([]);
    expect(filterStudioRecordChoices(choices, "")).toEqual(choices);
    expect(choices).toHaveLength(3);
    expect(choices[0].label).toContain("ID aaaaaaaa");
    expect(choices[1].label).toContain("ID bbbbbbbb");
    expect(choices[2].label).toContain("ID cccccccc");
    expect(JSON.stringify(choices)).not.toMatch(/Private Customer|secret phone|secret address|120000/);
  });
  it("shows only the first 8 characters of already-authorized source IDs in accessible labels",()=>{
    const untrustedRecords = [
      {id:uuidA,status:"APPROVED",contact:"PRIVATE CONTACT",note:"SECRET CUSTOMER"},
      {id:uuidB,status:"NEW",moneyMinor:120000},
    ];
    const choices=verifiedStudioRecordChoices("Quote",untrustedRecords);
    expect(choices[0].label).toContain("ID aaaaaaaa");
    expect(choices[0].label).not.toContain(uuidA);
    expect(choices[0].label).not.toContain("PRIVATE CONTACT");
    expect(JSON.stringify(choices)).not.toContain("SECRET CUSTOMER");
    expect(Object.keys(choices[0]).sort()).toEqual(["id","label"]);
  });
  it("does not mutate source selections or broaden the 40-row browser boundary",()=>{
    const before = JSON.stringify(choices);
    const found = filterStudioRecordChoices(choices, "new");
    expect(found).toHaveLength(2);
    found.pop();
    expect(JSON.stringify(choices)).toBe(before);
    const forty = verifiedStudioRecordChoices("Quote", Array.from({length:60}, (_,i)=>({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-"+i.toString(16).padStart(12,"0"), status:"SENT",
    })));
    expect(forty).toHaveLength(40);
    expect(filterStudioRecordChoices(forty, "Quote")).toHaveLength(40);
  });
  it("discloses the 40-choice cap instead of implying a complete tenant-wide search",()=>{
    const client=source();
    const style=css();
    expect(client).toContain("choices.length >= 40");
    expect(client).toContain("Results are not a complete database search");
    expect(client).toContain("loaded record choices shown");
    expect(client).toContain('role="note"');
    expect(client).toContain("Open {mode ===");
    expect(style).toContain(".scopeNotice");
    expect(style).toContain(".scopeNotice a");
  });

  it("uses accessible roving tabs, keyboard arrows and unique linked ARIA ids",()=>{
    const client=source();
    expect(client).toContain('role="tablist"');
    expect(client).toContain('role="tabpanel"');
    expect(client).toContain("const tabsId = useId()");
    expect(client).toContain("ArrowRight");
    expect(client).toContain("ArrowLeft");
    expect(client).toContain("Home");
    expect(client).toContain("End");
    expect(client).toContain("event.preventDefault()");
    expect(client).toContain('tabIndex={mode === "request" ? 0 : -1}');
    expect(client).toContain('tabIndex={mode === "quote" ? 0 : -1}');
    expect(client).toContain("requestTabRef");
    expect(client).toContain("quoteTabRef");
    expect(client).toContain("activateTab(next)");
    expect(client).toContain('htmlFor={tabsId + "-record-select"}');
    expect(client).toContain('id={tabsId + "-record-select"}');
  });
  it("preserves selected scope when filtering without auto-requesting a model or disclosing secrets",()=>{
    const client=source();
    expect(client).toContain("selectedRequest = requests.find");
    expect(client).toContain("selectedQuote = quotes.find");
    expect(client).toContain("visibleChoices = selected");
    expect(client).toContain("filterStudioRecordChoices(choices, recordSearch)");
    expect(client).toContain('type="search"');
    expect(client).toContain('autoComplete="off"');
    expect(client).toContain('aria-live="polite"');
    expect(client).toContain("<AiRequestBrief");
    expect(client).toContain("<AiQuoteReview");
    expect(client).not.toContain("fetch(");
    expect(client).not.toContain("process.env");
    expect(client).not.toContain("autoSubmit");
  });
  it("has responsive search and keyboard-visible focus affordances",()=>{
    const style=css();
    expect(style).toContain(".searchRow");
    expect(style).toContain(".searchInput");
    expect(style).toContain("@media(max-width: 650px)");
    expect(style).toContain(".studio input:focus-visible");
    expect(style).toContain("min-height: 44px");
    expect(style).toContain("prefers-reduced-motion: reduce");
  });
});
