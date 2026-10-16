import { describe, expect, test } from "vitest";
import { validateStaffQuoteReviewDraft } from "../../src/server/ai/quote-review-safety";

describe("untrusted staff quote model claims",()=>{
  test("allows bounded operational checklists without business promises",()=>{
    const note="Check oven consent against the saved scope. Review room count and staff duration before sharing.";
    expect(validateStaffQuoteReviewDraft(note)).toBe(note);
    expect(validateStaffQuoteReviewDraft("Confirm that optional cleaning is requested, then review the saved quote.")).toContain("Confirm");
  });
  test("rejects hallucinated amounts, financial commitments and payment assertions",()=>{
    for(const claim of [
      "Deposit is 200", "Balance: 123", "Tax = 20", "The discount of 10 is applied.",
      "Quote total: 350", "Your quote is approved", "The booking has been confirmed",
      "Your payment has been processed", "We will charge the customer",
      "We can refund the deposit", "The delivery is guaranteed", "We promise a price match",
      "This schedule is definitely available",
      "The customer has paid", "Contact jane@example.com",
      "USD 200 is the likely charge", "200 dollars for the cleaning",
      "The total will be 300", "The deposit should be 50",
      "Tax estimated at 25", "The price around 200",
      "Your price is $200", "Appointment 2026-10-20",
    ]) expect(validateStaffQuoteReviewDraft(claim),claim).toBeUndefined();
  });
  test("rejects unsupported first-person and passive operational completion claims",()=>{
    for(const claim of [
      "We already sent the quote. Review the service lines.",
      "Our team has approved the estimate, check the checklist.",
      "Staff delivered the offer to the customer.",
      "I have booked a service slot; review durations.",
      "You already charged the customer. Check the details.",
      "The offer has been delivered.",
      "Your invoice has been confirmed.",
      "The job was scheduled and the crew assigned.",
    ]) expect(validateStaffQuoteReviewDraft(claim),claim).toBeUndefined();
    const advisory="Review the saved quote and confirm service scope before sending it to the customer.";
    expect(validateStaffQuoteReviewDraft(advisory)).toBe(advisory);
  });
  test("rejects non-text and oversized untrusted outputs",()=>{
    expect(validateStaffQuoteReviewDraft({replyDraft:"Approved"})).toBeUndefined();
    expect(validateStaffQuoteReviewDraft("a".repeat(901))).toBeUndefined();
  });
});
