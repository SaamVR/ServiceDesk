import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BrightHomeExperience } from "@/features/product/BrightHomeExperience";
import { BrightHomeInteractions } from "@/features/product/BrightHomeInteractions";

vi.mock("next/link", () => ({ default: "a" }));

const file = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const html = (canRegister = false) =>
  renderToStaticMarkup(createElement(BrightHomeExperience, { canRegister }));

describe("V4 Clean Air homepage redesign", () => {
  it("leads with real cleaning business value and visually distinct service/story sections", () => {
    const page = html();
    for (const landmark of [
      "A cleaner way", "cleaning business", "A better clean starts",
      "THE WAY WORK SHOULD FLOW", "Clean spaces.", "Clear minds.",
      "AI-ASSISTED OPERATIONS", "See the bigger picture",
      "Good cleaning changes a space.",
    ]) expect(page).toContain(landmark);
    expect(page).toContain('id="clean-home-heading"');
    expect(page).toContain('id="process-heading"');
    expect(page).toContain('id="difference-heading"');
    expect(page).toContain('id="intelligence-heading"');
    expect(page).toContain('id="showcase-heading"');
    expect(page).toContain('id="closing-heading"');
  });

  it("uses deliberate interaction and grounded operational narratives rather than fake metrics", () => {
    const page = html();
    for (const step of [
      "A request comes in", "Quote with confidence",
      "Put the right team to work", "Finish well. Follow through.",
    ]) expect(page).toContain(step);
    expect(page).toContain("AI helps, your people decide");
    expect(page).toContain("One customer story");
    expect(page).toContain("human touch");
    expect(page).not.toContain("99% satisfied");
    expect(page).not.toContain("5,000+");
    expect(page).not.toContain("4.8/5");
    expect(page).not.toContain("verified customer reviews");
  });

  it("does not invite closed registration and always links to a real published public tour", () => {
    const signedOut = html(false);
    expect(signedOut).toContain('href="/tour"');
    expect(signedOut).toContain("Explore the product");
    expect(signedOut).not.toContain('href="/auth/sign-up"');
    const registrationEnabled = html(true);
    expect(registrationEnabled).toContain('href="/auth/sign-up"');
    expect(registrationEnabled).toContain("Create your workspace");
    expect(registrationEnabled).toContain('href="/features"');
    expect(registrationEnabled).toContain('href="/contact"');
  });

  it("presents only illustrative operational data without impersonating verified AI or sends", () => {
    const page = html();
    const interactions = renderToStaticMarkup(createElement(BrightHomeInteractions));
    expect(page).toContain("AI-assisted intake · example");
    expect(page).toContain("Ready for staff review");
    expect(page).toContain("EXAMPLE VIEW");
    expect(page).toContain("Illustrative interaction");
    expect(interactions).toContain("Human approval required");
    expect(interactions).toContain("No AI request, booking, message or payment is sent.");
    expect(page).not.toContain("Connected to live Meta");
  });

  it("offers three genuinely interactive and accessible AI demonstrations", () => {
    const component = file("src/features/product/BrightHomeInteractions.tsx");
    const markup = renderToStaticMarkup(createElement(BrightHomeInteractions));
    for (const term of ["Smart inbox", "Scheduling", "Follow-ups"]) expect(markup).toContain(term);
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('aria-pressed="false"');
    expect(markup).toContain('aria-live="polite"');
    expect(component).toContain("onClick={() => setSelected(story.id)}");
    expect(component).toContain('const [selected, setSelected] = useState<Story>("inbox")');
    expect(component).toContain("Dispatcher confirms an eligible slot");
  });

  it("uses clean bright responsive art direction with controlled motion and fallback typography", () => {
    const css = file("src/features/product/BrightHomeExperience.module.css");
    const shell = file("src/components/shell/MarketingShell.tsx");
    const nav = file("src/components/shell/MarketingNavV3.module.css");
    const home = file("src/app/page.tsx");
    expect(css).toContain("--clean-porcelain: #f7fbfa");
    expect(css).toContain("--clean-turquoise: #219d9b");
    expect(css).toContain("--clean-coral: #bd4b36");
    expect(css).toContain('font-family: var(--clean-font)');
    expect(css).toContain('@media (max-width: 580px)');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('animation: floatCard');
    expect(css).toContain('animation: gentleTurn');
    expect(shell).toContain("homeEdition ? ");
    expect(nav).toContain(".brightHeader");
    expect(home).toContain("A cleaner way to run your cleaning business");
  });

  it("keeps product content and legal navigation accessible without altering staff UI styles", () => {
    const shell = file("src/components/shell/MarketingShell.tsx");
    const app = file("src/components/product/StaffAppShell.tsx");
    expect(shell).toContain('<MarketingNavLinks variant="desktop" />');
    expect(shell).toContain('<MarketingNavLinks variant="mobile" />');
    expect(shell).toContain('href="/privacy"');
    expect(shell).toContain('href="/terms"');
    expect(shell).toContain('href="/auth/sign-in"');
    expect(app).not.toContain("homeEdition");
  });
});
