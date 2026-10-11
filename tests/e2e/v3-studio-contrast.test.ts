import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function luminance(color: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255);
  return channels.reduce((sum, channel, index) => {
    const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    return sum + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);
}
function contrast(a: string, b: string): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
const shell = readFileSync(join(process.cwd(), "src/components/product/StaffWorkspaceV3.module.css"), "utf8");

describe("Studio OS WCAG-inspired color contracts", () => {
  it("meets AA normal-text contrast for primary actions, nav and supporting labels", () => {
    const accent = shell.match(/--app-accent:\s*(#[0-9a-fA-F]{6})/)?.[1];
    const navigation = shell.match(/\.navLink\s*\{[\s\S]*?\}/)?.[0] ?? "";
    expect(navigation).toContain("min-height: 42px");
    expect(accent).toBeTruthy();
    expect(contrast("#ffffff", accent!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#c7d8db", "#142b33")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#a5c0c3", "#142b33")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#647982", "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });

  it("does not remove visible keyboard focus or reduced-motion overrides", () => {
    expect(shell).toContain("outline: 3px solid #1e8a81");
    expect(shell).toContain("prefers-reduced-motion: reduce");
    expect(shell).toContain("min-height: 44px");
  });
});
