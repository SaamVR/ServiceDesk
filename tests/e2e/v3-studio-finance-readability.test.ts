import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

function smallTextSizes(css: string, minimum: number): number[] {
  return [...css.matchAll(/font-size:\\s*([.\\d]+)rem/g)]
    .map((match) => Number(match[1]))
    .filter((size) => size < minimum);
}

describe("Studio OS account and commercial information density", () => {
  it("does not use illegibly small commercial billing metadata", () => {
    const css = source("src/features/commercial/CommercialBillingWorkspace.module.css");
    expect(smallTextSizes(css, 0.75)).toEqual([]);
    expect(css).toContain("min-height: 44px");
    expect(css).toContain("max-width: 430px");
  });
  it("makes team invitation identity, state and recovery readable", () => {
    const css = source("src/features/settings/TeamInvitationManager.module.css");
    expect(smallTextSizes(css, 0.78)).toEqual([]);
    expect(css).toContain(".copyError");
    expect(css).toContain("min-height: 44px");
  });
});
