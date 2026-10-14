import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { isVerifiedAcceptedQuoteMilestone } from "../../src/server/workflows/accepted-quote-milestone";

const saved = {
  status:"ACCEPTED",currency:"USD",subtotal_minor:31000,tax_minor:0,
  total_minor:31000,deposit_minor:7750,balance_minor:23250,duration_minutes:210,
  snapshot:{lineItems:[
    {code:"BASE",description:"Base service",amountMinor:18000,durationMinutes:120},
    {code:"BEDROOM",description:"Bedrooms",amountMinor:9000,durationMinutes:60},
    {code:"BATHROOM",description:"Bathrooms",amountMinor:4000,durationMinutes:30},
  ]},
};
describe("owner QUOTE_ACCEPTED internal workflow monetary preflight",()=>{
  test("requires the genuine persisted and reconciled accepted quote",()=>{
    expect(isVerifiedAcceptedQuoteMilestone(saved)).toBe(true);
  });
  test("rejects fake accepted status, missing lines, tampered deposits, currency and time",()=>{
    for(const patch of [
      {status:"SENT"},{status:"APPROVED"}, {snapshot:{}},{snapshot:null},
      {subtotal_minor:30000},{total_minor:30001},{deposit_minor:7751},
      {balance_minor:23251},{duration_minutes:200},{currency:"usd"},
      {currency:""},{total_minor:Number.POSITIVE_INFINITY},{tax_minor:-1},
    ])expect(isVerifiedAcceptedQuoteMilestone({...saved,...patch})).toBe(false);
  });
  test("workflow confirms tenant source and saved charges before evaluating rules",()=>{
    const source=readFileSync(join(process.cwd(),"src/server/workflows/owner-operational-automation.ts"),"utf8");
    const start=source.indexOf('if (eventType === "QUOTE_ACCEPTED") {');
    const branch=source.slice(start,source.indexOf('} else if (eventType === "VISIT_COMPLETED")',start));
    expect(branch).toContain('.eq("workspace_id",workspace.id)');
    expect(branch).toContain("subtotal_minor,tax_minor,total_minor,deposit_minor,balance_minor,duration_minutes,snapshot");
    expect(branch).toContain("isVerifiedAcceptedQuoteMilestone(row.data)");
    expect(source.indexOf("isVerifiedAcceptedQuoteMilestone(row.data)"))
      .toBeLessThan(source.indexOf('from("workflow_rules")'));
  });
});
