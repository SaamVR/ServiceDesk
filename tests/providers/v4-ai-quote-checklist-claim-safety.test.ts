import { describe, expect, test } from "vitest";
import { validateStaffQuoteReviewDraft, validateStaffQuoteReviewGrounding } from "../../src/server/ai/quote-review-safety";

describe("AI quote-review output does not fabricate customer/provider events", () => {
  test("allows a bounded staff checklist grounded in saved service codes", () => {
    const suggestion="Check the bedroom and bathroom counts with the customer before sharing the saved quote.";
    expect(validateStaffQuoteReviewGrounding(suggestion,["BASE","BEDROOM","BATHROOM"]))
      .toBe(suggestion);
  });
  test("rejects invented approval, customer receipt, provider sends and payment events", () => {
    const unsupported=[
      "The customer already accepted the quote.",
      "Customer confirmed the booking.",
      "The client has approved the booking.",
      "Customer received the quote.",
      "WhatsApp has been delivered to the customer.",
      "The email was sent.",
      "The message is received.",
      "Payment was received.",
      "The deposit was charged.",
      "Invoice has been settled.",
      "Refund was processed.",
    ];
    for (const message of unsupported) expect(validateStaffQuoteReviewDraft(message)).toBeUndefined();
  });
  test("rejects invisible formatting controls in staff model suggestions", () => {
    for (const symbol of ["\u202e","\u202a","\u200d","\u2066","\ufeff"]) {
      expect(validateStaffQuoteReviewDraft("Check saved oven charges " + symbol + "before review."))
        .toBeUndefined();
    }
  });
  test("continues refusing service work not contained in saved quote", () => {
    expect(validateStaffQuoteReviewGrounding("Check the oven count",["BASE","BEDROOM"]))
      .toBeUndefined();
    expect(validateStaffQuoteReviewGrounding("Check bedroom count",["BASE","BEDROOM"]))
      .toBeDefined();
  });
});
