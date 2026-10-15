import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { verifiedManualQuoteHandoffMessage } from "../../src/features/operations/quote-manual-handoff";

const src=(path: string) => readFileSync(join(process.cwd(),path),"utf8");

describe("manual quote sharing uses fresh branch-scoped owner-approved saved facts",()=>{
  test("server verifies current user, workspace branch and persisted quote before returning money",()=>{
    const server=src("src/features/operations/current-quote-handoff-action.ts");
    const owner=server.indexOf("resolveStaffActor(workspaceSlug)");
    const branch=server.indexOf('requireOperationalBranchResource(resolved.value, "quote", quoteId)');
    const query=server.indexOf('service.from("quotes")');
    const proof=server.indexOf("readVerifiedCustomerQuoteLineItems(row.snapshot");
    const result=server.indexOf("return { ok: true, facts:");
    expect(owner).toBeGreaterThan(-1);
    expect(branch).toBeGreaterThan(owner);
    expect(query).toBeGreaterThan(branch);
    expect(proof).toBeGreaterThan(query);
    expect(result).toBeGreaterThan(proof);
    expect(server).toContain('.eq("workspace_id", workspace.id).eq("id", quoteId)');
    expect(server).toContain('row.status !== "SENT"');
    expect(server).toContain("Date.parse(row.valid_until) <= Date.now()");
    expect(server).toContain("row.deposit_minor + row.balance_minor !== row.total_minor");
    expect(server).not.toContain("sendWhatsApp");
    expect(server).not.toContain("sendEmail");
  });

  test("clipboard cannot use stale page-price facts without fresh authenticated read",()=>{
    const ui=src("src/features/operations/QuoteCustomerHandoff.tsx");
    const step=ui.indexOf("getCurrentVerifiedManualQuoteHandoff(workspaceSlug, quoteId)");
    const draft=ui.indexOf("verifiedManualQuoteHandoffMessage(current.facts, window.location.origin)");
    const clipboard=ui.indexOf("window.navigator.clipboard.writeText(draft)");
    expect(step).toBeGreaterThan(-1);
    expect(draft).toBeGreaterThan(step);
    expect(clipboard).toBeGreaterThan(draft);
    expect(ui).toContain('setResult("stale");');
    expect(ui).not.toContain("verifiedManualQuoteHandoffMessage(facts, window.location.origin)");
  });

  test("verified current copy remains a human-reviewed private portal quote",()=>{
    const facts={
      quoteId:"11111111-1111-4111-8111-111111111111",
      status:"SENT",currency:"USD",validUntil:"2099-01-01T00:00:00Z",
      subtotalMinor:10000,taxMinor:0,totalMinor:10000,
      depositMinor:2500,balanceMinor:7500,durationMinutes:120,
      lineItems:[{code:"BASE",description:"Base cleaning",amountMinor:10000,durationMinutes:120}],
    };
    const text=verifiedManualQuoteHandoffMessage(facts,
      "https://servicedesk-v3-frontend-review.onrender.com", new Date("2026-10-15T08:00:00Z"));
    expect(text).toContain("Base cleaning");
    expect(text).toContain("customer sign-in required");
    expect(text).toContain("not a payment receipt or booking confirmation");
  });
});
