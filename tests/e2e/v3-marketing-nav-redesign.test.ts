import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { marketingLinks } from "@/components/shell/MarketingNavLinks";

const file = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V3 public navigation redesign", () => {
  it("uses four purposeful destinations rather than the crowded legacy menu", () => {
    expect(marketingLinks.map(({ label, href }) => [label, href])).toEqual([
      ["Product", "/features"],
      ["Solutions", "/use-cases/cleaning"],
      ["Integrations", "/integrations"],
      ["Pricing", "/pricing"],
    ]);
    expect(marketingLinks.every((link) => link.description.length > 10)).toBe(true);
  });

  it("preserves the actual registration policy and existing-user sign-in", () => {
    const shell = file("src/components/shell/MarketingShell.tsx");
    expect(shell).toContain("marketingRegistrationEntry(registrationEnabled)");
    expect(shell).toContain("href={registration.href}");
    expect(shell).toContain('href="/auth/sign-in"');
    expect(shell).not.toContain('href="/auth/sign-up"');
    expect(shell).toContain('<MarketingNavLinks variant="desktop" />');
    expect(shell).toContain('<MarketingNavLinks variant="mobile" />');
  });

  it("provides current-page semantics, a native mobile toggle, and reduced-motion support", () => {
    const links = file("src/components/shell/MarketingNavLinks.tsx");
    const shell = file("src/components/shell/MarketingShell.tsx");
    const css = file("src/components/shell/MarketingNavV3.module.css");
    expect(links).toContain('aria-current={pathname === item.href');
    expect(shell).toContain('<details className={styles.mobileMenu}>');
    expect(shell).toContain('aria-label="Open product menu"');
    expect(shell).toContain('aria-label="Mobile product navigation"');
    expect(shell).toContain('href="/contact"');
    expect(shell).toContain('href="/help"');
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain("max-width: 350px");
  });
});
