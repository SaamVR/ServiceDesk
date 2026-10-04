export interface MoveOutQuoteInput { bedrooms: number; bathrooms: number; oven: boolean; }
export interface PriceBreakdown {
  subtotalMinor: number; taxMinor: number; totalMinor: number; depositMinor: number; balanceMinor: number;
  durationMinutes: number; bufferMinutes: number;
}
function assertWholeInRange(name: string, value: number, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) throw new RangeError(`${name} must be an integer between ${min} and ${max}`);
}
export function calculateMoveOutQuote(input: MoveOutQuoteInput): PriceBreakdown {
  assertWholeInRange("bedrooms", input.bedrooms, 0, 10);
  assertWholeInRange("bathrooms", input.bathrooms, 0, 10);
  const subtotalMinor = 18_000 + input.bedrooms * 3_000 + input.bathrooms * 2_000 + (input.oven ? 3_000 : 0);
  const durationMinutes = 120 + input.bedrooms * 20 + input.bathrooms * 15 + (input.oven ? 30 : 0);
  const taxMinor = 0;
  const totalMinor = subtotalMinor + taxMinor;
  const depositMinor = Math.floor((totalMinor * 25 + 50) / 100);
  return { subtotalMinor, taxMinor, totalMinor, depositMinor, balanceMinor: totalMinor - depositMinor, durationMinutes, bufferMinutes: 30 };
}
