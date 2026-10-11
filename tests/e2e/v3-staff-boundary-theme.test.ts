import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const file = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Studio OS authenticated route resilience", () => {
  it("keeps loading and error states on the staff typography and accent system", () => {
    const css = file("src/app/app/[workspace]/StaffRouteBoundary.module.css");
    expect(css).toContain("var(--app-accent");
    expect(css).toContain("var(--app-accent-hover");
    expect(css).toContain("var(--app-text");
    expect(css).toContain('Inter, "Segoe UI", sans-serif');
    expect(css).not.toMatch(/Georgia|Cambria|#833a29|#b55b3c|#eeeae2/i);
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain(".action:focus-visible");
    expect(css).toContain("min-height: 44px");
  });

  it("keeps production loading state honest without synthesized customer records", () => {
    const loading = file("src/app/app/[workspace]/loading.tsx");
    expect(loading).toContain('aria-busy="true"');
    expect(loading).toContain('role="status"');
    expect(loading).toContain("Loading authorized workspace information");
    expect(loading).toContain('aria-hidden="true"');
  });

  it("offers a safe retry without displaying server digests or encouraging repeated payments", () => {
    const error = file("src/app/app/[workspace]/error.tsx");
    expect(error).toContain('role="alert"');
    expect(error).toContain("check the saved record");
    expect(error).toContain("onClick={() => reset()}");
    expect(error).not.toContain("error.message");
    expect(error).not.toContain("error.digest");
  });
});
