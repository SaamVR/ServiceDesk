import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildQuotePipeline, needsApprovedQuoteExpiryReview } from "../../src/features/operations/quote-pipeline";
import { hasCurrentSavedQuoteExpiry } from "../../src/features/operations/quote-validity-clock";

const pipeline=readFileSync("src/features/operations/quote-pipeline.ts","utf8");
const trusted=readFileSync("src/features/operations/quote-validity-clock.ts","utf8");

describe("P38 independent quote queue clock-consistency critic",()=>{
 it("uses the exact business quote timezone parser rather than permissive Date.parse",()=>{
   expect(pipeline).toContain('import { trustedQuoteInstant } from "./quote-validity-clock"');
   expect(pipeline).toContain("const now = trustedQuoteInstant(snapshotAt)");
   expect(pipeline).toContain("const expires = trustedQuoteInstant(quote.validUntil)");
   expect(pipeline).toContain("trustedQuoteInstant(snapshotAt) !== null");
   expect(pipeline).toContain("now === null || expires === null || expires <= now");
   expect(trusted).toContain("explicit timezone");
   expect(trusted).toContain("validate the written civil date");
 });
 it("rejects timezone-less saved deadlines consistently in overview and the real send gate",()=>{
   const now="2026-10-29T10:00:00Z",expires="2099-10-29T10:00:00";
   const quote={id:"q",requestId:"r",status:"APPROVED",version:1,validUntil:expires};
   expect(needsApprovedQuoteExpiryReview(quote,now)).toBe(true);
   expect(buildQuotePipeline([quote],now)).toMatchObject({
     readyToSend:0,approvedNeedsExpiryReview:1,quoteClockUnverified:false
   });
   expect(hasCurrentSavedQuoteExpiry(now,expires)).toBe(false);
 });
 it("never sends, charges, mutates status or validates customer acceptance from queue computations",()=>{
   const forbidden=[".rpc(","fetch(","createClient(","service_role","stripe","sendEmail("];
   for(const item of forbidden)expect(pipeline).not.toContain(item);
   expect(pipeline).toContain("quoteClockUnverified:");
   expect(pipeline).toContain("sentNeedsExpiryReview:");
   expect(pipeline).toContain("approvedNeedsExpiryReview:");
 });
});
