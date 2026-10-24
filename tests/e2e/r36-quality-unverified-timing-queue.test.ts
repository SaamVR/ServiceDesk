import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {
  filterQualityQueue,isOverdueQualityCase,isUnverifiedQualityTiming,
  qualityQueueCount,qualityQueueHref,normalizeQualityQueue,
} from "../../src/features/operations/quality-queue";

const at="2026-10-18T06:00:00Z";
const rows=[
  {id:"missing",state:"OPEN",summary:"No due evidence"},
  {id:"invalid",state:"IN_REVIEW",summary:"Invalid due evidence",dueAt:"2026-02-30T03:00:00Z"},
  {id:"valid-future",state:"OPEN",summary:"Scheduled review",dueAt:"2026-10-19T09:00:00Z"},
  {id:"valid-past",state:"IN_REVIEW",summary:"Overdue repair",dueAt:"2026-10-17T09:00:00Z"},
  {id:"resolved",state:"RESOLVED",summary:"Closed historical issue"},
];
describe("R36 human triage of missing/untrusted quality timing",()=>{
  it("exposes separate missing/invalid timing queue without labelling it overdue",()=>{
    expect(qualityQueueCount(rows,at)).toMatchObject({
      all:5,overdue:1,unverified:2,resolved:1,
    });
    expect(filterQualityQueue(rows,"unverified","",undefined,at).map(x=>x.id))
      .toEqual(["missing","invalid"]);
    expect(filterQualityQueue(rows,"overdue","",undefined,at).map(x=>x.id))
      .toEqual(["valid-past"]);
    expect(isOverdueQualityCase(rows[1],at)).toBe(false);
    expect(isUnverifiedQualityTiming(rows[1],at)).toBe(true);
    expect(isUnverifiedQualityTiming(rows[4],at)).toBe(false);
  });
  it("marks all unresolved timing unverified when the authenticated snapshot clock is invalid",()=>{
    const current=qualityQueueCount(rows,"2026-02-30T06:00:00Z");
    expect(current.overdue).toBe(0);
    expect(current.unverified).toBe(4);
    expect(filterQualityQueue(rows,"unverified","",undefined,
      "2026-02-30T06:00:00Z").map(x=>x.id)).toEqual([
      "missing","invalid","valid-future","valid-past",
    ]);
  });
  it("preserves filtering, route links and visible operator warning",()=>{
    expect(normalizeQualityQueue("unverified")).toBe("unverified");
    expect(qualityQueueHref("unverified","incident")).toBe("?queue=unverified&q=incident");
    const ui=readFileSync(join(process.cwd(),
      "src/features/operations/QualityQueueFilters.tsx"),"utf8");
    expect(ui).toContain("counts.unverified > 0");
    expect(ui).toContain("Review unverified timing");
    expect(ui).toContain("This does not prove they are overdue or safe to defer");
    expect(ui).toContain('role="status"');
  });
});