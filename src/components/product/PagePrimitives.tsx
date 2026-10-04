import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="app-page-header">
      <div className="app-page-heading">
        {eyebrow ? <p className="app-eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="app-page-actions">{actions}</div> : null}
    </header>
  );
}

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="app-section-header">
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Panel({ children, className = "", ariaLabel }: { children: ReactNode; className?: string; ariaLabel?: string }) {
  return <section className={`app-panel ${className}`.trim()} aria-label={ariaLabel}>{children}</section>;
}

export function MetricStrip({ items }: { items: Array<{ label: string; value: ReactNode; detail?: string; tone?: "default" | "attention" | "critical" }> }) {
  return (
    <dl className="app-metric-strip">
      {items.map((item) => (
        <div className={`app-metric ${item.tone ? `is-${item.tone}` : ""}`.trim()} key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
          {item.detail ? <span>{item.detail}</span> : null}
        </div>
      ))}
    </dl>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="app-empty-state">
      <span className="app-empty-icon" aria-hidden="true">—</span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="app-toolbar" role="group">{children}</div>;
}

export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "info" }) {
  return <span className={`app-status app-status-${tone}`}>{children}</span>;
}
