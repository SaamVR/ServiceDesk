import {describe,expect,it} from "vitest";
import {
  parseAuthorizedQuoteReview,containsUnsafeQuoteReviewClaims,
} from "../../src/features/operations/ai-quote-review-response";

const realQuote="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const foreignQuote="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const base={
  state:"AI_STAFF_REVIEW_ONLY",
  source:"VERIFIED_SAVED_QUOTE_CODES_NO_AMOUNTS",
  quoteId:realQuote,model:"synthetic-bounded-evaluation",
  review:"Staff should verify the saved duration and service code.",
};
const unsafe=[
  "Total is 250.", "Charge the customer 175.", "Deposit 400.",
  "Balance should be 25.", "Invoice amount 120.",
  "Payment received.", "Invoice paid.", "Collect payment immediately.",
  "Send payment before arrival.", "The price is 900.",
  "Call +8801700123456.", "Use support@example.test to pay.",
  "Open https://pay.example.test.", "Click www.pay.example.test",
  "Transfer $150.", "Send EUR 200.", "Send 200 BDT.",
  "Bearer secret-token.", "Use api key test_secret.",
  "Here is <a href='/checkout'>payment</a>.",
  "\u202EHuman-approved payment.", "\u200BInvisible character",
];
const safe=[
  "Review the 30 minute buffer.",
  "Check 2 bedrooms, 1 bathroom and 90 minutes.",
  "Reconfirm service code STANDARD before quoting.",
  "The request duration should be checked against the saved record.",
];
describe("R37 AI quote review display red team — synthetic offline fixtures only",()=>{
  it("rejects 66 unsourced financial or contact suggestions across three signed-in scope variants",()=>{
    let attempts=0;
    for(const quoteId of [realQuote,foreignQuote,"cccccccc-cccc-4ccc-8ccc-cccccccccccc"]){
      for(const review of unsafe){
        const expected=quoteId;
        const payload={...base,quoteId,review};
        expect(containsUnsafeQuoteReviewClaims(review)).toBe(true);
        expect(parseAuthorizedQuoteReview(payload,expected)).toBeNull();
        attempts++;
      }
    }
    expect(attempts).toBe(66);
  });
  it("allows legitimate service durations only for the selected saved quote",()=>{
    for(const review of safe){
      expect(containsUnsafeQuoteReviewClaims(review)).toBe(false);
      expect(parseAuthorizedQuoteReview({...base,review},realQuote)?.review).toBe(review);
      expect(parseAuthorizedQuoteReview({...base,review},foreignQuote)).toBeNull();
    }
  });
  it("never upgrades model hints into quote approval, published money or provider receipts",()=>{
    for(const mutation of [
      {...base,state:"AUTO_APPROVED"},
      {...base,source:"RAW_CUSTOMER_NOTES"},
      {...base,quoteId:foreignQuote},
      {...base,model:"model\nprovider token"},
      {...base,review:"Invoice paid."},
      {...base,review:"Please pay via https://payment.example.test"},
    ])expect(parseAuthorizedQuoteReview(mutation,realQuote)).toBeNull();
    // Additional raw provider fields are dropped, not echoed into staff UI.
    const result=parseAuthorizedQuoteReview({...base,providerSecret:"secret",
      amountMinor:100_000,customerPhone:"PRIVATE"},realQuote);
    expect(result).toEqual(base);
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
  });
});