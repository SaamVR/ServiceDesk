import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createSandboxState, sandboxAllocatedMinor,
  sandboxOutstandingMinor, sandboxReducer, sandboxStages,
} from "@/features/sandbox/sandbox-engine";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V4 Clean Air synthetic sandbox visual and safety acceptance", () => {
  it("shares the approved bright-clean tokens, typography and panel hierarchy", () => {
    const css = read("src/features/sandbox/SandboxJourney.module.css");
    for (const token of [
      "--sandbox-ink: #203638",
      "--sandbox-accent: #208f86",
      "--sandbox-soft: #e8f7f2",
      "--sandbox-coral: #fa785f",
      'background: #fff',
      "border-radius: 14px",
      'font-family: "DM Sans"',
      'font-family: "Manrope"',
      "@media (max-width: 690px)",
      "@media (prefers-reduced-motion: reduce)",
      ".page a:focus-visible",
    ]) expect(css).toContain(token);
    expect(css).not.toContain("fonts.googleapis.com");
    expect(css).not.toContain("fonts.gstatic.com");
    expect(css).not.toContain("https://");
  });

  it("keeps actual local-only lifecycle and bounded mock delivery instead of fake production connectivity", () => {
    const page = read("src/features/sandbox/SandboxJourney.tsx");
    expect(page).toContain("sandboxReducer");
    expect(page).toContain("sandboxStages");
    expect(page).toContain('dispatch("RESET")');
    expect(page).toContain("No emails, messages, API requests or payments are sent.");
    expect(page).toContain("Mock provider accepted · not delivered");
    expect(page).toContain("no Stripe request or transaction exists");
    expect(page).toContain('aria-live="polite"');
    expect(page).not.toContain("fetch(");
    expect(page).not.toContain('"use server"');
  });

  it("preserves the real pricing formula, payment conservation and reset semantics", () => {
    const stages = sandboxStages.flatMap(step => step.action ? [step.action] : []);
    const state = stages.reduce((s, action) => sandboxReducer(s, action), createSandboxState());
    expect(state.stage).toBe("BALANCE_PAID");
    expect(sandboxAllocatedMinor(state)).toBe(34_000);
    expect(sandboxOutstandingMinor(state)).toBe(0);
    const reset = sandboxReducer(state, "RESET");
    expect(reset).toEqual(createSandboxState());
    expect(sandboxAllocatedMinor(reset)).toBe(0);
  });

  it("keeps real Chrome acceptance at four widths, every stage, recovery, reset and zero third-party requests", () => {
    const script = read("scripts/release/v3-sandbox-browser.mjs");
    expect(script).toContain("const widths = [320, 390, 834, 1440]");
    expect(script).toContain("seenExternal");
    expect(script).toContain('if (seenExternal.length) throw new Error');
    expect(script).toContain("Inject mock failure");
    expect(script).toContain("Retry failed send");
    expect(script).toContain("Mock provider accepted · not delivered");
    expect(script).toContain("await click(\"Reset sandbox\")");
  });
});
