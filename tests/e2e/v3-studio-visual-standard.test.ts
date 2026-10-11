import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const file = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Studio OS product styling", () => {
  it("uses a single trustworthy graphite/teal staff-system with light surfaces", () => {
    const css = file("src/components/product/StaffWorkspaceV3.module.css");
    expect(css).toContain("--app-canvas: #f3f6f7");
    expect(css).toContain("--app-accent: #0b746d");
    expect(css).toContain("background: #142b33");
    expect(css).toContain("--app-sidebar-width: 252px");
    expect(css).toContain(".navLink[aria-current=\"page\"]");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain(":focus-visible");
    expect(css).not.toContain("font-family: Georgia");
  });
  it("retains real staff navigation, sign-out and command palette", () => {
    const source = file("src/components/product/StaffAppShell.tsx");
    expect(source).toContain("<StaffCommandPalette workspace={workspace} />");
    expect(source).toContain('action="/auth/sign-out"');
    expect(source).toContain("Workspace operations · Staff console");
    expect(source).toContain("buildStaffModuleHref(workspace, module)");
  });
});
