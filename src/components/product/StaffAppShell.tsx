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
                <span className="app-nav-indicator" aria-hidden="true" />
                <span>{staffModuleConfig[module].label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function StaffAppShell({ workspace, children }: { workspace: string; children: ReactNode }) {
  const pathname = usePathname();
  const currentSegment = pathname.split("/").filter(Boolean).at(-1);
  const currentModule = currentSegment && currentSegment in staffModuleConfig ? currentSegment as StaffModule : "overview";
  const pageLabel = staffModuleConfig[currentModule].label;
  const workspaceName = workspaceDisplayName(workspace);

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link className="app-brand" href={buildStaffModuleHref(workspace, "overview")} aria-label={`${workspaceName} overview`}>
          <span className="app-brand-mark" aria-hidden="true">SD</span>
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
            <form className="app-signout-form" action="/auth/sign-out" method="post">
              <button className="app-topbar-link app-signout-button" type="submit">Sign out</button>
            </form>
          </div>
        </header>

        <main className="app-content" aria-label={`${pageLabel} workspace`}>{children}</main>
      </div>
    </div>
  );
}
