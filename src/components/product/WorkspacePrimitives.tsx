import type { ReactNode } from "react";

export function SplitWorkspace({
  list,
  detail,
  context,
  mobileFocus = "list",
  ariaLabel,
}: {
  list: ReactNode;
  detail: ReactNode;
  context?: ReactNode;
  mobileFocus?: "list" | "detail" | "context";
  ariaLabel: string;
}) {
  return (
    <section
      className={`app-split-workspace ${context ? "has-context" : ""}`.trim()}
      data-mobile-focus={mobileFocus}
      aria-label={ariaLabel}
    >
      <div className="app-split-pane app-split-list">{list}</div>
      <div className="app-split-pane app-split-detail">{detail}</div>
      {context ? <aside className="app-split-pane app-split-context">{context}</aside> : null}
    </section>
  );
}

export function WorkspacePane({
  title,
  description,
  actions,
  children,
  ariaLabel,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <section className="app-workspace-pane" aria-label={ariaLabel ?? title}>
      <header className="app-workspace-pane-header">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="app-workspace-pane-actions">{actions}</div> : null}
      </header>
      <div className="app-workspace-pane-body">{children}</div>
    </section>
  );
}

export function WorkspaceList({
  children,
  ariaLabel,
}: {
  children: ReactNode;
  ariaLabel: string;
}) {
  return <div className="app-workspace-list" role="list" aria-label={ariaLabel}>{children}</div>;
}

export function WorkspaceListItem({
  children,
  selected = false,
  href,
  ariaLabel,
}: {
  children: ReactNode;
  selected?: boolean;
  href?: string;
  ariaLabel?: string;
}) {
  const className = `app-workspace-list-item ${selected ? "is-selected" : ""}`.trim();

  if (href) {
    return (
      <a className={className} href={href} aria-current={selected ? "true" : undefined} aria-label={ariaLabel} role="listitem">
        {children}
      </a>
    );
  }

  return (
    <div className={className} aria-current={selected ? "true" : undefined} aria-label={ariaLabel} role="listitem">
      {children}
    </div>
  );
}

export function OperationsToolbar({
  search,
  filters,
  context,
  actions,
}: {
  search?: ReactNode;
  filters?: ReactNode;
  context?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="app-operations-toolbar" role="group" aria-label="View controls">
      <div className="app-toolbar-primary">
        {search}
        {filters ? <div className="app-toolbar-filters">{filters}</div> : null}
      </div>
      <div className="app-toolbar-secondary">
        {context}
        {actions ? <div className="app-toolbar-actions">{actions}</div> : null}
      </div>
    </div>
  );
}

export function SearchField({
  name = "search",
  label = "Search",
  defaultValue,
  placeholder = "Search",
}: {
  name?: string;
  label?: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <label className="app-search-field">
      <span className="app-sr-only">{label}</span>
      <span className="app-search-icon" aria-hidden="true">⌕</span>
      <input name={name} type="search" defaultValue={defaultValue} placeholder={placeholder} />
    </label>
  );
}

export function FilterSelect({
  name,
  label,
  defaultValue,
  children,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  children: ReactNode;
}) {
  return (
    <label className="app-filter-select">
      <span>{label}</span>
      <select name={name} defaultValue={defaultValue}>{children}</select>
    </label>
  );
}

export function FilterChip({
  children,
  active = false,
  href,
}: {
  children: ReactNode;
  active?: boolean;
  href?: string;
}) {
  const className = `app-filter-chip ${active ? "is-active" : ""}`.trim();
  return href
    ? <a className={className} href={href} aria-current={active ? "true" : undefined}>{children}</a>
    : <span className={className}>{children}</span>;
}

export function SegmentedTabs({
  label,
  tabs,
}: {
  label: string;
  tabs: Array<{ label: string; href: string; active?: boolean; count?: number }>;
}) {
  return (
    <nav className="app-segmented-tabs" aria-label={label}>
      {tabs.map((tab) => (
        <a className={tab.active ? "is-active" : undefined} href={tab.href} aria-current={tab.active ? "page" : undefined} key={tab.href}>
          <span>{tab.label}</span>
          {typeof tab.count === "number" ? <span className="app-tab-count">{tab.count}</span> : null}
        </a>
      ))}
    </nav>
  );
}

export function SortControl({
  name = "sort",
  label = "Sort",
  defaultValue,
  children,
}: {
  name?: string;
  label?: string;
  defaultValue?: string;
  children: ReactNode;
}) {
  return (
    <label className="app-sort-control">
      <span>{label}</span>
      <select name={name} defaultValue={defaultValue}>{children}</select>
    </label>
  );
}

export function ToolbarResultCount({ count, label = "results" }: { count: number; label?: string }) {
  return <span className="app-result-count">{count} {count === 1 ? label.replace(/s$/, "") : label}</span>;
}
