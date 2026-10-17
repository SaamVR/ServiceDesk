import {describe,expect,it} from "vitest";
import {validateStaffQuoteReviewDraft,validateStaffQuoteReviewGrounding}
  from "../../src/server/ai/quote-review-safety";

describe("R15 independent AI quote review commercial proof",()=>{
 it("never converts model prose into undocumented symbol-based prices or discounts",()=>{
   for(const unsafe of [
     "The service will cost $120.",
     "Charge £85 for the customer visit.",
     "Review the €3,000 invoice.",
     "Total ৳1500 should be paid today.",
     "Offer 10% discount before sending.",
     "A 12% off deal will close this quote.",
     "Apply discount of 15% now.",
     "The price is USD 120.",
   ]) expect(validateStaffQuoteReviewDraft(unsafe),unsafe).toBeUndefined();
 });
 it("retains useful nonfinancial staff suggestions and saved-line grounding",()=>{
   expect(validateStaffQuoteReviewDraft("Confirm the saved room counts before staff approval."))
     .toBe("Confirm the saved room counts before staff approval.");
   expect(validateStaffQuoteReviewGrounding("Check oven scope with the customer.",["STANDARD"]))
     .toBeUndefined();
   expect(validateStaffQuoteReviewGrounding("Review saved bathroom timing.",["BATHROOM"]))
     .toBe("Review saved bathroom timing.");
 });
});
