import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildQuotePipeline } from "../../src/features/operations/quote-pipeline";
import { buildStaffQuoteChecklist } from "../../src/features/operations/staff-quote-checklist";

const now="2026-10-16T12:00:00Z";
const verified={
  id:"approved-verified",requestId:"one",status:"APPROVED",version:1,
  validUntil:"2026-10-17T12:00:00Z",
  currency:"USD",subtotalMinor:12000,taxMinor:0,totalMinor:12000,
  depositMinor:3000,balanceMinor:9000,durationMinutes:90,
  lineItems:[{code:"BASE",description:"Saved cleaning",amountMinor:12000,durationMinutes:90}],
};

describe("staff ready-to-send is backed by reconciled saved financial evidence",()=>{
  it("does not count unexpired APPROVED quotes with broken or absent saved charge proof",()=>{
    const records=[
      verified,
      {...verified,id:"no-lines",requestId:"two",lineItems:null},
      {...verified,id:"wrong-subtotal",requestId:"three",subtotalMinor:11999},
      {...verified,id:"wrong-deposit",requestId:"four",depositMinor:2999},
      {...verified,id:"expired",requestId:"five",validUntil:"2026-10-15T12:00:00Z"},
      {...verified,id:"accepted",requestId:"six",status:"ACCEPTED"},
    ];
    const pipeline=buildQuotePipeline(records,now);
    // Status/expiry-only pipeline is not a financial receipt; UI explicitly
    // applies the identical saved-charge preflight used by quote detail.
    const ready=[...pipeline.currentQuoteByRequest.values()]
      .filter(quote=>quote.status==="APPROVED" &&
        buildStaffQuoteChecklist(quote,now).readyForHumanReview);
    expect(pipeline.readyToSend).toBe(4);
    expect(ready.map(quote=>quote.id)).toEqual(["approved-verified"]);
  });
  it("cannot resurrect an older approved quote when a newer current version exists",()=>{
    const newer={...verified,id:"new-draft",requestId:"one",version:2,status:"DRAFT"};
    const pipeline=buildQuotePipeline([verified,newer],now);
    const current=[...pipeline.currentQuoteByRequest.values()];
    expect(current.map(quote=>quote.id)).toEqual(["new-draft"]);
    expect(current.filter(quote=>quote.status==="APPROVED" &&
      buildStaffQuoteChecklist(quote,now).readyForHumanReview)).toEqual([]);
  });
  it("staff summary and selected send action both use the same deterministic saved preflight",()=>{
    const src=readFileSync(join(process.cwd(),"src/features/operations/OperationalProductRoute.tsx"),"utf8");
    const start=src.indexOf("function QuotesView(");
    const end=src.indexOf("function ScheduleView(",start);
    const source=src.slice(start,end);
    expect(source).toContain("buildStaffQuoteChecklist(quote, data.loadedAt).readyForHumanReview");
    expect(source).toContain("const readyToSend = [...currentQuoteByRequest.values()].filter(verifiedForSend).length");
    expect(source).toContain("isCurrentApprovedQuote(selectedQuote, currentQuoteByRequest)");
    expect(source).toContain("&& verifiedForSend(selectedQuote)");
    expect(source).toContain("{readyToSend} ready to send");
  });
});
