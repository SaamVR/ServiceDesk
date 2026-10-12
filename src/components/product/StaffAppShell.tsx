"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./StaffWorkspaceV3.module.css";
import cleanStyles from "./StaffCleanAirV4.module.css";
import { StaffCommandPalette } from "./StaffCommandPalette";
import { buildStaffModuleHref, staffModuleConfig, type StaffModule } from "@/features/operations/staff-modules";

// Keep daily work visible. Secondary tools remain available without dominating the rail.
const navGroups: ReadonlyArray<{
  label: string;
  modules: readonly StaffModule[];
  collapsible?: boolean;
}> = [
  { label: "Workday", modules: ["overview", "inbox", "automations", "schedule", "jobs"] },
  { label: "Customer work", modules: ["requests", "quotes", "customers", "invoices"] },
  { label: "More tools", modules: ["quality", "reports", "billing", "settings"], collapsible: true },
];

function NavIcon({ module }: { module: StaffModule }) {
  const common = {
    className: "app-nav-icon",
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (module) {
    case "overview":
      return <svg {...common}><rect x="3" y="3" width="5" height="5" rx="1"/><rect x="12" y="3" width="5" height="5" rx="1"/><rect x="3" y="12" width="5" height="5" rx="1"/><rect x="12" y="12" width="5" height="5" rx="1"/></svg>;
    case "inbox":
      return <svg {...common}><path d="M4 4.5h12v9H11l-3.5 2.5v-2.5H4z"/><path d="M7 8h6M7 10.5h4"/></svg>;
    case "requests":
      return <svg {...common}><path d="M6 3.5h6l3 3V16.5H6z"/><path d="M12 3.5v3h3M8.5 10h4M8.5 12.5h4"/></svg>;
    case "quotes":
      return <svg {...common}><path d="M5 3.5h10v13l-2-1-2 1-2-1-2 1-2-1z"/><path d="M8 7.5h4M8 10h4M8 12.5h2"/></svg>;
    case "schedule":
      return <svg {...common}><rect x="3.5" y="5" width="13" height="11" rx="2"/><path d="M6.5 3.5v3M13.5 3.5v3M3.5 8.5h13M7 11h2M11 11h2M7 13.5h2"/></svg>;
    case "jobs":
      return <svg {...common}><rect x="3.5" y="6" width="13" height="10" rx="2"/><path d="M7.5 6V4.5h5V6M3.5 10h13M8.5 10v1h3v-1"/></svg>;
    case "customers":
      return <svg {...common}><circle cx="7.5" cy="7" r="2.5"/><circle cx="13.5" cy="8" r="2"/><path d="M3.5 15c.4-2.5 2-4 4-4s3.6 1.5 4 4M11.5 12c2-.2 3.7.9 4.2 3"/></svg>;
    case "invoices":
      return <svg {...common}><path d="M5 3.5h10v13l-2-1-2 1-2-1-2 1-2-1z"/><path d="M8 7h4M8 10h4M8 13h3"/></svg>;
    case "quality":
      return <svg {...common}><circle cx="10" cy="10" r="6.5"/><path d="m7 10 2 2 4-4"/></svg>;
    case "automations":
      return <svg {...common}><path d="M4.5 8a6 6 0 0 1 10.2-2.2L16 7M15.5 12a6 6 0 0 1-10.2 2.2L4 13"/><path d="M16 4.5V7h-2.5M4 15.5V13h2.5"/></svg>;
    case "reports":
      return <svg {...common}><path d="M4 16V9h3v7M8.5 16V5.5h3V16M13 16v-4.5h3V16M3 16.5h14"/></svg>;
    case "billing":
      return <svg {...common}><rect x="3" y="5" width="14" height="10" rx="2"/><path d="M3 8h14M6 12h3"/></svg>;
    case "settings":
      return <svg {...common}><path d="M4 6h12M4 14h12M4 10h12"/><circle cx="8" cy="6" r="1.5"/><circle cx="13" cy="10" r="1.5"/><circle cx="10" cy="14" r="1.5"/></svg>;
  }
}

function workspaceDisplayName(workspace: string) {
  // Workspace slugs are already decoded by routing in some entry paths.
  // Literal '%' or malformed escapes must never crash the signed-in shell.
  let decoded = workspace;
  try {
    decoded = decodeURIComponent(workspace);
  } catch {
    // Preserve the supplied slug for display, without changing route authorization.
  }
  return decoded
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function StaffNavigation({ workspace, mobile = false }: { workspace: string; mobile?: boolean }) {
  const pathname = usePathname();

  function moduleIsActive(module: StaffModule): boolean {
    const href = buildStaffModuleHref(workspace, module);
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function linkFor(module: StaffModule) {
    const active = moduleIsActive(module);
    return (
      <Link
        className={`app-nav-link ${styles.navLink}`}
        aria-current={active ? "page" : undefined}
        href={buildStaffModuleHref(workspace, module)}
        key={module}
      >
        <NavIcon module={module} />
        <span>{staffModuleConfig[module].label}</span>
      </Link>
    );
  }

  return (
    <nav className={`${mobile ? "app-mobile-links" : "app-sidebar-nav"} ${styles.navigation}`} aria-label={mobile ? "Mobile workspace" : "Workspace"}>
      {navGroups.map((group) => group.collapsible ? (
        <details
          className={`app-more-tools ${styles.moreTools}`}
          key={group.label}
          // A deep link to a secondary route must expose its selected navigation item.
          open={group.modules.some(moduleIsActive) ? true : undefined}
        >
          <summary className={`app-more-tools-trigger ${styles.moreToolsTrigger}`}>
            <span>More tools</span>
            <span className={styles.moreToolsChevron} aria-hidden="true">⌄</span>
          </summary>
          <div className={`app-more-tools-items ${styles.moreToolsItems}`}>{group.modules.map(linkFor)}</div>
        </details>
      ) : (
        <div className={`app-nav-group ${styles.navGroup}`} key={group.label}>
          <p className={`app-nav-label ${styles.navGroupLabel}`}>{group.label}</p>
          {group.modules.map(linkFor)}
        </div>
      ))}
    </nav>
  );
}

export function StaffAppShell({
  workspace,
  children,
  signedIn = true,
}: {
  workspace: string;
  children: ReactNode;
  signedIn?: boolean;
}) {
  const pathname = usePathname();
  const mobileMenu = useRef<HTMLDetailsElement>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  function closeMobileNavigation() {
    if (mobileMenu.current) mobileMenu.current.open = false;
    setMobileNavOpen(false);
  }
  function handleMobileNavigationToggle(event: React.SyntheticEvent<HTMLDetailsElement>) {
    setMobileNavOpen(event.currentTarget.open);
  }
  function handleMobileNavigationKeyDown(event: React.KeyboardEvent<HTMLDetailsElement>) {
    if (!mobileMenu.current?.open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeMobileNavigation();
      mobileMenu.current?.querySelector("summary")?.focus();
      return;
    }
    if (event.key !== "Tab") return;
    // The workspace drawer covers the page on small screens. Do not let
    // keyboard focus disappear behind its full-width navigation panel.
    const focusable = [...mobileMenu.current.querySelectorAll<HTMLElement>(
      'summary, a[href], button:not([disabled]), [tabindex="0"]',
    )].filter(node => node.getClientRects().length > 0);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    } else if (!focusable.includes(document.activeElement as HTMLElement)) {
      event.preventDefault();
      first.focus();
    }
  }
  function handleMobileNavigationClick(event: React.MouseEvent<HTMLDivElement>) {
    // Close on both same-route links and route changes. Native <details> stays keyboard operable.
    if ((event.target as HTMLElement).closest("a")) closeMobileNavigation();
  }
  useEffect(() => {
    // Navigating from an open mobile drawer must not hide the destination page.
    if (mobileMenu.current) mobileMenu.current.open = false;
  }, [pathname]);
  useEffect(() => {
    if (!mobileNavOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const menu = mobileMenu.current;
    // Return to regular desktop navigation if the viewport grows while open.
    const desktop = window.matchMedia("(min-width: 901px)");
    const handleDesktop = () => {
      if (desktop.matches && menu) {
        menu.open = false;
        setMobileNavOpen(false);
      }
    };
    desktop.addEventListener("change", handleDesktop);
    handleDesktop();
    return () => {
      document.body.style.overflow = previousOverflow;
      desktop.removeEventListener("change", handleDesktop);
    };
  }, [mobileNavOpen]);
  // Preserve the parent module on nested record/detail routes, including
  // encoded workspace slugs, instead of reading the final URL segment.
  const currentModule = (Object.keys(staffModuleConfig) as StaffModule[]).find(module => {
    const href = buildStaffModuleHref(workspace, module);
    return pathname === href || pathname.startsWith(`${href}/`);
  }) ?? "overview";
  const pageLabel = staffModuleConfig[currentModule].label;
  const workspaceName = workspaceDisplayName(workspace);

  return (
    <div className={`app-shell ${styles.v3Shell} ${cleanStyles.cleanShell}`}>
      <a className="app-skip-link" href="#app-main-content">Skip to main content</a>
      <aside className="app-sidebar">
        <Link className="app-brand" href={buildStaffModuleHref(workspace, "overview")} aria-label={`${workspaceName} overview`}>
          <span className="app-brand-mark" aria-hidden="true">S</span>
          <span className="app-brand-copy">
            <strong>ServiceDesk AI</strong>
            <span>{workspaceName}</span>
          </span>
        </Link>
        <StaffNavigation workspace={workspace} />
        <div className="app-sidebar-footer">
          <Link className="app-sidebar-footer-link" href={buildStaffModuleHref(workspace, "settings")}>Workspace settings</Link>
          <span className="app-product-caption">Workspace operations · Staff console</span>
        </div>
      </aside>

      <div className="app-main-column">
        <header className="app-topbar">
          <details className="app-mobile-nav" ref={mobileMenu} onToggle={handleMobileNavigationToggle} onKeyDown={handleMobileNavigationKeyDown}>
            <summary aria-label={mobileNavOpen ? "Close workspace navigation" : "Open workspace navigation"}>
              <span aria-hidden="true">☰</span>
              <span>Menu</span>
            </summary>
            <div className="app-mobile-nav-panel" role="dialog" aria-modal="true" aria-label="Workspace navigation" onClick={handleMobileNavigationClick}>
              <div className="app-mobile-workspace">
                <strong>{workspaceName}</strong>
                <span>{pageLabel}</span>
              </div>
              <StaffNavigation workspace={workspace} mobile />
              {signedIn ? (
                <div className={`app-mobile-account-actions ${styles.mobileAccountActions}`}>
                  <Link href="/auth/select-workspace" onClick={closeMobileNavigation}>Switch workspace</Link>
                  <Link href={buildStaffModuleHref(workspace, "settings")} onClick={closeMobileNavigation}>Account settings</Link>
                </div>
              ) : null}
            </div>
          </details>

          <div className="app-topbar-context">
            <span>{workspaceName}</span>
            <span aria-hidden="true">/</span>
            <strong>{pageLabel}</strong>
          </div>

          <StaffCommandPalette workspace={workspace} />

          <div className="app-topbar-actions">
            <Link className="app-topbar-link" href={buildStaffModuleHref(workspace, "inbox")}>Inbox</Link>
            {signedIn ? (
              <>
                <Link className={`app-topbar-link ${styles.desktopWorkspaceSwitch}`} href="/auth/select-workspace">Switch workspace</Link>
                <Link className="app-account-link" href={buildStaffModuleHref(workspace, "settings")} aria-label="Open account and workspace settings">
                  <span className="app-avatar" aria-hidden="true">SD</span>
                  <span>Account</span>
                </Link>
                <form className="app-signout-form" action="/auth/sign-out" method="post">
                  <button className="app-topbar-link app-signout-button" type="submit">Sign out</button>
                </form>
              </>
            ) : (
              <Link className="app-auth-entry-link" href={"/auth/sign-in?next=" + encodeURIComponent(pathname)}>Sign in</Link>
            )}
          </div>
        </header>

        <main id="app-main-content" className="app-content" aria-label={`${pageLabel} workspace`} tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}
