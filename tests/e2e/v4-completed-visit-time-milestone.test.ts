import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { isVerifiedCompletedVisit } from "../../src/server/workflows/verified-visit-completion";

const visit={status:"COMPLETED",starts_at:"2026-10-15T09:00:00Z",
  ends_at:"2026-10-15T11:00:00Z"};
const now=Date.parse("2026-10-15T10:00:00Z");
describe("owner VISIT_COMPLETED automation source time proof",()=>{
  test("accepts actually started completed visit even if schedule ends later",()=>{
    expect(isVerifiedCompletedVisit(visit,now)).toBe(true);
    expect(isVerifiedCompletedVisit({...visit,ends_at:"2026-10-15T09:30:00Z"},now)).toBe(true);
  });
  test("refuses future, reverse, missing or forged completion schedule",()=>{
    const patches=[
      {status:"SCHEDULED"},{starts_at:"2026-10-16T09:00:00Z"},
      {ends_at:"2026-10-15T08:00:00Z"},
      {ends_at:"2026-10-15T09:00:00Z"},
      {starts_at:"not-a-date"},{starts_at:null},
      {ends_at:"2026-10-15"},{starts_at:12},
    ];
    for (const patch of patches)
      expect(isVerifiedCompletedVisit({...visit,...patch},now)).toBe(false);
  });
  test("verifies saved timestamp before evaluating owner workflow rules",()=>{
    const src=readFileSync(join(process.cwd(),
      "src/server/workflows/owner-operational-automation.ts"),"utf8");
    const i=src.indexOf('eventType === "VISIT_COMPLETED"');
    const part=src.slice(i,src.indexOf('eventType === "INVOICE_PAID"',i));
    expect(part).toContain('select("id,request_id,branch_id,status,starts_at,ends_at")');
    expect(part).toContain("isVerifiedCompletedVisit(row.data)");
    expect(src.indexOf("isVerifiedCompletedVisit(row.data)"))
      .toBeLessThan(src.indexOf('from("workflow_rules")'));
  });
});
