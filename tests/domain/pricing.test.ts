import { describe, expect, it } from "vitest";
import { calculateMoveOutQuote } from "../../src/domain/pricing";
describe("move-out pricing fixture", () => {
  it("calculates exact approved synthetic fixture", () => {
    expect(calculateMoveOutQuote({bedrooms:3,bathrooms:2,oven:true})).toEqual({
      subtotalMinor:34_000,taxMinor:0,totalMinor:34_000,depositMinor:8_500,balanceMinor:25_500,durationMinutes:240,bufferMinutes:30
    });
  });
  it("rejects out-of-policy room counts", () => {
    expect(() => calculateMoveOutQuote({bedrooms:11,bathrooms:1,oven:false})).toThrow(RangeError);
  });
});
