import { describe, expect, it } from "vitest";
import { validateRequestBriefDraft } from "../../src/server/ai/request-brief-safety";
import { validateStaffQuoteReviewDraft } from "../../src/server/ai/quote-review-safety";

describe("untrusted operational AI output must not fabricate or disguise contact identity", () => {
  it("rejects international and local unseparated mobile numbers not present in saved request facts", () => {
    for (const copy of [
      "Call +8801712345678 to confirm the booking.",
      "Customer mobile 01712345678 should be called.",
      "Reach me at +441234567890.",
      "Call 123456789012345 for payment.",
    ]) {
      expect(validateRequestBriefDraft(copy), copy).toBeUndefined();
      expect(validateStaffQuoteReviewDraft(copy), copy).toBeUndefined();
    }
  });
  it("rejects invisible and directional formatting controls used to disguise contact information", () => {
    for (const copy of [
      "Visit exa\u200Bmple.com",
      "Review quote \u202Eapproved",
      "Staff should \u2060send the invoice",
      "Customer email: jane@\u200Dexample.com",
    ]) {
      expect(validateRequestBriefDraft(copy)).toBeUndefined();
      expect(validateStaffQuoteReviewDraft(copy)).toBeUndefined();
    }
  });
  it("preserves ordinary bounded, unapproved, staff-only suggestions", () => {
    const draft = "Please review the saved service code and room counts with staff.";
    expect(validateRequestBriefDraft(draft)).toBe(draft);
    expect(validateStaffQuoteReviewDraft(draft)).toBe(draft);
  });
});
