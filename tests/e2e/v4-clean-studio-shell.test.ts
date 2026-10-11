import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const file = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V4 Clean Air authenticated Studio OS visual refresh", () => {
  const shell = file("src/components/product/StaffAppShell.tsx");
  const css = file("src/components/product/StaffCleanAirV4.module.css");
  const previousCss = file("src/components/product/StaffWorkspaceV3.module.css");

  it("applies Clean Air to the *real* authenticated shell without replacing the operational runtime", () => {
    expect(shell).toContain('from "./StaffCleanAirV4.module.css"');
    expect(shell).toContain('className={`app-shell ${styles.v3Shell} ${cleanStyles.cleanShell}`}');
    expect(shell).toContain('id="app-main-content"');
    expect(shell).toContain('tabIndex={-1}');
    expect(file("src/app/app/[workspace]/layout.tsx")).toContain("<StaffAppShell");
    expect(file("src/app/app/[workspace]/layout.tsx")).toContain("hasAuthenticatedSession()");
    expect(previousCss).toContain("--app-accent: #0b746d");
  });

  it("makes the sidebar bright and preserves strong selected-route hierarchy", () => {
    expect(css).toContain("--app-canvas: #f7fbfa");
    expect(css).toContain("--app-accent: #208f86");
    expect(css).toContain('background: linear-gradient(180deg,#fff 0%,#fbfdfc 72%,#f6fbf8 100%)');
    expect(css).toContain('background: #219d99');
    expect(css).toContain('background: #e3f7ef');
    expect(css).toContain('box-shadow: inset 3px 0 #2da68e');
    expect(css).toContain('color: #0f7366');
    expect(css).not.toContain('background: #142b33');
  });

  it("carries approved homepage typography and calm product metrics into private pages", () => {
    expect(css).toContain("Manrope");
    expect(css).toContain("DM Sans");
    expect(css).toContain('--app-shadow-sm: 0 5px 19px rgb(35 89 76 / 4%)');
    expect(css).toContain(':global(.app-metric-strip)');
    expect(css).toContain(':global(.app-section-header)');
    expect(css).toContain(':global(.app-empty-state)');
    expect(css).toContain(':global(.app-button-primary)');
    expect(css).toContain(':global(.app-button-secondary)');
    expect(css).toContain('letter-spacing: -.061em');
  });

  it("maintains minimum 44px mobile controls, focus and reduced-motion support", () => {
    expect(css).toContain('@media (max-width: 900px)');
    expect(css).toContain('@media (max-width: 620px)');
    expect(css).toContain('@media (max-width: 390px)');
    expect(css).toContain('min-height: 45px');
    expect(css).toContain('min-height: 44px');
    expect(css).toContain('min-height: 48px');
    expect(css).toContain(':global(.app-mobile-nav-panel)');
    expect(css).toContain(':focus-visible');
    expect(css).toContain('prefers-reduced-motion: reduce');
  });

  it("preserves real existing-user sign-in, server-defined workspace switch and sign-out actions", () => {
    expect(shell).toContain('signedIn = true');
    expect(shell).toContain('href="/auth/select-workspace"');
    expect(shell).toContain('action="/auth/sign-out"');
    expect(shell).toContain('href={"/auth/sign-in?next=" + encodeURIComponent(pathname)}');
    expect(shell).toContain('buildStaffModuleHref(workspace, "overview")');
    expect(shell).toContain('aria-current={active ? "page" : undefined}');
    expect(shell).toContain('onKeyDown={handleMobileNavigationKeyDown}');
    expect(shell).not.toContain("createServiceRoleClient");
    expect(shell).not.toContain("sampleConversation");
  });
});
