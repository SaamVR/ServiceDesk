import type { ReactNode } from "react";

export type FeedbackTone = "neutral" | "success" | "warning" | "danger" | "info";

export function FeedbackBanner({
  title,
  description,
  tone = "neutral",
  action,
  live = "polite",
}: {
  title: string;
  description?: string;
  tone?: FeedbackTone;
  action?: ReactNode;
  live?: "polite" | "assertive";
}) {
  return (
    <div
      className={`app-feedback app-feedback-${tone}`}
      role={tone === "danger" ? "alert" : "status"}
      aria-live={live}
      aria-atomic="true"
    >
      <span className="app-feedback-indicator" aria-hidden="true" />
      <div className="app-feedback-copy">
        <strong>{title}</strong>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="app-feedback-action">{action}</div> : null}
    </div>
  );
}

export function InlineLoading({
  label = "Working",
}: {
  label?: string;
}) {
  return (
    <span className="app-inline-loading" role="status" aria-live="polite">
      <span className="app-spinner" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function SkeletonBlock({
  lines = 3,
  label = "Loading content",
}: {
  lines?: number;
  label?: string;
}) {
  return (
    <div className="app-skeleton-block" role="status" aria-label={label} aria-busy="true">
      {Array.from({ length: Math.max(1, lines) }, (_, index) => (
        <span
          className={`app-skeleton app-skeleton-line ${index === lines - 1 ? "app-skeleton-short" : ""}`.trim()}
          key={index}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

export function PendingAction({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="app-pending-action" role="status" aria-live="polite">
      <span className="app-spinner" aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        {description ? <p>{description}</p> : null}
      </div>
    </div>
  );
}

export function Toast({
  title,
  description,
  tone = "neutral",
  dismissLabel = "Dismiss notification",
}: {
  title: string;
  description?: string;
  tone?: FeedbackTone;
  dismissLabel?: string;
}) {
  return (
    <div
      className={`app-toast app-toast-${tone}`}
      role={tone === "danger" ? "alert" : "status"}
      aria-live={tone === "danger" ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <span className="app-toast-indicator" aria-hidden="true" />
      <div className="app-toast-copy">
        <strong>{title}</strong>
        {description ? <p>{description}</p> : null}
      </div>
      <button className="app-toast-dismiss" type="button" aria-label={dismissLabel}>×</button>
    </div>
  );
}

export function ToastRegion({ children }: { children: ReactNode }) {
  return <div className="app-toast-region" aria-label="Notifications">{children}</div>;
}
