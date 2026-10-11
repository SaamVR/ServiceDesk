import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createSandboxState, sandboxReducer, sandboxQuote } from "@/features/sandbox/sandbox-engine";
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V4 Clean Air tour and sandbox presentation", () => {
  it("continues the accepted bright imagery, typography and color without replacing the fixture tour", () => {
    const tour = read("src/app/tour/page.tsx");
    const css = read("src/app/tour/BrightTour.module.css");
    expect(tour).toContain('data-v4-tour');
    expect(tour).toContain('aria-label="Clean Air product tour introduction"');
    expect(tour).toContain('<OperationalFixtureRoute');
    expect(tour).toContain('<TourScenarioList');
    expect(tour).toContain('href="/sandbox"');
    expect(tour).toContain("Nothing is saved or sent to an external provider.");
    expect(css).toContain("#fa785f");
    expect(css).toContain("#209d99");
    expect(css).toContain("Manrope");
    expect(css).toContain("@media (max-width: 580px)");
    expect(css).toContain("prefers-reduced-motion: reduce");
  });

  it("keeps the interactive synthetic sandbox engine, not a marketing-only mock", () => {
    const component = read("src/features/sandbox/SandboxJourney.tsx");
    const css = read("src/features/sandbox/SandboxJourney.module.css");
    expect(component).toContain("useReducer(sandboxReducer, createSandboxState())");
    expect(component).toContain('onClick={() => dispatch(next.action as SandboxAction)}');
    expect(component).toContain('onClick={() => dispatch("RESET")}');
    expect(component).toContain("All customers, transactions, messages and provider states here are synthetic");
    expect(component).toContain("no Stripe request or transaction exists");
    expect(css).toContain("#e6f8f1");
    expect(css).toContain("#fa785f");
    expect(css).toContain("prefers-reduced-motion: reduce");
  });

  it("still performs deterministic quote progression and no provider requests", () => {
    const initial = createSandboxState();
    expect(initial.stage).toBe("ENQUIRY");
    const quoted = sandboxReducer(initial, "CREATE_QUOTE");
    expect(quoted.stage).toBe("QUOTED");
    expect(quoted.events.length).toBe(initial.events.length + 1);
    expect(quoted.depositAllocatedMinor).toBe(0);
    expect(sandboxQuote.totalMinor).toBe(34_000);
    const repeated = sandboxReducer(quoted, "CREATE_QUOTE");
    expect(repeated.events.length).toBe(quoted.events.length);
    const source = read("src/features/sandbox/sandbox-engine.ts");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("stripe.checkout");
    expect(source).not.toContain("supabase.from");
  });

  it("does not confuse tour and sandbox marketing with proof of live AI/provider availability", () => {
    const tour = read("src/app/tour/page.tsx");
    const sandbox = read("src/features/sandbox/SandboxJourney.tsx");
    expect(tour).toContain("fixture route data");
    expect(tour).toContain("synthetic history");
    expect(tour).toContain("no messages, bookings or payments are sent");
    expect(sandbox).toContain("No emails, messages, API requests or payments are sent.");
    expect(sandbox).not.toContain("All providers connected.");
  });
});
