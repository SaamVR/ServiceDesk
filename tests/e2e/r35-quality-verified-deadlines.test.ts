import { describe, expect, it } from "vitest";
import {
  isOverdueQualityCase, prioritizeQualityFollowUp,
  qualityQueueCount, filterQualityQueue,
} from "../../src/features/operations/quality-queue";

const open=(id:string,dueAt:string)=>({id,state:"OPEN",summary:"Review original evidence",dueAt});

describe("R35 L07 quality case deadline provenance and civil-time safety",()=>{
  const at="2026-10-18T06:00:00Z";
  it("rejects unzoned and impossible saved due dates rather than fabricating overdue alerts",()=>{
    for(const dueAt of [
      "2026-02-30T10:00:00Z", "2026-04-31T10:00:00Z",
      "2026-02-29T10:00:00Z", "2026-10-10T10:00:00",
      "2026-10-10 10:00:00", "2026-10-10T24:00:00Z",
      "2026-10-10T10:00:00+14:30","not-a-date",
    ]) {
      expect(isOverdueQualityCase(open("bad",dueAt),at)).toBe(false);
      expect(qualityQueueCount([open("bad",dueAt)],at).overdue).toBe(0);
    }
  });
  it("does not label an issue overdue with an invalid snapshot as-of timestamp",()=>{
    const caseItem=open("case","2026-10-10T10:00:00Z");
    for(const snap of ["2026-10-18T06:00:00","2026-02-30T06:00:00Z",
      "2026-10-18","2026-10-18T06:00:00+19:00"]) {
      expect(isOverdueQualityCase(caseItem,snap)).toBe(false);
      expect(filterQualityQueue([caseItem],"overdue","",undefined,snap)).toEqual([]);
    }
  });
  it("compares explicit offsets by absolute instant with strict < boundary",()=>{
    const atLocal="2026-10-18T09:00:00+03:00"; // 06:00Z
    expect(isOverdueQualityCase(open("exact","2026-10-18T06:00:00Z"),atLocal)).toBe(false);
    expect(isOverdueQualityCase(open("earlier","2026-10-18T05:59:59Z"),atLocal)).toBe(true);
    expect(isOverdueQualityCase(open("later","2026-10-18T06:00:01Z"),atLocal)).toBe(false);
    expect(isOverdueQualityCase({ ...open("done","2026-10-17T06:00:00Z"),state:"RESOLVED" },atLocal)).toBe(false);
    expect(isOverdueQualityCase(open("leap","2024-02-29T10:00:00+05:45"),atLocal)).toBe(true);
  });
  it("orders trusted genuine deadlines first, then uncertain timestamps last",()=>{
    const cases=[open("bad","2026-02-30T00:00:00Z"),
      open("future","2026-10-19T00:00:00Z"),
      open("past","2026-10-17T00:00:00Z"),
      open("naive","2026-10-16T00:00:00")];
    expect(prioritizeQualityFollowUp(cases,at).map(x=>x.id))
      .toEqual(["past","future","bad","naive"]);
    expect(cases[0].id).toBe("bad");
  });
});
