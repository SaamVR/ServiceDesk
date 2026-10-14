import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { validateStaffQuoteReviewGrounding } from "../../src/server/ai/quote-review-safety";

describe("paid model quote checklist is grounded in actual saved owner-priced line items",()=>{
  test("permits human review of a proven oven/bedroom/bathroom quote",()=>{
    const text="Confirm the oven add-on, bedroom count, and bathroom count with staff before sharing.";
    expect(validateStaffQuoteReviewGrounding(text,["BASE","BEDROOM","BATHROOM","OVEN"])).toBe(text);
    expect(validateStaffQuoteReviewGrounding("Check service scope before customer review.",["BASE"]))
      .toBe("Check service scope before customer review.");
  });
  test("never invents optional services missing from the quoted itemization",()=>{
    for(const [text,codes] of [
      ["Check the oven add-on.",["BASE","BEDROOM"]],
      ["Review bathrooms with the owner.",["BASE","BEDROOM"]],
      ["Confirm bedrooms.",["BASE","BATHROOM"]],
      ["Confirm the restroom.",["BASE"]],
    ] as const)expect(validateStaffQuoteReviewGrounding(text,codes)).toBeUndefined();
  });
  test("still rejects model monetary hallucination, unsafe codes or unsupported evidence",()=>{
    expect(validateStaffQuoteReviewGrounding("Quote costs USD 99.",["BASE"])).toBeUndefined();
    expect(validateStaffQuoteReviewGrounding("Check oven.",["BASE","INVALID;CODE"]))
      .toBeUndefined();
    expect(validateStaffQuoteReviewGrounding("Check oven.",[])).toBeUndefined();
    expect(validateStaffQuoteReviewGrounding("The quote was confirmed.",["BASE"]))
      .toBeUndefined();
  });
  test("staff quote review uses this source gate after paid model response and reauthorization",()=>{
    const src=readFileSync(join(process.cwd(),"src/server/ai/quote-review.ts"),"utf8");
    expect(src).toContain("validateStaffQuoteReviewGrounding(");
    expect(src).toContain("lines.map(item => item.code)");
    expect(src.indexOf("const review = validateStaffQuoteReviewGrounding("))
      .toBeGreaterThan(src.indexOf("AI_QUOTE_STAFF_ACCESS_REVOKED"));
  });
});
