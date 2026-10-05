import { redirect } from "next/navigation";
import {
  acceptCustomerPortalQuote,
  loadCustomerPortalSnapshot,
  type CustomerPortalActionResult,
  type CustomerPortalSnapshot,
} from "./customer-product-runtime";
import { formatMinorMoney } from "./view-models";
import { PageHeader } from "@/components/product";
import styles from "./OperationalProductRoute.module.css";
import shellStyles from "./CustomerPublicProduct.module.css";

type CustomerModule = "overview" | "properties" | "quote" | "booking" | "invoice" | "preferences";

interface CustomerProductRouteProps {
  module: CustomerModule;
  resourceId?: string;
  notice?: string;
  error?: string;
}

function formatWhen(value?: string) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function statusTone(status: string) {
  if (["PAID", "COMPLETED", "ACCEPTED", "DELIVERED", "READ"].includes(status)) return "success";
  if (["FAILED", "CANCELLED", "VOID", "EXPIRED", "PAYMENT_REVIEW"].includes(status)) return "attention";
  return "pending";
}

function actionRedirect(path: string, result: CustomerPortalActionResult): never {
  const key = result.ok ? "notice" : "error";
  redirect(path + "?" + key + "=" + encodeURIComponent(result.message));
}

function Notice({ notice, error }: { notice?: string; error?: string }) {
  if (!notice && !error) return null;
  return (
    <p className={error ? styles.errorNotice : styles.successNotice} role="status">
      {error ?? notice}
    </p>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <section className="plain-card">
      <h2>{title}</h2>
      <p>{detail}</p>
    </section>
  );
}

function CustomerNavigation({ module }: { module: CustomerModule }) {
  const items = [
    { href: "/portal", label: "Overview", active: module === "overview" },
    { href: "/portal/properties", label: "Properties", active: module === "properties" },
    { href: "/portal/preferences", label: "Preferences", active: module === "preferences" },
  ];
  return (
    <nav className={shellStyles.portalNav} aria-label="Customer portal navigation">
      {items.map((item) => (
        <a href={item.href} aria-current={item.active ? "page" : undefined} key={item.href}>
          {item.label}
        </a>
      ))}
    </nav>
  );
}

function OverviewView({ data }: { data: CustomerPortalSnapshot }) {
  const activeQuotes = data.quotes.filter((quote) => !["DECLINED", "EXPIRED", "SUPERSEDED"].includes(quote.status));
  const upcomingVisits = data.visits.filter((visit) => Date.parse(visit.startAt) >= Date.now());
  const openInvoices = data.invoices.filter((invoice) => invoice.balanceMinor > 0 && invoice.status !== "VOID");

  return (
    <div className={styles.stack}>
      <div className="metric-grid">
        <div><dt>Properties</dt><dd>{data.properties.length}</dd></div>
        <div><dt>Open quotes</dt><dd>{activeQuotes.length}</dd></div>
        <div><dt>Upcoming visits</dt><dd>{upcomingVisits.length}</dd></div>
        <div><dt>Open invoices</dt><dd>{openInvoices.length}</dd></div>
      </div>

      <section className="plain-card">
        <h2>Quotes</h2>
        {activeQuotes.length === 0 ? (
          <p>No active quotes.</p>
        ) : (
          activeQuotes.slice(0, 6).map((quote) => (
            <p key={quote.id}>
              <a href={"/portal/quotes/" + encodeURIComponent(quote.id)}>
                {data.requests.find((request) => request.id === quote.requestId)?.serviceLabel ?? "Service quote"}
              </a>
              {" · "}{formatMinorMoney(quote.totalMinor, quote.currency)} · {quote.status.replaceAll("_", " ")}
            </p>
          ))
        )}
      </section>

      <section className="plain-card">
        <h2>Visits</h2>
        {data.visits.length === 0 ? (
          <p>No visits yet.</p>
        ) : (
          data.visits.slice(0, 6).map((visit) => (
            <p key={visit.id}>
              <a href={"/portal/bookings/" + encodeURIComponent(visit.id)}>{formatWhen(visit.startAt)}</a>
              {" · "}{visit.status.replaceAll("_", " ")}
            </p>
          ))
        )}
      </section>

      <section className="plain-card">
        <h2>Invoices</h2>
        {data.invoices.length === 0 ? (
          <p>No invoices yet.</p>
        ) : (
          data.invoices.slice(0, 6).map((invoice) => (
            <p key={invoice.id}>
              <a href={"/portal/invoices/" + encodeURIComponent(invoice.id)}>
                {formatMinorMoney(invoice.balanceMinor, invoice.currency)} balance
              </a>
              {" · "}{invoice.status.replaceAll("_", " ")}
            </p>
          ))
        )}
      </section>
    </div>
  );
}

function PropertiesView({ data }: { data: CustomerPortalSnapshot }) {
  if (data.properties.length === 0) {
    return <EmptyState title="No properties" detail="No property is linked to your customer account yet." />;
  }
  return (
    <div className={styles.stack}>
      {data.properties.map((property) => (
        <section className="plain-card" key={property.id}>
          <p className="label">Property</p>
          <h2>{property.label}</h2>
          <p>{property.address}</p>
          {property.serviceNotes && <p><strong>Service notes:</strong> {property.serviceNotes}</p>}
          {property.accessNotes && <p><strong>Access notes:</strong> {property.accessNotes}</p>}
        </section>
      ))}
    </div>
  );
}

function QuoteView({
  data,
  quoteId,
}: {
  data: CustomerPortalSnapshot;
  quoteId?: string;
}) {
  const quote = data.quotes.find((item) => item.id === quoteId);
  if (!quote) return <EmptyState title="Quote not found" detail="This quote is not available in your account." />;

  const request = data.requests.find((item) => item.id === quote.requestId);

  async function acceptQuote() {
    "use server";
    const result = await acceptCustomerPortalQuote(quote.id);
    actionRedirect("/portal/quotes/" + encodeURIComponent(quote.id), result);
  }

  return (
    <section className="plain-card">
      <div className={styles.sectionHeader}>
        <div>
          <p className="label">{request?.serviceLabel ?? "Service quote"}</p>
          <h2>{formatMinorMoney(quote.totalMinor, quote.currency)}</h2>
        </div>
        <span className={"status-pill " + statusTone(quote.status)}>{quote.status.replaceAll("_", " ")}</span>
      </div>
      <dl className="summary-list">
        <div><dt>Deposit</dt><dd>{formatMinorMoney(quote.depositMinor, quote.currency)}</dd></div>
        <div><dt>Remaining balance</dt><dd>{formatMinorMoney(quote.balanceMinor, quote.currency)}</dd></div>
        <div><dt>Estimated service time</dt><dd>{quote.durationMinutes} min</dd></div>
        <div><dt>Valid until</dt><dd>{formatWhen(quote.validUntil)}</dd></div>
      </dl>
      {quote.status === "SENT" ? (
        <form action={acceptQuote}>
          <button className="button-primary" type="submit">Accept quote</button>
        </form>
      ) : quote.status === "ACCEPTED" ? (
        <p>Quote accepted. The business can now reserve capacity for your booking.</p>
      ) : (
        <p>No action is available for this quote right now.</p>
      )}
    </section>
  );
}

function BookingView({
  data,
  bookingId,
}: {
  data: CustomerPortalSnapshot;
  bookingId?: string;
}) {
  const visit = data.visits.find((item) => item.id === bookingId);
  if (!visit) {
    return <EmptyState title="Booking not found" detail="This booking is not available in your account." />;
  }
  const request = data.requests.find((item) => item.id === visit.requestId);
  const invoice = data.invoices.find((item) => item.visitId === visit.id);

  return (
    <div className={styles.stack}>
      <section className="plain-card">
        <div className={styles.sectionHeader}>
          <div>
            <p className="label">{request?.serviceLabel ?? "Service visit"}</p>
            <h2>{formatWhen(visit.startAt)}</h2>
          </div>
          <span className={"status-pill " + statusTone(visit.status)}>{visit.status.replaceAll("_", " ")}</span>
        </div>
        <dl className="summary-list">
          <div><dt>Start</dt><dd>{formatWhen(visit.startAt)}</dd></div>
          <div><dt>End</dt><dd>{formatWhen(visit.endAt)}</dd></div>
          <div><dt>Payment</dt><dd>{invoice ? invoice.status.replaceAll("_", " ") : "No invoice yet"}</dd></div>
        </dl>
      </section>
      <section className="plain-card">
        <p className="label">Payment</p>
        <h2>Online payment is not enabled yet</h2>
        <p>
          Your booking and invoice status remain visible here. The business will let you know when
          an online payment option is available.
        </p>
        <button className="button-primary" type="button" disabled>
          Pay online
        </button>
      </section>
    </div>
  );
}

function InvoiceView({
  data,
  invoiceId,
}: {
  data: CustomerPortalSnapshot;
  invoiceId?: string;
}) {
  const invoice = data.invoices.find((item) => item.id === invoiceId);
  if (!invoice) {
    return <EmptyState title="Invoice not found" detail="This invoice is not available in your account." />;
  }

  return (
    <section className="plain-card">
      <div className={styles.sectionHeader}>
        <div>
          <p className="label">Invoice</p>
          <h2>{formatMinorMoney(invoice.totalMinor, invoice.currency)}</h2>
        </div>
        <span className={"status-pill " + statusTone(invoice.status)}>{invoice.status.replaceAll("_", " ")}</span>
      </div>
      <dl className="summary-list">
        <div><dt>Total</dt><dd>{formatMinorMoney(invoice.totalMinor, invoice.currency)}</dd></div>
        <div><dt>Paid / allocated</dt><dd>{formatMinorMoney(invoice.allocatedMinor, invoice.currency)}</dd></div>
        <div><dt>Refunded</dt><dd>{formatMinorMoney(invoice.refundedMinor, invoice.currency)}</dd></div>
        <div><dt>Balance</dt><dd>{formatMinorMoney(invoice.balanceMinor, invoice.currency)}</dd></div>
      </dl>
      {invoice.status === "PAID" ? (
        <p>Payment is recorded as paid.</p>
      ) : (
        <p>Payment remains outstanding until the invoice ledger records a verified or staff-recorded payment.</p>
      )}
    </section>
  );
}

function PreferencesView({ data }: { data: CustomerPortalSnapshot }) {
  return (
    <div className={styles.stack}>
      <section className="plain-card">
        <h2>Communication preferences</h2>
        {data.consents.length === 0 ? (
          <p>No communication preferences are recorded yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Channel</th><th>Purpose</th><th>Status</th><th>Recorded</th></tr></thead>
              <tbody>
                {data.consents.map((consent) => (
                  <tr key={consent.id}>
                    <td>{consent.channel}</td>
                    <td>{consent.purpose}</td>
                    <td>{consent.status}</td>
                    <td>{formatWhen(consent.recordedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="plain-card">
        <button className="button-secondary" type="button" disabled>
          Update communication preferences
        </button>
        <p className="form-note">
          Preference changes are not available from the portal yet. Your saved preferences remain unchanged.
        </p>
      </section>
    </div>
  );
}

function renderModule(
  module: CustomerModule,
  data: CustomerPortalSnapshot,
  resourceId?: string,
) {
  switch (module) {
    case "overview":
      return <OverviewView data={data} />;
    case "properties":
      return <PropertiesView data={data} />;
    case "quote":
      return <QuoteView data={data} quoteId={resourceId} />;
    case "booking":
      return <BookingView data={data} bookingId={resourceId} />;
    case "invoice":
      return <InvoiceView data={data} invoiceId={resourceId} />;
    case "preferences":
      return <PreferencesView data={data} />;
  }
}

const moduleTitle: Record<CustomerModule, string> = {
  overview: "Your service account",
  properties: "Your properties",
  quote: "Quote",
  booking: "Booking",
  invoice: "Invoice",
  preferences: "Communication preferences",
};

export async function CustomerProductRoute({
  module,
  resourceId,
  notice,
  error,
}: CustomerProductRouteProps) {
  const result = await loadCustomerPortalSnapshot();

  return (
    <main className={shellStyles.portalShell}>
      <header className={shellStyles.portalHeader} aria-label="Customer portal navigation">
        <a className={shellStyles.portalBrand} href="/portal">
          <span className={shellStyles.brandMark} aria-hidden="true">SD</span>
          <span>{result.ok ? result.value.workspace.name : "Customer portal"}</span>
        </a>
        <CustomerNavigation module={module} />
      </header>

      <section className={shellStyles.portalBody}>
        <PageHeader eyebrow="Customer account" title={moduleTitle[module]} />
        {result.ok ? (
          <p className={shellStyles.customerWelcome}>Welcome, {result.value.customer.displayName}.</p>
        ) : null}

        <Notice notice={notice} error={error} />

        {result.ok ? (
          renderModule(module, result.value, resourceId)
        ) : (
          <section className="plain-card">
            <span className="status-pill attention">{result.kind.replaceAll("_", " ")}</span>
            <h2>{result.kind === "authentication" ? "Sign in required" : "Portal unavailable"}</h2>
            <p>{result.message}</p>
          </section>
        )}
      </section>
    </main>
  );
}
