"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { buildStaffModuleHref, staffModuleConfig, type StaffModule } from "@/features/operations/staff-modules";

const navGroups: Array<{ label: string; modules: StaffModule[] }> = [
  { label: "Operations", modules: ["overview", "inbox", "requests", "quotes", "schedule", "jobs"] },
  { label: "Customers", modules: ["customers", "invoices"] },
  { label: "Quality & automation", modules: ["quality", "automations"] },
  { label: "Insights", modules: ["reports"] },
  { label: "Admin", modules: ["billing", "settings"] },
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
  const decoded = decodeURIComponent(workspace);
  return decoded
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function StaffNavigation({ workspace, mobile = false }: { workspace: string; mobile?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className={mobile ? "app-mobile-links" : "app-sidebar-nav"} aria-label={mobile ? "Mobile workspace" : "Workspace"}>
      {navGroups.map((group) => (
        <div className="app-nav-group" key={group.label}>
          <p className="app-nav-label">{group.label}</p>
          {group.modules.map((module) => {
            const href = buildStaffModuleHref(workspace, module);
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link className="app-nav-link" aria-current={active ? "page" : undefined} href={href} key={module}>
                <NavIcon module={module} />
                <span>{staffModuleConfig[module].label}</span>
              </Link>
            );
          })}
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
  const currentSegment = pathname.split("/").filter(Boolean).at(-1);
  const currentModule = currentSegment && currentSegment in staffModuleConfig ? currentSegment as StaffModule : "overview";
  const pageLabel = staffModuleConfig[currentModule].label;
  const workspaceName = workspaceDisplayName(workspace);

  return (
    <div className="app-shell">
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
          <span className="app-product-caption">Operations workspace</span>
        </div>
      </aside>

      <div className="app-main-column">
        <header className="app-topbar">
          <details className="app-mobile-nav">
            <summary aria-label="Open workspace navigation">
              <span aria-hidden="true">☰</span>
              <span>Menu</span>
            </summary>
            <div className="app-mobile-nav-panel">
              <div className="app-mobile-workspace">
                <strong>{workspaceName}</strong>
                <span>{pageLabel}</span>
              </div>
              <StaffNavigation workspace={workspace} mobile />
            </div>
          </details>

          <div className="app-topbar-context">
            <span>{workspaceName}</span>
            <span aria-hidden="true">/</span>
            <strong>{pageLabel}</strong>
          </div>

          <div className="app-topbar-actions">
            <Link className="app-topbar-link" href={buildStaffModuleHref(workspace, "inbox")}>Inbox</Link>
            <Link className="app-account-link" href={buildStaffModuleHref(workspace, "settings")} aria-label="Open account and workspace settings">
              <span className="app-avatar" aria-hidden="true">SD</span>
              <span>Account</span>
            </Link>
            {signedIn ? (
              <form className="app-signout-form" action="/auth/sign-out" method="post">
                <button className="app-topbar-link app-signout-button" type="submit">Sign out</button>
              </form>
            ) : null}
          </div>
        </header>

        <main className="app-content" aria-label={`${pageLabel} workspace`}>{children}</main>
      </div>
    </div>
  );
}
