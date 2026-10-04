import { calculateMoveOutQuote } from "./pricing";
export const SYNTHETIC_WORKSPACE = Object.freeze({ id:"ws_synthetic_london", timezone:"Europe/London", currency:"USD" });
export const MOVE_OUT_FIXTURE_INPUT = Object.freeze({ bedrooms:3, bathrooms:2, oven:true });
export const MOVE_OUT_FIXTURE_EXPECTED = Object.freeze({ totalMinor:34_000, depositMinor:8_500, balanceMinor:25_500, durationMinutes:240, bufferMinutes:30 });
export function assertSyntheticMoveOutFixture(): void {
  const result = calculateMoveOutQuote(MOVE_OUT_FIXTURE_INPUT);
  for (const [key, expected] of Object.entries(MOVE_OUT_FIXTURE_EXPECTED)) {
    const actual = result[key as keyof typeof MOVE_OUT_FIXTURE_EXPECTED];
    if (actual !== expected) throw new Error(`fixture mismatch for ${key}: expected ${expected}, received ${actual}`);
  }
}
