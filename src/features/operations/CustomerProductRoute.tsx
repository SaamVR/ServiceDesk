import { redirect } from "next/navigation";
import { DataCellStack, DataTable } from "@/components/product/DataTable";
import {
  CustomerCard,
  CustomerEmptyState,
  CustomerList,
  CustomerListRow,
  CustomerNotice,
  CustomerPageHeader,
  CustomerPortalShell,
  CustomerStatus,
  CustomerSummaryItem,
  CustomerSummaryList,
  type CustomerFacingTone,
} from "@/components/product/CustomerFacingShell";
import {
  acceptCustomerPortalQuote,
  holdCustomerPortalSlot,
  loadCustomerPortalSnapshot,
  updateCustomerCommunicationPreference,
  type CustomerPortalActionResult,
  type CustomerPortalConsent,
  type CustomerPortalSnapshot,
} from "./customer-product-runtime";
import { buildUpcomingVisits } from "./product-truth";
import { formatMinorMoney } from "./view-models";
import styles from "./CustomerProductRoute.module.css";

type CustomerModule = "overview" | "properties" | "quote" | "booking" | "invoice" | "preferences";

interface CustomerProductRouteProps {
  module: CustomerModule;
  resourceId?: string;
  notice?: string;
  error?: string;
}

function formatWhen(value?: string, timeZone?: string) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
        ...(timeZone ? { timeZone } : {}),
      }).format(date);
}

function formatStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(status: string): CustomerFacingTone {
  if (["PAID", "COMPLETED", "ACCEPTED", "DELIVERED", "READ", "CONFIRMED", "GRANTED"].includes(status)) {
    return "success";
  }
  if (["FAILED", "CANCELLED", "VOID"].includes(status)) return "danger";
  if (["EXPIRED", "PAYMENT_REVIEW", "PENDING_REVIEW", "REVOKED"].includes(status)) return "warning";
  if (["SENT", "SCHEDULED", "OPEN"].includes(status)) return "info";
  return "neutral";
}

function actionRedirect(path: string, result: CustomerPortalActionResult): never {
  const key = result.ok ? "notice" : "error";
  redirect(path + "?" + key + "=" + encodeURIComponent(result.message));
}

function Notice({ notice, error }: { notice?: string; error?: string }) {
  if (!notice && !error) return null;

  return error ? (
    <CustomerNotice
      title="We couldn't complete that action"
      description={error}
      tone="danger"
      assertive
    />
  ) : (
    <CustomerNotice title="Account updated" description={notice} tone="success" />
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <CustomerEmptyState
      title={title}
      description={detail}
      action={<a className={styles.secondaryButton} href="/portal">Back to overview</a>}
    />
  );
}

function Status({ value }: { value: string }) {
  return <CustomerStatus tone={statusTone(value)}>{formatStatus(value)}</CustomerStatus>;
}

function OverviewView({ data }: { data: CustomerPortalSnapshot }) {
  const activeQuotes = data.quotes.filter((quote) => !["DECLINED", "EXPIRED", "SUPERSEDED"].includes(quote.status));
  const upcomingVisits = buildUpcomingVisits(data.visits, data.loadedAt);
  const openInvoices = data.invoices.filter((invoice) => invoice.balanceMinor > 0 && invoice.status !== "VOID");

  const sentQuote = activeQuotes.find((quote) => quote.status === "SENT");
  const nextVisit = upcomingVisits[0];
  const outstandingInvoice = openInvoices[0];

  return (
    <div className={styles.stack}>
      <dl className={styles.overviewMetrics} aria-label="Account summary">
        <div className={styles.metric}><dt>Properties</dt><dd>{data.properties.length}</dd></div>
        <div className={styles.metric}><dt>Open quotes</dt><dd>{activeQuotes.length}</dd></div>
        <div className={styles.metric}><dt>Upcoming bookings</dt><dd>{upcomingVisits.length}</dd></div>
        <div className={styles.metric}><dt>Open invoices</dt><dd>{openInvoices.length}</dd></div>
      </dl>

      <CustomerCard title="Next steps">
        {sentQuote || nextVisit || outstandingInvoice ? (
          <CustomerList>
            {sentQuote ? (
              <CustomerListRow
                title="Review your quote"
                meta={formatMinorMoney(sentQuote.totalMinor, sentQuote.currency)}
                status={<Status value={sentQuote.status} />}
                href={"/portal/quotes/" + encodeURIComponent(sentQuote.id)}
              />
            ) : null}
            {nextVisit ? (
              <CustomerListRow
                title="Upcoming booking"
                meta={formatWhen(nextVisit.startAt, data.workspace.timezone)}
                status={<Status value={nextVisit.status} />}
                href={"/portal/bookings/" + encodeURIComponent(nextVisit.id)}
              />
            ) : null}
            {outstandingInvoice ? (
              <CustomerListRow
                title="Invoice with an outstanding balance"
                meta={formatMinorMoney(outstandingInvoice.balanceMinor, outstandingInvoice.currency)}
                status={<Status value={outstandingInvoice.status} />}
                href={"/portal/invoices/" + encodeURIComponent(outstandingInvoice.id)}
              />
            ) : null}
          </CustomerList>
        ) : (
          <CustomerEmptyState
            title="You're all caught up"
            description="There are no quotes, upcoming bookings or invoice balances that need your attention right now."
          />
        )}
      </CustomerCard>

      <div className={styles.contentGrid}>
        <div className={styles.stack}>
          <CustomerCard title="Quotes">
            {activeQuotes.length === 0 ? (
              <CustomerEmptyState title="No active quotes" description="New quotes will appear here when they are ready for you." />
            ) : (
              <CustomerList>
                {activeQuotes.slice(0, 6).map((quote) => (
                  <CustomerListRow
                    key={quote.id}
                    title={data.requests.find((request) => request.id === quote.requestId)?.serviceLabel ?? "Service quote"}
                    meta={formatMinorMoney(quote.totalMinor, quote.currency)}
                    status={<Status value={quote.status} />}
                    href={"/portal/quotes/" + encodeURIComponent(quote.id)}
                  />
                ))}
              </CustomerList>
            )}
          </CustomerCard>

          <CustomerCard title="Bookings">
            {data.visits.length === 0 ? (
              <CustomerEmptyState title="No bookings yet" description="Confirmed service visits will appear here." />
            ) : (
              <CustomerList>
                {data.visits.slice(0, 6).map((visit) => (
                  <CustomerListRow
                    key={visit.id}
                    title={data.requests.find((request) => request.id === visit.requestId)?.serviceLabel ?? "Service booking"}
                    meta={formatWhen(visit.startAt, data.workspace.timezone)}
                    status={<Status value={visit.status} />}
                    href={"/portal/bookings/" + encodeURIComponent(visit.id)}
                  />
                ))}
              </CustomerList>
            )}
          </CustomerCard>
        </div>

        <CustomerCard title="Invoices">
          {data.invoices.length === 0 ? (
            <CustomerEmptyState title="No invoices yet" description="Invoices will appear here after they are issued." />
          ) : (
            <CustomerList>
              {data.invoices.slice(0, 6).map((invoice) => (
                <CustomerListRow
                  key={invoice.id}
                  title={invoice.balanceMinor > 0 ? formatMinorMoney(invoice.balanceMinor, invoice.currency) + " due" : "Paid in full"}
                  meta={formatMinorMoney(invoice.totalMinor, invoice.currency) + " total"}
                  status={<Status value={invoice.status} />}
                  href={"/portal/invoices/" + encodeURIComponent(invoice.id)}
                />
              ))}
            </CustomerList>
          )}
        </CustomerCard>
      </div>
    </div>
  );
}

function PropertiesView({ data }: { data: CustomerPortalSnapshot }) {
  if (data.properties.length === 0) {
    return <EmptyState title="No properties" detail="No property is linked to your customer account yet." />;
  }

  return (
    <div className={styles.propertyGrid}>
      {data.properties.map((property) => (
        <CustomerCard title={property.label} eyebrow="Property" key={property.id}>
          <p className={styles.propertyAddress}>{property.address || "Address not available"}</p>
          {property.serviceNotes || property.accessNotes ? (
            <div className={styles.noteList}>
              {property.serviceNotes ? (
                <div className={styles.note}>
                  <strong>Service notes</strong>
                  <span>{property.serviceNotes}</span>
                </div>
              ) : null}
              {property.accessNotes ? (
                <div className={styles.note}>
                  <strong>Access notes</strong>
                  <span>{property.accessNotes}</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </CustomerCard>
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
  const quoteIdForAction = quote.id;
  const existingVisit = data.visits.find((visit) => visit.quoteId === quote.id && visit.status !== "CANCELLED");
  const activeHold = data.slotHolds.find((hold) =>
    hold.quoteId === quote.id
    && (hold.status === "CONFIRMED" || Date.parse(hold.expiresAt) > Date.parse(data.loadedAt))
  );
  const bookingSlots = data.bookingSlots.filter((slot) => slot.quoteId === quote.id).slice(0, 8);

  async function acceptQuote() {
    "use server";
    const result = await acceptCustomerPortalQuote(quoteIdForAction);
    actionRedirect("/portal/quotes/" + encodeURIComponent(quoteIdForAction), result);
  }

  async function holdSlot(formData: FormData) {
    "use server";
    const slotId = String(formData.get("slotId") ?? "");
    const result = await holdCustomerPortalSlot(quoteIdForAction, slotId);
    actionRedirect("/portal/quotes/" + encodeURIComponent(quoteIdForAction), result);
  }

  return (
    <CustomerCard
      className={styles.detailCard}
      title={request?.serviceLabel ?? "Service quote"}
      eyebrow="Quote details"
      action={<Status value={quote.status} />}
    >
      <div className={styles.detailHeader}>
        <div>
          <p className={styles.detailLabel}>Quote total</p>
          <h2>{formatMinorMoney(quote.totalMinor, quote.currency)}</h2>
        </div>
      </div>

      <CustomerSummaryList>
        <CustomerSummaryItem label="Deposit" value={formatMinorMoney(quote.depositMinor, quote.currency)} />
        <CustomerSummaryItem label="Remaining balance" value={formatMinorMoney(quote.balanceMinor, quote.currency)} />
        <CustomerSummaryItem label="Estimated service time" value={quote.durationMinutes + " min"} />
        <CustomerSummaryItem label="Valid until" value={formatWhen(quote.validUntil, data.workspace.timezone)} />
      </CustomerSummaryList>

      {quote.status === "SENT" ? (
        <form className={styles.detailActions} action={acceptQuote}>
          <button className={styles.primaryButton} type="submit">Accept quote</button>
        </form>
      ) : quote.status === "ACCEPTED" ? (
        <div className={styles.bookingSection}>
          {existingVisit ? (
            <CustomerNotice
              title="Booking created"
              description={`Your service is scheduled for ${formatWhen(existingVisit.startAt, data.workspace.timezone)}.`}
              tone="success"
              action={
                <a className={styles.secondaryButton} href={"/portal/bookings/" + encodeURIComponent(existingVisit.id)}>
                  View booking
                </a>
              }
            />
          ) : activeHold ? (
            <CustomerNotice
              title="Time reserved"
              description={
                activeHold.status === "CONFIRMED"
                  ? "This service time has been confirmed. Your booking will appear here when the visit record is ready."
                  : `Your selected time is held until ${formatWhen(activeHold.expiresAt, data.workspace.timezone)}. The booking is not confirmed until payment is verified.`
              }
              tone={activeHold.status === "CONFIRMED" ? "success" : "warning"}
            />
          ) : bookingSlots.length > 0 ? (
            <>
              <div className={styles.bookingHeading}>
                <h3>Choose a service time</h3>
                <p>Available times are refreshed from the current workspace schedule. A hold reserves your choice temporarily.</p>
              </div>
              <div className={styles.slotGrid}>
                {bookingSlots.map((slot) => (
                  <form className={styles.slotOption} action={holdSlot} key={slot.id}>
                    <input type="hidden" name="slotId" value={slot.id} />
                    <span className={styles.slotCopy}>
                      <strong>{formatWhen(slot.startAt, data.workspace.timezone)}</strong>
                      <small>Ends {formatWhen(slot.endAt, data.workspace.timezone)}</small>
                    </span>
                    <button className={styles.secondaryButton} type="submit">Hold this time</button>
                  </form>
                ))}
              </div>
            </>
          ) : (
            <CustomerNotice
              title="No times available right now"
              description="There are no open service times in the next two weeks. The business can add availability or help arrange a time."
              tone="info"
            />
          )}
        </div>
      ) : (
        <div className={styles.detailActions}>
          <CustomerNotice
            title="No action needed"
            description="There isn't an available action for this quote right now."
            tone="info"
          />
        </div>
      )}
    </CustomerCard>
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
      <CustomerCard
        className={styles.detailCard}
        title={request?.serviceLabel ?? "Service booking"}
        eyebrow="Booking details"
        action={<Status value={visit.status} />}
      >
        <CustomerSummaryList>
          <CustomerSummaryItem label="Starts" value={formatWhen(visit.startAt, data.workspace.timezone)} />
          <CustomerSummaryItem label="Ends" value={formatWhen(visit.endAt, data.workspace.timezone)} />
          <CustomerSummaryItem label="Payment status" value={invoice ? formatStatus(invoice.status) : "No invoice issued"} />
        </CustomerSummaryList>
      </CustomerCard>

      <CustomerCard className={styles.detailCard} title="Payment">
        {invoice ? (
          <>
            <CustomerNotice
              title={invoice.balanceMinor > 0 ? "Invoice available" : "Payment up to date"}
              description={
                invoice.balanceMinor > 0
                  ? "Your invoice has an outstanding balance. Open it to review the current amount and payment status."
                  : "There is no outstanding balance on this invoice."
              }
              tone={invoice.balanceMinor > 0 ? "warning" : "success"}
            />
            <div className={styles.detailActions}>
              <a className={styles.primaryButton} href={"/portal/invoices/" + encodeURIComponent(invoice.id)}>
                View invoice
              </a>
            </div>
          </>
        ) : (
          <CustomerNotice
            title="No invoice yet"
            description="If payment is required, the business will make an invoice or payment option available in your account."
            tone="info"
          />
        )}
      </CustomerCard>
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
    <CustomerCard
      className={styles.detailCard}
      title={formatMinorMoney(invoice.totalMinor, invoice.currency)}
      eyebrow="Invoice total"
      action={<Status value={invoice.status} />}
    >
      <CustomerSummaryList>
        <CustomerSummaryItem label="Total" value={formatMinorMoney(invoice.totalMinor, invoice.currency)} />
        <CustomerSummaryItem label="Paid / allocated" value={formatMinorMoney(invoice.allocatedMinor, invoice.currency)} />
        <CustomerSummaryItem label="Refunded" value={formatMinorMoney(invoice.refundedMinor, invoice.currency)} />
        <CustomerSummaryItem label="Balance" value={formatMinorMoney(invoice.balanceMinor, invoice.currency)} />
      </CustomerSummaryList>

      <div className={styles.detailActions}>
        {invoice.status === "PAID" || invoice.balanceMinor <= 0 ? (
          <CustomerNotice
            title="Payment complete"
            description="This invoice has no outstanding balance."
            tone="success"
          />
        ) : (
          <CustomerNotice
            title="Balance outstanding"
            description="Online payment is not available from this invoice yet. Contact the business if you need help with payment."
            tone="warning"
          />
        )}
      </div>
    </CustomerCard>
  );
}

function PreferencesView({ data }: { data: CustomerPortalSnapshot }) {
  const seen = new Set<string>();
  const preferences = data.consents.filter((consent) => {
    const key = `${consent.channel}:${consent.purpose}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  async function changePreference(formData: FormData) {
    "use server";
    const status = String(formData.get("status") ?? "");
    const result = await updateCustomerCommunicationPreference({
      consentId: String(formData.get("consentId") ?? ""),
      channel: String(formData.get("channel") ?? ""),
      purpose: String(formData.get("purpose") ?? ""),
      status: status === "GRANTED" ? "GRANTED" : "REVOKED",
    });
    actionRedirect("/portal/preferences", result);
  }

  const columns = [
    {
      id: "channel",
      header: "Channel",
      cell: (consent: CustomerPortalConsent) => <DataCellStack primary={formatStatus(consent.channel)} secondary={formatStatus(consent.purpose)} />,
      priority: "primary" as const,
    },
    {
      id: "status",
      header: "Status",
      cell: (consent: CustomerPortalConsent) => <Status value={consent.status} />,
      priority: "primary" as const,
    },
    {
      id: "recorded",
      header: "Last changed",
      cell: (consent: CustomerPortalConsent) => formatWhen(consent.recordedAt, data.workspace.timezone),
      priority: "secondary" as const,
    },
    {
      id: "action",
      header: "Action",
      align: "end" as const,
      cell: (consent: CustomerPortalConsent) => {
        const nextStatus = consent.status === "GRANTED" ? "REVOKED" : "GRANTED";
        return (
          <form action={changePreference}>
            <input type="hidden" name="consentId" value={consent.id} />
            <input type="hidden" name="channel" value={consent.channel} />
            <input type="hidden" name="purpose" value={consent.purpose} />
            <input type="hidden" name="status" value={nextStatus} />
            <button className={nextStatus === "GRANTED" ? styles.primaryButton : styles.secondaryButton} type="submit">
              {nextStatus === "GRANTED" ? "Allow" : "Revoke"}
            </button>
          </form>
        );
      },
      priority: "primary" as const,
    },
  ];

  return (
    <div className={styles.stack}>
      <CustomerCard title="Communication preferences">
        {preferences.length === 0 ? (
          <CustomerEmptyState
            title="No preferences recorded"
            description="Your saved communication preferences will appear here when they are available."
          />
        ) : (
          <div className={styles.customerTable}>
            <DataTable
              caption="Current communication preferences"
              columns={columns}
              rows={preferences}
              getRowKey={(consent) => consent.id}
              renderMobileRow={(consent) => (
                <div className={styles.preferenceMobileRow}>
                  <DataCellStack
                    primary={formatStatus(consent.channel) + " · " + formatStatus(consent.status)}
                    secondary={formatStatus(consent.purpose) + " · " + formatWhen(consent.recordedAt, data.workspace.timezone)}
                  />
                  <form action={changePreference}>
                    <input type="hidden" name="consentId" value={consent.id} />
                    <input type="hidden" name="channel" value={consent.channel} />
                    <input type="hidden" name="purpose" value={consent.purpose} />
                    <input type="hidden" name="status" value={consent.status === "GRANTED" ? "REVOKED" : "GRANTED"} />
                    <button className={styles.secondaryButton} type="submit">
                      {consent.status === "GRANTED" ? "Revoke" : "Allow"}
                    </button>
                  </form>
                </div>
              )}
            />
          </div>
        )}
      </CustomerCard>

      <CustomerCard title="How changes work">
        <CustomerNotice
          title="Your latest choice is used"
          description="Changes are recorded immediately in your account. If a message is not permitted by your latest preference, ServiceDesk blocks that outbound message."
          tone="info"
        />
      </CustomerCard>
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

const moduleDescription: Record<CustomerModule, string> = {
  overview: "Keep track of quotes, bookings, invoices and the next steps for your services.",
  properties: "Review the addresses and service notes linked to your account.",
  quote: "Review the current quote, price and available next action.",
  booking: "Review the confirmed service time and related payment status.",
  invoice: "Review the latest invoice balance and payment status.",
  preferences: "Review the communication preferences currently saved on your account.",
};

function activeSection(module: CustomerModule): "overview" | "properties" | "preferences" | "detail" {
  if (module === "overview" || module === "properties" || module === "preferences") return module;
  return "detail";
}

export async function CustomerProductRoute({
  module,
  resourceId,
  notice,
  error,
}: CustomerProductRouteProps) {
  const result = await loadCustomerPortalSnapshot();
  const businessName = result.ok ? result.value.workspace.name : "Customer portal";
  const customerName = result.ok ? result.value.customer.displayName : undefined;

  return (
    <CustomerPortalShell
      businessName={businessName}
      customerName={customerName}
      activeSection={activeSection(module)}
    >
      <CustomerPageHeader
        eyebrow="Customer account"
        title={moduleTitle[module]}
        description={moduleDescription[module]}
        backHref={module === "quote" || module === "booking" || module === "invoice" ? "/portal" : undefined}
        backLabel="Account overview"
      />

      <Notice notice={notice} error={error} />

      {result.ok ? (
        renderModule(module, result.value, resourceId)
      ) : (
        <CustomerEmptyState
          title={result.kind === "authentication" ? "Sign in required" : "Customer account unavailable"}
          description={result.message}
        />
      )}
    </CustomerPortalShell>
  );
}
