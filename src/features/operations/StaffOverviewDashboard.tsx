import Link from "next/link";
import { FeedbackBanner } from "@/components/product/FeedbackPrimitives";
import { StatusBadge } from "@/components/product/PagePrimitives";
import { buildStaffModuleHref } from "@/features/operations/staff-modules";
import type {
  OperationalAttention,
  OperationalStaffSnapshot,
  OperationalVisit,
} from "./operational-product-runtime";
import { summarizeOutstandingInvoices } from "./product-truth";
import { formatMinorMoney } from "./view-models";
import { createLocalDayKey } from "./staff-local-day";
import { indexStaffById } from "./staff-snapshot-index";
import styles from "./StaffOverviewDashboard.module.css";

function attentionTone(severity: "INFO" | "WARNING" | "CRITICAL") {
  if (severity === "CRITICAL") return "danger" as const;
  if (severity === "WARNING") return "warning" as const;
  return "info" as const;
}

function readable(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}


function formatTime(value: string, timeZone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(date);
}

function formatDate(value: string, timeZone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone,
  }).format(date);
}

function attentionResourceHref(workspaceSlug: string, item: OperationalAttention) {
  const workspace = encodeURIComponent(workspaceSlug);
  const resourceId = encodeURIComponent(item.resourceId);
  switch (item.resourceType.toLowerCase()) {
    case "conversation":
      return `/app/${workspace}/inbox?conversation=${resourceId}`;
    case "customer":
      return `/app/${workspace}/customers?customer=${resourceId}`;
    case "request":
      return `/app/${workspace}/requests?request=${resourceId}`;
    case "quote":
      return `/app/${workspace}/quotes?quote=${resourceId}`;
    case "visit":
    case "job":
      return `/app/${workspace}/jobs?job=${resourceId}`;
    case "invoice":
      return `/app/${workspace}/invoices?invoice=${resourceId}`;
    case "quality":
    case "quality_case":
      return `/app/${workspace}/quality?case=${resourceId}`;
    default:
      return buildStaffModuleHref(workspaceSlug, "automations");
  }
}

function visitTone(status: string) {
  if (["IN_PROGRESS", "EN_ROUTE"].includes(status)) return "info" as const;
  if (["PAYMENT_REVIEW", "PENDING_REVIEW", "AWAITING_PAYMENT"].includes(status)) return "warning" as const;
  if (["CONFIRMED", "ASSIGNED"].includes(status)) return "neutral" as const;
  return "neutral" as const;
}

function KpiCard({
  label,
  value,
  detail,
  href,
  emphasis = "default",
}: {
  label: string;
  value: string | number;
  detail: string;
  href: string;
  emphasis?: "default" | "warning" | "danger";
}) {
  return (
    <Link className={`${styles.kpiCard} ${styles[`kpi_${emphasis}`]}`} href={href}>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
      <span className={styles.kpiGo} aria-hidden="true">↗</span>
    </Link>
  );
}

function EmptyBlock({ title, description }: { title: string; description: string }) {
  return (
    <div className={styles.emptyBlock}>
      <span aria-hidden="true">✓</span>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </div>
  );
}

function ScheduleRow({
  visit,
  timeZone,
  records,
  workspace,
}: {
  visit: OperationalVisit;
  timeZone: string;
  records: {
    requests: ReadonlyMap<string, OperationalStaffSnapshot["requests"][number]>;
    customers: ReadonlyMap<string, OperationalStaffSnapshot["customers"][number]>;
    crews: ReadonlyMap<string, OperationalStaffSnapshot["crews"][number]>;
  };
  workspace: string;
}) {
  const request = records.requests.get(visit.requestId);
  const customer = request?.customerId
    ? records.customers.get(request.customerId)
    : undefined;
  const crew = visit.crewId ? records.crews.get(visit.crewId) : undefined;

  return (
    <Link className={styles.scheduleRow} href={`/app/${encodeURIComponent(workspace)}/jobs?job=${encodeURIComponent(visit.id)}`}>
      <time className={styles.scheduleTime}>{formatTime(visit.startAt, timeZone)}</time>
      <span className={styles.scheduleMarker} aria-hidden="true" />
      <span className={styles.scheduleCopy}>
        <strong>{request?.serviceLabel ?? "Service visit"}</strong>
        <small>{customer?.displayName ?? "Customer"} · {crew?.name ?? "Crew unassigned"}</small>
      </span>
      <StatusBadge tone={visitTone(visit.status)}>{readable(visit.status)}</StatusBadge>
    </Link>
  );
}

export function StaffOverviewDashboard({
  workspace,
  snapshot,
  errorMessage,
}: {
  workspace: string;
  snapshot?: Pick<
    OperationalStaffSnapshot,
    | "loadedAt"
    | "workspace"
    | "customers"
    | "requests"
    | "quotes"
    | "visits"
    | "invoices"
    | "attentionItems"
    | "qualityCases"
    | "crews"
  >;
  errorMessage?: string;
}) {
  if (!snapshot) {
    return (
      <div className={styles.dashboard}>
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.eyebrow}>Operations</p>
            <h1>Today</h1>
            <p>Current workspace activity could not be loaded.</p>
          </div>
        </header>
        <FeedbackBanner
          title="Workspace activity is unavailable"
          description={errorMessage ?? "Refresh the page or try again shortly."}
          tone="danger"
        />
      </div>
    );
  }

  const attention = snapshot.attentionItems.filter((item) => item.status !== "RESOLVED");
  const waitingRequests = snapshot.requests.filter((request) => ["NEW", "COLLECTING", "READY", "NEEDS_REVIEW"].includes(request.status));
  const waitingQuotes = snapshot.quotes.filter((quote) => quote.status === "SENT");
  const qualityIssues = snapshot.qualityCases.filter((qualityCase) => qualityCase.state !== "RESOLVED");
  const outstanding = summarizeOutstandingInvoices(snapshot.invoices);
  const outstandingValue = outstanding.currency && outstanding.totalMinor !== undefined
    ? formatMinorMoney(outstanding.totalMinor, outstanding.currency)
    : outstanding.multipleCurrencies
      ? "Multiple currencies"
      : "—";

  // A single timezone formatter per request avoids repeated Intl construction.
  // Invalid snapshot dates must never silently match invalid visit dates.
  const dayKey = createLocalDayKey(snapshot.workspace.timezone);
  const todayKey = dayKey(snapshot.loadedAt);
  const todayVisits = todayKey
    ? snapshot.visits
      .filter((visit) => !["COMPLETED", "CANCELLED"].includes(visit.status))
      .filter((visit) => dayKey(visit.startAt) === todayKey)
      .sort((left, right) => Date.parse(left.startAt) - Date.parse(right.startAt))
    : [];
  const records = {
    requests: indexStaffById(snapshot.requests),
    customers: indexStaffById(snapshot.customers),
    crews: indexStaffById(snapshot.crews),
  };
  const unassignedToday = todayVisits.filter((visit) => !visit.crewId).length;
  const inProgressToday = todayVisits.filter((visit) => ["IN_PROGRESS", "EN_ROUTE"].includes(visit.status)).length;
  const criticalAttention = attention.filter((item) => item.severity === "CRITICAL").length;
  const sortedAttention = [...attention].sort((left, right) => {
    const weight = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    const severity = weight[left.severity] - weight[right.severity];
    if (severity !== 0) return severity;
    return (left.dueAt ? Date.parse(left.dueAt) : Number.MAX_SAFE_INTEGER)
      - (right.dueAt ? Date.parse(right.dueAt) : Number.MAX_SAFE_INTEGER);
  });

  return (
    <div className={styles.dashboard}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Your workday / operations</p>
          <h1>Today</h1>
          <p>{formatDate(snapshot.loadedAt, snapshot.workspace.timezone)} <span aria-hidden="true">·</span> {snapshot.workspace.name} <span aria-hidden="true">·</span> Snapshot updated {formatTime(snapshot.loadedAt, snapshot.workspace.timezone)}</p>
        </div>
        <div className={styles.headerActions}>
          <Link className="app-button-secondary" href={buildStaffModuleHref(workspace, "schedule")}>View schedule</Link>
          <Link className="app-button-primary" href={buildStaffModuleHref(workspace, "inbox")}>Open inbox</Link>
        </div>
      </header>

      <section className={styles.workdayBrief} aria-label="Workday briefing">
        <div className={styles.briefingLabel}>
          <span className={styles.liveMarker} aria-hidden="true" />
          <span>Operational brief</span>
        </div>
        <p>
          {criticalAttention > 0
            ? `${criticalAttention} critical item${criticalAttention === 1 ? "" : "s"} require a decision.`
            : attention.length
              ? `${attention.length} open item${attention.length === 1 ? "" : "s"} to work through.`
              : "No outstanding operational escalations."}
          {" "}
          {unassignedToday > 0
            ? `${unassignedToday} visit${unassignedToday === 1 ? "" : "s"} still need a crew.`
            : todayVisits.length
              ? "Today's visits have crew coverage."
              : "No visits are scheduled for today."}
        </p>
        <Link href={buildStaffModuleHref(workspace, criticalAttention || attention.length ? "automations" : "schedule")}>
          {attention.length ? "Review priorities" : "Open dispatch"} <span aria-hidden="true">↗</span>
        </Link>
      </section>

      <nav className={styles.kpiGrid} aria-label="Open operational queues">
        <KpiCard
          label="Today's jobs"
          href={buildStaffModuleHref(workspace, "schedule") + (unassignedToday ? "?queue=unassigned" : "")}
          value={todayVisits.length}
          detail={unassignedToday ? `${unassignedToday} need crew` : `${inProgressToday} underway`}
          emphasis={unassignedToday ? "warning" : "default"}
        />
        <KpiCard
          label="Needs attention"
          href={buildStaffModuleHref(workspace, "automations")}
          value={attention.length}
          detail={criticalAttention ? `${criticalAttention} critical` : "No critical issues"}
          emphasis={criticalAttention ? "danger" : attention.length ? "warning" : "default"}
        />
        <KpiCard
          label="Waiting pipeline"
          href={buildStaffModuleHref(workspace, waitingRequests.length ? "requests" : "quotes")}
          value={waitingRequests.length + waitingQuotes.length}
          detail={`${waitingRequests.length} requests · ${waitingQuotes.length} quotes`}
        />
        <KpiCard
          label="Outstanding"
          href={buildStaffModuleHref(workspace, "invoices")}
          value={outstandingValue}
          detail={outstanding.count ? `${outstanding.count} open invoice${outstanding.count === 1 ? "" : "s"}` : "Nothing to collect"}
        />
      </nav>

      <div className={styles.primaryGrid}>
        <section className={`${styles.card} ${styles.attentionCard}`} aria-labelledby="attention-heading">
          <div className={styles.cardHeader}>
            <div>
              <p className={styles.cardEyebrow}>Priority queue</p>
              <h2 id="attention-heading">Decisions waiting for you</h2>
              <p>Decision queue ordered by severity and due time.</p>
            </div>
            <Link className={styles.textLink} href={buildStaffModuleHref(workspace, "automations")}>All items →</Link>
          </div>
          {sortedAttention.length ? (
            <div className={styles.attentionList}>
              {sortedAttention.slice(0, 6).map((item) => (
                <Link className={styles.attentionRow} href={attentionResourceHref(workspace, item)} key={item.id}>
                  <span className={`${styles.severityDot} ${styles[`severity_${item.severity.toLowerCase()}`]}`} aria-hidden="true" />
                  <span className={styles.attentionCopy}>
                    <strong>{item.summary}</strong>
                    <small>{readable(item.resourceType)} · {item.ownerUserId ? "Assigned" : "Unassigned"}</small>
                  </span>
                  <StatusBadge tone={attentionTone(item.severity)}>{readable(item.severity)}</StatusBadge>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyBlock title="No open attention items" description="There is no operational recovery work waiting right now." />
          )}
        </section>
        <section className={styles.card} aria-labelledby="today-heading">
          <div className={styles.cardHeader}>
            <div>
              <p className={styles.cardEyebrow}>Today</p>
              <h2 id="today-heading">Today&apos;s field plan</h2>
              <p>{todayVisits.length ? `${todayVisits.length} active service visit${todayVisits.length === 1 ? "" : "s"} in the current workday.` : "No active visits are scheduled for today."}</p>
            </div>
            <Link className={styles.textLink} href={buildStaffModuleHref(workspace, "schedule")}>Open dispatch →</Link>
          </div>
          {todayVisits.length ? (
            <div className={styles.scheduleList}>
              {todayVisits.slice(0, 8).map((visit) => (
                <ScheduleRow key={visit.id} visit={visit} timeZone={snapshot.workspace.timezone} records={records} workspace={workspace} />
              ))}
            </div>
          ) : (
            <EmptyBlock title="Schedule is clear" description="New confirmed visits will appear here automatically." />
          )}
        </section>

      </div>

      <div className={styles.secondaryGrid}>
        <section className={styles.card} aria-labelledby="pipeline-heading">
          <div className={styles.cardHeader}>
            <div>
              <p className={styles.cardEyebrow}>Customer pipeline</p>
              <h2 id="pipeline-heading">Work moving through sales</h2>
            </div>
            <Link className={styles.textLink} href={buildStaffModuleHref(workspace, "requests")}>Open requests →</Link>
          </div>
          <div className={styles.pipelineGrid}>
            <Link href={buildStaffModuleHref(workspace, "requests")} className={styles.pipelineItem}>
              <span>Requests to review</span>
              <strong>{waitingRequests.length}</strong>
              <small>Needs intake or staff review</small>
            </Link>
            <Link href={buildStaffModuleHref(workspace, "quotes")} className={styles.pipelineItem}>
              <span>Quotes with customer</span>
              <strong>{waitingQuotes.length}</strong>
              <small>Waiting for customer reply</small>
            </Link>
            <Link href={buildStaffModuleHref(workspace, "invoices")} className={styles.pipelineItem}>
              <span>Invoices to collect</span>
              <strong>{outstanding.count}</strong>
              <small>{outstandingValue}</small>
            </Link>
          </div>
        </section>

        <section className={styles.card} aria-labelledby="quality-heading">
          <div className={styles.cardHeader}>
            <div>
              <p className={styles.cardEyebrow}>Service quality</p>
              <h2 id="quality-heading">Completion follow-up</h2>
            </div>
            <Link className={styles.textLink} href={buildStaffModuleHref(workspace, "quality")}>Quality queue →</Link>
          </div>
          {qualityIssues.length ? (
            <div className={styles.qualityList}>
              {qualityIssues.slice(0, 4).map((item) => (
                <Link className={styles.qualityRow} href={`/app/${encodeURIComponent(workspace)}/quality?case=${encodeURIComponent(item.id)}`} key={item.id}>
                  <span>
                    <strong>{item.summary}</strong>
                    <small>{item.feedbackScore !== undefined ? `Feedback ${item.feedbackScore}/5` : "Follow-up required"}</small>
                  </span>
                  <StatusBadge tone={item.state === "OPEN" ? "warning" : "info"}>{readable(item.state)}</StatusBadge>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyBlock title="No unresolved quality cases" description="Completed work has no open quality follow-up." />
          )}
        </section>
      </div>

      <nav className={styles.quickActions} aria-label="Common operational destinations">
        <span>Quick access</span>
        <Link href={buildStaffModuleHref(workspace, "inbox")}>Inbox</Link>
        <Link href={buildStaffModuleHref(workspace, "requests")}>Requests</Link>
        <Link href={buildStaffModuleHref(workspace, "schedule")}>Dispatch</Link>
        <Link href={buildStaffModuleHref(workspace, "jobs")}>Jobs</Link>
        <Link href={buildStaffModuleHref(workspace, "invoices")}>Invoices</Link>
        <Link href={buildStaffModuleHref(workspace, "reports")}>Reports</Link>
      </nav>
    </div>
  );
}
