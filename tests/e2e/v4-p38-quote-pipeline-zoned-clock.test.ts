import { describe, expect, it } from "vitest";
import { buildQuotePipeline, needsApprovedQuoteExpiryReview,
  needsSentQuoteExpiryReview } from "../../src/features/operations/quote-pipeline";
import { hasCurrentSavedQuoteExpiry } from "../../src/features/operations/quote-validity-clock";

const now="2026-10-17T10:00:00Z";
const offer=(status:"SENT"|"APPROVED",until?:string)=>({
 id:"only-"+status,requestId:status,version:1,status,validUntil:until,
});

describe("P38 staff quote queue cannot misstate the authoritative zoned expiry clock",()=>{
  it("requires explicit timezone and valid civil dates for both staff send and customer waiting badges",()=>{
    const invalid=[
      "2026-10-19T12:00:00","2026-10-19","tomorrow",
      "2026-10-19T10:00:00+14:30","2026-10-19T10:00:00+15:00",
      "2026-02-30T10:00:00Z","2026-10-19T24:00:00Z",
    ];
    for(const until of invalid){
      expect(needsApprovedQuoteExpiryReview(offer("APPROVED",until),now),until).toBe(true);
      expect(needsSentQuoteExpiryReview(offer("SENT",until),now),until).toBe(true);
      expect(hasCurrentSavedQuoteExpiry(now,until),until).toBe(false);
      const queue=buildQuotePipeline([offer("APPROVED",until),offer("SENT",until)],now);
      expect(queue.readyToSend).toBe(0);
      expect(queue.awaitingCustomer).toBe(0);
      expect(queue.approvedNeedsExpiryReview).toBe(1);
      expect(queue.sentNeedsExpiryReview).toBe(1);
    }
  });
  it("denies ambiguous or malformed snapshot clock even when the saved quote deadline is valid",()=>{
    for(const clock of ["2026-10-17T10:00:00", "2026-10-17", "2026-02-30T10:00:00Z",
      "2026-10-17T10:00:00+99:00"]){
      const result=buildQuotePipeline([offer("APPROVED","2026-10-18T10:00:00Z"),
        offer("SENT","2026-10-18T10:00:00Z")],clock);
      expect(result.quoteClockUnverified).toBe(true);
      expect(result.readyToSend).toBe(0);
      expect(result.awaitingCustomer).toBe(0);
      expect(result.approvedNeedsExpiryReview).toBe(0);
      expect(result.sentNeedsExpiryReview).toBe(0);
    }
  });
  it("accepts real explicit UTC and civil offset instants but still recognizes expiry",()=>{
    const future="2026-10-17T16:00:00+05:45"; // 10:15Z
    const past="2026-10-17T15:30:00+05:45"; // 09:45Z
    expect(hasCurrentSavedQuoteExpiry(now,future)).toBe(true);
    expect(hasCurrentSavedQuoteExpiry(now,past)).toBe(false);
    expect(buildQuotePipeline([offer("APPROVED",future),offer("SENT",future)],now))
      .toMatchObject({readyToSend:1,awaitingCustomer:1,approvedNeedsExpiryReview:0,sentNeedsExpiryReview:0});
    expect(buildQuotePipeline([offer("APPROVED",past),offer("SENT",past)],now))
      .toMatchObject({readyToSend:0,awaitingCustomer:0,approvedNeedsExpiryReview:1,sentNeedsExpiryReview:1});
  });
  it("keeps a quoted unzoned 2099 deadline out of the owner follow-up queue",()=>{
    const quote=offer("SENT","2099-12-31T23:59:59");
    expect(buildQuotePipeline([quote],now).awaitingCustomer).toBe(0);
    expect(buildQuotePipeline([quote],now).sentNeedsExpiryReview).toBe(1);
  });
});
