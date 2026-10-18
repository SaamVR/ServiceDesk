import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {buildDispatchCoverageWeek} from "../../src/features/operations/dispatch-coverage-week";

const crews=[
  {id:"active",branchId:"north",active:true},
  {id:"inactive",branchId:"north",active:false},
  {id:"other",branchId:"south",active:true},
  {id:"missing-scope",active:true},
];
const visit=(crewId:string|undefined,branchId="north")=>({
  status:"CONFIRMED",crewId,branchId,startAt:"2026-10-18T09:00:00Z",
});
const read=(path:string)=>readFileSync(join(process.cwd(),path),"utf8");
describe("R36 verified real crew assignments on dispatch workload calendar",()=>{
  it("distinguishes active same-branch assignment from missing/inactive/cross-branch crew",()=>{
    const visits=[
      visit("active"),visit(undefined),visit("inactive"),visit("other"),
      visit("unknown"),visit("missing-scope"),visit("active","south"),
      {...visit("active"),branchId:undefined},
      {...visit("unknown"),status:"CANCELLED"},
    ];
    const dates=buildDispatchCoverageWeek(visits,
      "2026-10-18T06:00:00Z","UTC","2026-10-18",crews);
    expect(dates).toHaveLength(7);
    expect(dates[0]).toMatchObject({
      key:"2026-10-18",total:8,unassigned:1,unverifiedCrew:6,
    });
    expect(dates[0].total-dates[0].unassigned-dates[0].unverifiedCrew)
      .toBe(1);
    expect(dates.slice(1).every(day=>day.total===0 && day.unverifiedCrew===0))
      .toBe(true);
  });
  it("does not invent roster authorization when a legacy builder caller omits the roster",()=>{
    const dates=buildDispatchCoverageWeek(
      [visit("unknown"),visit(undefined)],
      "2026-10-18T06:00:00Z","UTC","2026-10-18",
    );
    expect(dates[0]).toMatchObject({total:2,unassigned:1,unverifiedCrew:0});
    // Old callers still report saved crew-ID presence; only the schedule view
    // supplies the saved roster and receives active-crew verification.
  });
  it("binds actual authorized crew roster to the production schedule UI",()=>{
    const route=read("src/features/operations/OperationalProductRoute.tsx");
    const component=read("src/features/operations/DispatchCoverageWeek.tsx");
    const styles=read("src/features/operations/DispatchCoverageWeek.module.css");
    expect(route).toContain("data.workspace.timezone, window.from, data.crews");
    expect(component).toContain("Active crew verified");
    expect(component).toContain("Crew needs verification");
    expect(component).toContain("day.unverifiedCrew");
    expect(component).toContain("missing crew");
    expect(component).toContain("verify assignment");
    expect(component).toContain("day.unassigned > 0 && day.unverifiedCrew > 0");
    expect(component).toContain("assignments needing verification");
    expect(styles).toContain(".meterUnverified");
    expect(styles).toContain("@media(max-width:700px)");
  });
  it("never equates a checked crew ID with free slot availability",()=>{
    const component=read("src/features/operations/DispatchCoverageWeek.tsx");
    expect(component).toContain("not available capacity");
    expect(component).toContain("Read-only workload counts.");
    expect(component).not.toContain("confirmCapacity(");
    expect(component).not.toContain("createSlotHold(");
  });
});