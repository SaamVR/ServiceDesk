import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

describe("V4 real cleaning quote optional add-on UX", () => {
  test("discloses move-out oven exclusion beside the actual quote action", () => {
    const source = readFileSync(join(process.cwd(),
      "src/features/operations/OperationalProductRoute.tsx"), "utf8");
    expect(source).toContain('selectedRequest.serviceCode === "MOVE_OUT"');
    expect(source).toContain("The optional oven clean is");
    expect(source).toContain("customer-approved add-on");
    const form = source.indexOf('<form action={calculateQuote}');
    const disclosure = source.indexOf("Move-out add-on policy:", form);
    expect(form).toBeGreaterThan(-1);
    expect(disclosure).toBeGreaterThan(form);
    expect(disclosure - form).toBeLessThan(2500);
  });
});
