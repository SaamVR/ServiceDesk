import Link from "next/link";
import { EmptyState, MetricStrip, PageHeader, Panel, SectionHeader, StatusBadge } from "@/components/product/PagePrimitives";
import { buildStaffModuleHref } from "@/features/operations/staff-modules";
import type { OperationalStaffSnapshot } from "./operational-product-runtime";
import { FeedbackBanner } from "@/components/product/FeedbackPrimitives";
import { summarizeOutstandingInvoices } from "./product-truth";
import { formatMinorMoney } from "./view-models";

function attentionTone(severity: "INFO" | "WARNING" | "CRITICAL") {
  if (severity === "CRITICAL") return "danger" as const;
  if (severity === "WARNING") return "warning" as const;
  return "info" as const;
}

function readable(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function formatVisitStart(value: string, timeZone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
}

export function StaffOverviewDashboard({
  workspace,
  snapshot,
  errorMessage,
}: {
  workspace: string;
  snapshot?: Pick<
    OperationalStaffSnapshot,
    "workspace" | "requests" | "quotes" | "visits" | "invoices" | "attentionItems" | "qualityCases"
  >;
  errorMessage?: string;
}) {
  if (!snapshot) {
    return (
      <>
        <PageHeader
          eyebrow="Operations"
          title="Overview"
          description="Your operational workspace for enquiries, scheduling, payments and service quality."
        />
        <Panel>
          <FeedbackBanner
            title="Workspace activity is unavailable"
            description={errorMessage ?? "We could not load current workspace activity. Refresh the page or try again shortly."}
            tone="danger"
          />
        </Panel>
      </>
    );
  }

  const attention = snapshot.attentionItems.filter((item) => item.status !== "RESOLVED");
  const activeJobs = snapshot.visits.filter((visit) => !["COMPLETED", "CANCELLED"].includes(visit.status));
  const waitingRequests = snapshot.requests.filter((request) => ["NEW", "COLLECTING", "READY", "NEEDS_REVIEW"].includes(request.status));
  const waitingQuotes = snapshot.quotes.filter((quote) => quote.status === "SENT");
  const outstanding = summarizeOutstandingInvoices(snapshot.invoices);
  const qualityIssues = snapshot.qualityCases.filter((qualityCase) => qualityCase.state !== "RESOLVED");

  const outstandingValue = outstanding.currency && outstanding.totalMinor !== undefined
    ? formatMinorMoney(outstanding.totalMinor, outstanding.currency)
    : outstanding.multipleCurrencies
      ? "Multiple currencies"
      : "—";
  const sortedAttention = [...attention].sort((left, right) => {
    const weight = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    return weight[left.severity] - weight[right.severity];
  });

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Overview"
        description="Prioritize the work that needs attention, then move through active service operations."
        actions={<Link className="app-button-primary" href={buildStaffModuleHref(workspace, "inbox")}>Open inbox</Link>}
      />

      <MetricStrip
        items={[
          { label: "Needs attention", value: attention.length, detail: "Open operational items", tone: attention.some((item) => item.severity === "CRITICAL") ? "critical" : attention.length ? "attention" : "default" },
          { label: "Active jobs", value: activeJobs.length, detail: "Not completed or cancelled" },
          { label: "Waiting requests", value: waitingRequests.length, detail: "Needs intake or review" },
          { label: "Quotes awaiting reply", value: waitingQuotes.length, detail: "Sent to customers" },
          { label: "Outstanding", value: outstandingValue, detail: outstanding.count ? `${outstanding.count} invoice${outstanding.count === 1 ? "" : "s"}${outstanding.multipleCurrencies ? " across multiple currencies" : ""}` : "No unpaid invoices" },
        ]}
      />

      <div className="app-grid app-grid-two">
        <Panel>
          <SectionHeader
            title="Needs attention"
            description="Open items ordered by severity."
            action={<Link className="app-button-secondary" href={buildStaffModuleHref(workspace, "automations")}>View queue</Link>}
          />
          {sortedAttention.length ? (
            <div className="app-row-list">
              {sortedAttention.slice(0, 7).map((item) => (
                <article className="app-row" key={item.id}>
                  <div>
                    <h3>{item.summary}</h3>
                    <p>{item.resourceType} · {item.resourceId}</p>
                  </div>
                  <div className="app-row-meta">
                    <StatusBadge tone={attentionTone(item.severity)}>{readable(item.severity)}</StatusBadge>
                    <span>{item.ownerUserId ? "Assigned" : "Unassigned"}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="No open attention items" description="Nothing in the current workspace snapshot requires operational review." />
          )}
        </Panel>

        <Panel>
          <SectionHeader
            title="Service quality"
            description="Unresolved customer or completion issues."
            action={<Link className="app-button-secondary" href={buildStaffModuleHref(workspace, "quality")}>Open quality</Link>}
          />
          {qualityIssues.length ? (
            <div className="app-row-list">
              {qualityIssues.slice(0, 5).map((item) => (
                <article className="app-row" key={item.id}>
                  <div>
                    <h3>{item.summary}</h3>
                    <p>Visit {item.visitId}</p>
                  </div>
                  <div className="app-row-meta">
                    <StatusBadge tone={item.state === "OPEN" ? "warning" : "info"}>{readable(item.state)}</StatusBadge>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="No unresolved quality cases" description="There are no open quality cases in the current workspace snapshot." />
          )}
        </Panel>

        <Panel>
          <SectionHeader
            title="Active jobs"
            description="Upcoming and in-progress visits."
            action={<Link className="app-button-secondary" href={buildStaffModuleHref(workspace, "jobs")}>View jobs</Link>}
          />
          {activeJobs.length ? (
            <div className="app-row-list">
              {activeJobs.slice(0, 6).map((visit) => (
                <article className="app-row" key={visit.id}>
                  <div>
                    <h3>Visit {visit.id}</h3>
                    <p>{formatVisitStart(visit.startAt, snapshot.workspace.timezone)}</p>
                  </div>
                  <div className="app-row-meta">
                    <StatusBadge tone={visit.status === "PAYMENT_REVIEW" || visit.status === "PENDING_REVIEW" ? "warning" : "neutral"}>{readable(visit.status)}</StatusBadge>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="No active jobs" description="No active visits are present in the current workspace snapshot." />
          )}
        </Panel>

        <Panel>
          <SectionHeader
            title="Waiting pipeline"
            description="Requests and quotes still needing customer or staff action."
            action={<Link className="app-button-secondary" href={buildStaffModuleHref(workspace, "requests")}>Open requests</Link>}
          />
          {waitingRequests.length || waitingQuotes.length ? (
            <div className="app-row-list">
              {waitingRequests.slice(0, 4).map((request) => (
                <article className="app-row" key={request.id}>
                  <div>
                    <h3>{request.serviceCode ?? "Service request"}</h3>
                    <p>Request {request.id}</p>
                  </div>
                  <div className="app-row-meta"><StatusBadge tone="neutral">{readable(request.status)}</StatusBadge></div>
                </article>
              ))}
              {waitingQuotes.slice(0, 3).map((quote) => (
                <article className="app-row" key={quote.id}>
                  <div>
                    <h3>Quote v{quote.version}</h3>
                    <p>{formatMinorMoney(quote.totalMinor, quote.currency)} · Request {quote.requestId}</p>
                  </div>
                  <div className="app-row-meta"><StatusBadge tone="info">Awaiting reply</StatusBadge></div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="No waiting requests or quotes" description="The current workspace snapshot has no open intake or sent-quote work." />
          )}
        </Panel>
      </div>
    </>
  );
}
