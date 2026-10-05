import { redirect } from "next/navigation";
import {
  addOperationalVisitNote,
  assignOperationalCrew,
  applyOperationalManualPayment,
  applyOperationalRecurrenceAction,
  applyOperationalQualityAction,
  calculateOperationalQuote,
  enqueueInboxReply,
  holdOperationalSlot,
  loadOperationalStaffSnapshot,
  sendOperationalQuote,
  setOperationalChecklistItem,
  toggleInboxHandover,
  transitionOperationalVisit,
  updateOperationalServiceCatalogItem,
  type OperationalActionResult,
  type OperationalAttention,
  type OperationalStaffSnapshot,
  type OperationalVisit,
} from "./operational-product-runtime";
import { buildStaffModuleHref, staffModuleConfig, type StaffModule } from "./staff-modules";
import { EmptyState as AppEmptyState, MetricStrip, PageHeader, Panel, SectionHeader, StatusBadge } from "@/components/product/PagePrimitives";
import { DataCellStack, DataTable, RowActions } from "@/components/product/DataTable";
import { OperationsToolbar, ToolbarResultCount } from "@/components/product/WorkspacePrimitives";
import { FormField, FormGrid, SelectInput, TextArea, TextInput } from "@/components/product/FormPrimitives";
import { FeedbackBanner } from "@/components/product/FeedbackPrimitives";
import { DispatcherIntelligence } from "@/features/dispatch/DispatcherIntelligence";
import { buildOperationalDispatchIntelligence } from "./dispatch-product-adapter";
import { formatWorkspaceDateTime } from "./product-truth";
import { formatMinorMoney } from "./view-models";
import styles from "./OperationalProductRoute.module.css";

interface OperationalProductRouteProps {
  workspaceSlug: string;
  module: Exclude<StaffModule, "overview">;
  selectedConversationId?: string;
  selectedCustomerId?: string;
  selectedRequestId?: string;
  selectedQuoteId?: string;
  selectedQualityCaseId?: string;
  selectedJobId?: string;
  selectedInvoiceId?: string;
  notice?: string;
  error?: string;
}

function actionRedirect(
  workspaceSlug: string,
  module: string,
  result: OperationalActionResult,
  extra = "",
): never {
  const key = result.ok ? "notice" : "error";
  redirect(
    "/app/" +
      encodeURIComponent(workspaceSlug) +
      "/" +
      module +
      "?" +
      extra +
      key +
      "=" +
      encodeURIComponent(result.message),
  );
}

function formatWhen(value: string | undefined, timeZone: string) {
  return formatWorkspaceDateTime(value, timeZone);
}

function statusBadgeTone(status: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (["PAID", "COMPLETED", "RESOLVED", "DELIVERED", "READ", "CONNECTED", "ACTIVE", "ACCEPTED"].includes(status)) {
    return "success";
  }
  if (["FAILED", "BLOCKED", "VOID", "CANCELLED"].includes(status)) return "danger";
  if (["PAYMENT_REVIEW", "REAUTH_REQUIRED", "PENDING_REVIEW", "PAST_DUE"].includes(status)) return "warning";
  if (["SENT", "QUEUED", "RUNNING", "IN_PROGRESS", "EN_ROUTE"].includes(status)) return "info";
  return "neutral";
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <Panel>
      <AppEmptyState title={title} description={detail} />
    </Panel>
  );
}
function Notice({ notice, error }: { notice?: string; error?: string }) {
  if (!notice && !error) return null;
  return (
    <FeedbackBanner
      title={error ? "Action failed" : "Saved"}
      description={error ?? notice}
      tone={error ? "danger" : "success"}
      live={error ? "assertive" : "polite"}
    />
  );
}
function InboxView({
  data,
  workspaceSlug,
  selectedConversationId,
}: {
  data: OperationalStaffSnapshot;
  workspaceSlug: string;
  selectedConversationId?: string;
}) {
  const orderedConversations = [...data.conversations].sort((left, right) =>
    Date.parse(right.lastMessageAt ?? "1970-01-01T00:00:00.000Z")
    - Date.parse(left.lastMessageAt ?? "1970-01-01T00:00:00.000Z"),
  );
  const selected =
    orderedConversations.find((item) => item.id === selectedConversationId) ?? orderedConversations[0];
  if (!selected) {
    return <EmptyState title="Inbox is clear" detail="No customer conversations are stored for this workspace yet." />;
  }

  const customer = data.customers.find((item) => item.id === selected.customerId);
  const request = data.requests.find((item) => item.id === selected.requestId);
  const property = request?.propertyId
    ? data.properties.find((item) => item.id === request.propertyId)
    : undefined;
  const messages = data.messages
    .filter((item) => item.conversationId === selected.id)
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
  const lastMessageByConversation = new Map(
    orderedConversations.map((conversation) => {
      const latest = data.messages
        .filter((message) => message.conversationId === conversation.id)
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0];
      return [conversation.id, latest] as const;
    }),
  );

  async function handover(formData: FormData) {
    "use server";
    const conversationId = String(formData.get("conversationId") ?? "");
    const active = String(formData.get("active")) === "true";
    const result = await toggleInboxHandover(workspaceSlug, conversationId, active);
    actionRedirect(
      workspaceSlug,
      "inbox",
      result,
      "conversation=" + encodeURIComponent(conversationId) + "&",
    );
  }

  async function reply(formData: FormData) {
    "use server";
    const conversationId = String(formData.get("conversationId") ?? "");
    const body = String(formData.get("body") ?? "");
    const result = await enqueueInboxReply(workspaceSlug, conversationId, body);
    actionRedirect(
      workspaceSlug,
      "inbox",
      result,
      "conversation=" + encodeURIComponent(conversationId) + "&",
    );
  }

  const replySupported = selected.channel === "WHATSAPP" || selected.channel === "EMAIL";

  return (
    <section className={styles.inboxWorkspace} aria-label="Customer conversations">
      <aside className={styles.inboxListPane} aria-label="Conversation list">
        <header className={styles.inboxPaneHeader}>
          <div>
            <p className={styles.inboxEyebrow}>Inbox</p>
            <h2>Conversations</h2>
            <p>{orderedConversations.length} active thread{orderedConversations.length === 1 ? "" : "s"}</p>
          </div>
        </header>
        <div className={styles.conversationList} role="list">
          {orderedConversations.map((conversation) => {
            const threadCustomer = data.customers.find((item) => item.id === conversation.customerId);
            const latest = lastMessageByConversation.get(conversation.id);
            const selectedThread = conversation.id === selected.id;
            return (
              <a
                className={`${styles.conversationItem} ${selectedThread ? styles.conversationSelected : ""}`.trim()}
                href={"?conversation=" + encodeURIComponent(conversation.id)}
                aria-current={selectedThread ? "page" : undefined}
                aria-label={(threadCustomer?.displayName ?? "Customer") + " " + conversation.channel + " conversation"}
                role="listitem"
                key={conversation.id}
              >
                <span className={styles.conversationAvatar} aria-hidden="true">
                  {(threadCustomer?.displayName ?? "Customer").slice(0, 1).toUpperCase()}
                </span>
                <span className={styles.conversationCopy}>
                  <span className={styles.conversationTopline}>
                    <strong>{threadCustomer?.displayName ?? "Customer"}</strong>
                    <small>{formatWhen(conversation.lastMessageAt, data.workspace.timezone)}</small>
                  </span>
                  <span className={styles.conversationPreview}>{latest?.body ?? (latest?.mediaReference ? "Media message" : "No messages yet")}</span>
                  <span className={styles.conversationMeta}>
                    <span>{conversation.channel}</span>
                    {conversation.handoverActive ? <span className={styles.takeoverDot}>Human takeover</span> : <span>Open</span>}
                  </span>
                </span>
              </a>
            );
          })}
        </div>
      </aside>

      <section className={styles.inboxThreadPane} aria-label={customer?.displayName ?? "Customer conversation"}>
        <header className={styles.threadHeader}>
          <div className={styles.threadIdentity}>
            <span className={styles.threadAvatar} aria-hidden="true">{(customer?.displayName ?? "C").slice(0, 1).toUpperCase()}</span>
            <span>
              <h2>{customer?.displayName ?? "Customer conversation"}</h2>
              <p>{selected.channel} · {request?.serviceLabel ?? "No request linked"}</p>
            </span>
          </div>
          <div className={styles.threadActions}>
            <StatusBadge tone={selected.handoverActive ? "warning" : "success"}>
              {selected.handoverActive ? "Human takeover" : "Open"}
            </StatusBadge>
            <form action={handover}>
              <input type="hidden" name="conversationId" value={selected.id} />
              <input type="hidden" name="active" value={selected.handoverActive ? "false" : "true"} />
              <button className="app-button-secondary" type="submit">
                {selected.handoverActive ? "Release" : "Take over"}
              </button>
            </form>
          </div>
        </header>

        <div className={styles.messageTimeline} aria-label="Message history">
          {messages.length === 0 ? (
            <div className={styles.inboxEmpty}>
              <span aria-hidden="true">—</span>
              <div><strong>No messages yet</strong><p>This conversation does not contain any stored messages.</p></div>
            </div>
          ) : (
            messages.map((message) => {
              const outbound = message.direction === "OUTBOUND";
              const internal = message.direction === "INTERNAL";
              const sender = message.direction === "INBOUND"
                ? customer?.displayName ?? "Customer"
                : message.senderKind === "STAFF"
                  ? "Staff"
                  : message.senderKind;
              return (
                <article
                  className={`${styles.messageBubbleRow} ${outbound ? styles.messageOutbound : internal ? styles.messageInternal : styles.messageInbound}`}
                  key={message.id}
                >
                  <div className={styles.messageBubble}>
                    <div className={styles.messageSender}>
                      <strong>{sender}</strong>
                      <span>{formatWhen(message.createdAt, data.workspace.timezone)}</span>
                    </div>
                    <p>{message.body ?? "Media message"}</p>
                    {message.deliveryState ? (
                      <small className={styles.deliveryState}>{message.deliveryState.replaceAll("_", " ").toLowerCase()}</small>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </div>

        <form action={reply} className={styles.replyComposer}>
          <input type="hidden" name="conversationId" value={selected.id} />
          <FormField id="reply-body" label="Reply" required>
            {({ id, describedBy, invalid }) => (
              <TextArea
                id={id}
                name="body"
                rows={3}
                placeholder={replySupported ? "Write a reply…" : "Replies are unavailable for this channel"}
                disabled={!replySupported}
                required
                describedBy={describedBy}
                invalid={invalid}
              />
            )}
          </FormField>
          <div className={styles.composerFooter}>
            <span>{replySupported ? `Reply via ${selected.channel}` : "Read-only conversation"}</span>
            <button className="app-button-primary" type="submit" disabled={!replySupported}>
              Queue reply
            </button>
          </div>
        </form>
      </section>

      <aside className={styles.inboxContextPane} aria-label="Customer context">
        <header className={styles.inboxPaneHeader}>
          <div>
            <p className={styles.inboxEyebrow}>Customer context</p>
            <h2>{customer?.displayName ?? "Customer"}</h2>
            <p>{request?.serviceLabel ?? "No request linked"}</p>
          </div>
        </header>

        <div className={styles.contextSection}>
          <span className={styles.contextLabel}>Request</span>
          <strong>{request?.serviceLabel ?? "No linked request"}</strong>
          <div className={styles.contextRow}>
            <span>Status</span>
            <StatusBadge tone={request ? statusBadgeTone(request.status) : "neutral"}>{request?.status.replaceAll("_", " ") ?? "None"}</StatusBadge>
          </div>
          {request?.requestedStartAt ? <div className={styles.contextRow}><span>Requested</span><strong>{formatWhen(request.requestedStartAt, data.workspace.timezone)}</strong></div> : null}
        </div>

        <div className={styles.contextSection}>
          <span className={styles.contextLabel}>Property</span>
          <strong>{property?.label ?? "No property linked"}</strong>
          <p>{property?.address ?? "Address not available"}</p>
          {property?.accessNotes ? <div className={styles.contextNote}><span>Access</span><p>{property.accessNotes}</p></div> : null}
          {property?.serviceNotes ? <div className={styles.contextNote}><span>Service</span><p>{property.serviceNotes}</p></div> : null}
        </div>

        <div className={styles.contextSection}>
          <span className={styles.contextLabel}>Conversation</span>
          <div className={styles.contextRow}><span>Channel</span><strong>{selected.channel}</strong></div>
          <div className={styles.contextRow}><span>Messages</span><strong>{messages.length}</strong></div>
          <div className={styles.contextRow}><span>Delivery</span><strong>Stored per message</strong></div>
        </div>
      </aside>
    </section>
  );
}

function CustomersView({ data, selectedCustomerId }: { data: OperationalStaffSnapshot; selectedCustomerId?: string }) {
  if (data.customers.length === 0) {
    return <EmptyState title="No customers yet" detail="Customers will appear here after enquiries are linked to a customer record." />;
  }

  const orderedCustomers = [...data.customers].sort((left, right) => left.displayName.localeCompare(right.displayName));
  const selectedCustomer = orderedCustomers.find((customer) => customer.id === selectedCustomerId) ?? orderedCustomers[0];
  const selectedProperties = data.properties.filter((property) => property.customerId === selectedCustomer.id);
  const selectedRequests = data.requests
    .filter((request) => request.customerId === selectedCustomer.id)
    .sort((left, right) => Date.parse(right.createdAt ?? "1970-01-01T00:00:00.000Z") - Date.parse(left.createdAt ?? "1970-01-01T00:00:00.000Z"));
  const selectedRequestIds = new Set(selectedRequests.map((request) => request.id));
  const selectedQuotes = data.quotes.filter((quote) => selectedRequestIds.has(quote.requestId));
  const selectedQuoteIds = new Set(selectedQuotes.map((quote) => quote.id));
  const selectedInvoices = data.invoices.filter((invoice) => invoice.quoteId && selectedQuoteIds.has(invoice.quoteId));
  const openInvoices = selectedInvoices.filter((invoice) => invoice.balanceMinor > 0 && invoice.status !== "VOID");
  const openInvoiceTotal = openInvoices.reduce((sum, invoice) => sum + invoice.balanceMinor, 0);
  const openInvoiceCurrency = openInvoices.length > 0 && openInvoices.every((invoice) => invoice.currency === openInvoices[0].currency)
    ? openInvoices[0].currency
    : undefined;
  const activeRequests = selectedRequests.filter((request) => !["CLOSED", "LOST"].includes(request.status));

  return (
    <section className={styles.crmWorkspace} aria-label="Customer relationship workspace">
      <header className={styles.crmToolbar}>
        <div>
          <p className={styles.crmEyebrow}>Customer records</p>
          <h2>Customers</h2>
          <p>{orderedCustomers.length} customer{orderedCustomers.length === 1 ? "" : "s"} · linked properties and service history</p>
        </div>
      </header>

      <div className={styles.crmSplit}>
        <aside className={styles.crmQueue} aria-label="Customer list">
          {orderedCustomers.map((customer) => {
            const properties = data.properties.filter((item) => item.customerId === customer.id).length;
            const requests = data.requests.filter((item) => item.customerId === customer.id).length;
            const selected = customer.id === selectedCustomer.id;
            return (
              <a
                className={`${styles.crmQueueItem} ${selected ? styles.crmQueueSelected : ""}`.trim()}
                href={"?customer=" + encodeURIComponent(customer.id)}
                aria-current={selected ? "page" : undefined}
                key={customer.id}
              >
                <span className={styles.crmAvatar} aria-hidden="true">{customer.displayName.slice(0, 1).toUpperCase()}</span>
                <span className={styles.crmQueueCopy}>
                  <strong>{customer.displayName}</strong>
                  <small>{customer.leadSource ?? "Lead source not recorded"}</small>
                  <span>{properties} propert{properties === 1 ? "y" : "ies"} · {requests} request{requests === 1 ? "" : "s"}</span>
                </span>
              </a>
            );
          })}
        </aside>

        <article className={styles.crmDetail}>
          <header className={styles.crmDetailHeader}>
            <div className={styles.crmIdentity}>
              <span className={styles.crmDetailAvatar} aria-hidden="true">{selectedCustomer.displayName.slice(0, 1).toUpperCase()}</span>
              <span>
                <p className={styles.crmEyebrow}>Customer</p>
                <h2>{selectedCustomer.displayName}</h2>
                <p>{selectedCustomer.leadSource ? `Lead source · ${selectedCustomer.leadSource}` : "Lead source not recorded"}</p>
              </span>
            </div>
            <div className={styles.crmActions}>
              <a className="app-button-secondary" href={buildStaffModuleHref(data.workspace.slug, "inbox")}>Open inbox</a>
              <a className="app-button-primary" href={buildStaffModuleHref(data.workspace.slug, "requests")}>View requests</a>
            </div>
          </header>

          <section className={styles.crmMetrics} aria-label="Customer account summary">
            <div><span>Properties</span><strong>{selectedProperties.length}</strong></div>
            <div><span>Active requests</span><strong>{activeRequests.length}</strong></div>
            <div><span>Quotes</span><strong>{selectedQuotes.length}</strong></div>
            <div><span>Open balance</span><strong>{openInvoiceCurrency ? formatMinorMoney(openInvoiceTotal, openInvoiceCurrency) : openInvoices.length ? "Multiple currencies" : "—"}</strong></div>
          </section>

          <div className={styles.crmDetailGrid}>
            <section className={styles.crmSection}>
              <div className={styles.crmSectionHeader}>
                <div><p className={styles.crmSectionEyebrow}>Locations</p><h3>Properties</h3></div>
                <span>{selectedProperties.length}</span>
              </div>
              {selectedProperties.length === 0 ? (
                <div className={styles.crmEmpty}><strong>No properties</strong><p>No property is linked to this customer yet.</p></div>
              ) : (
                <div className={styles.propertyCards}>
                  {selectedProperties.map((property) => (
                    <article className={styles.propertyCard} key={property.id}>
                      <div className={styles.propertyCardHead}>
                        <span className={styles.propertyIcon} aria-hidden="true">⌂</span>
                        <div><strong>{property.label}</strong><p>{property.address || "Address not recorded"}</p></div>
                      </div>
                      {property.accessNotes ? <div className={styles.crmNote}><span>Access</span><p>{property.accessNotes}</p></div> : null}
                      {property.serviceNotes ? <div className={styles.crmNote}><span>Service notes</span><p>{property.serviceNotes}</p></div> : null}
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className={styles.crmSection}>
              <div className={styles.crmSectionHeader}>
                <div><p className={styles.crmSectionEyebrow}>Activity</p><h3>Recent service requests</h3></div>
                <span>{selectedRequests.length}</span>
              </div>
              {selectedRequests.length === 0 ? (
                <div className={styles.crmEmpty}><strong>No requests</strong><p>No service request is linked to this customer yet.</p></div>
              ) : (
                <div className={styles.crmActivityList}>
                  {selectedRequests.slice(0, 8).map((request) => {
                    const quote = selectedQuotes.find((item) => item.requestId === request.id && item.status !== "SUPERSEDED");
                    return (
                      <a className={styles.crmActivityRow} href={`/app/${encodeURIComponent(data.workspace.slug)}/requests?request=${encodeURIComponent(request.id)}`} key={request.id}>
                        <span className={styles.crmActivityCopy}>
                          <strong>{request.serviceLabel}</strong>
                          <small>{formatWhen(request.requestedStartAt, data.workspace.timezone)}</small>
                        </span>
                        <span className={styles.crmActivityMeta}>
                          <StatusBadge tone={statusBadgeTone(request.status)}>{request.status.replaceAll("_", " ")}</StatusBadge>
                          <small>{quote ? `Quote ${quote.status.replaceAll("_", " ").toLowerCase()}` : "No quote"}</small>
                        </span>
                      </a>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </article>
      </div>
    </section>
  );
}

function RequestsView({
  data,
  workspaceSlug,
  selectedRequestId,
}: {
  data: OperationalStaffSnapshot;
  workspaceSlug: string;
  selectedRequestId?: string;
}) {
  async function calculateQuote(formData: FormData) {
    "use server";
    const requestId = String(formData.get("requestId") ?? "");
    const result = await calculateOperationalQuote(workspaceSlug, requestId);
    actionRedirect(
      workspaceSlug,
      "requests",
      result,
      "request=" + encodeURIComponent(requestId) + "&",
    );
  }

  if (data.requests.length === 0) {
    return <EmptyState title="No requests in the queue" detail="New enquiries will appear here as persisted requests." />;
  }

  const orderedRequests = [...data.requests].sort((left, right) =>
    Date.parse(right.createdAt ?? "1970-01-01T00:00:00.000Z")
    - Date.parse(left.createdAt ?? "1970-01-01T00:00:00.000Z"),
  );
  const selectedRequest = orderedRequests.find((request) => request.id === selectedRequestId) ?? orderedRequests[0];
  const selectedRequestCustomer = data.customers.find((customer) => customer.id === selectedRequest.customerId);
  const selectedRequestProperty = data.properties.find((property) => property.id === selectedRequest.propertyId);
  const selectedRequestQuote = data.quotes.find((quote) => quote.requestId === selectedRequest.id && quote.status !== "SUPERSEDED");
  const selectedRequestCanCalculate = Boolean(selectedRequest.serviceCode)
    && selectedRequest.bedrooms !== undefined
    && selectedRequest.bathrooms !== undefined
    && !["BOOKED", "LOST", "CLOSED"].includes(selectedRequest.status);
  const selectedMissing = [
    !selectedRequest.serviceCode ? "Service" : undefined,
    selectedRequest.bedrooms === undefined ? "Bedrooms" : undefined,
    selectedRequest.bathrooms === undefined ? "Bathrooms" : undefined,
  ].filter((item): item is string => Boolean(item));
  const requestsWithoutQuote = orderedRequests.filter((request) =>
    !data.quotes.some((quote) => quote.requestId === request.id && quote.status !== "SUPERSEDED"),
  ).length;
  const reviewRequests = orderedRequests.filter((request) => ["NEW", "COLLECTING", "READY", "NEEDS_REVIEW"].includes(request.status)).length;

  return (
    <section className={styles.salesWorkspace} aria-label="Request intake workspace">
      <header className={styles.salesToolbar}>
        <div>
          <p className={styles.salesEyebrow}>Intake queue</p>
          <h2>Requests</h2>
          <p>{orderedRequests.length} total · {reviewRequests} need review · {requestsWithoutQuote} without quote</p>
        </div>
        <a className="app-button-secondary" href={buildStaffModuleHref(workspaceSlug, "inbox")}>Open inbox</a>
      </header>

      <div className={styles.salesSplit}>
        <aside className={styles.salesQueue} aria-label="Request queue">
          {orderedRequests.map((request) => {
            const requestCustomer = data.customers.find((item) => item.id === request.customerId);
            const currentQuote = data.quotes.find((quote) => quote.requestId === request.id && quote.status !== "SUPERSEDED");
            const selected = request.id === selectedRequest.id;
            return (
              <a
                className={`${styles.salesQueueItem} ${selected ? styles.salesQueueSelected : ""}`.trim()}
                href={"?request=" + encodeURIComponent(request.id)}
                aria-current={selected ? "page" : undefined}
                key={request.id}
              >
                <span className={styles.salesQueueTop}>
                  <strong>{request.serviceLabel}</strong>
                  <StatusBadge tone={statusBadgeTone(request.status)}>{request.status.replaceAll("_", " ")}</StatusBadge>
                </span>
                <span className={styles.salesQueueCustomer}>{requestCustomer?.displayName ?? "Visitor enquiry"}</span>
                <span className={styles.salesQueueMeta}>
                  <span>{formatWhen(request.requestedStartAt, data.workspace.timezone)}</span>
                  <span>{currentQuote ? `Quote ${currentQuote.status.replaceAll("_", " ").toLowerCase()}` : "No quote"}</span>
                </span>
              </a>
            );
          })}
        </aside>

        <article className={styles.salesDetail}>
          <header className={styles.salesDetailHeader}>
            <div>
              <p className={styles.salesEyebrow}>Request</p>
              <h2>{selectedRequest.serviceLabel}</h2>
              <p>{selectedRequestCustomer?.displayName ?? "Visitor enquiry"} · {formatWhen(selectedRequest.requestedStartAt, data.workspace.timezone)}</p>
            </div>
            <StatusBadge tone={statusBadgeTone(selectedRequest.status)}>{selectedRequest.status.replaceAll("_", " ")}</StatusBadge>
          </header>

          <div className={styles.salesDetailGrid}>
            <section className={styles.salesSection}>
              <div className={styles.salesSectionHeader}>
                <div>
                  <p className={styles.salesSectionEyebrow}>Customer & property</p>
                  <h3>{selectedRequestCustomer?.displayName ?? "Visitor enquiry"}</h3>
                </div>
                {selectedRequestCustomer ? (
                  <a className={styles.salesTextLink} href={`/app/${encodeURIComponent(workspaceSlug)}/customers?customer=${encodeURIComponent(selectedRequestCustomer.id)}`}>Open customer →</a>
                ) : null}
              </div>
              <dl className={styles.salesSummary}>
                <div><dt>Property</dt><dd>{selectedRequestProperty?.label ?? "Not linked"}</dd></div>
                <div><dt>Address</dt><dd>{selectedRequestProperty?.address ?? "Not available"}</dd></div>
                <div><dt>Home</dt><dd>{(selectedRequest.bedrooms ?? "—") + " bed · " + (selectedRequest.bathrooms ?? "—") + " bath"}</dd></div>
                <div><dt>Requested</dt><dd>{formatWhen(selectedRequest.requestedStartAt, data.workspace.timezone)}</dd></div>
              </dl>
              {selectedRequestProperty?.accessNotes ? (
                <div className={styles.salesNote}><span>Access</span><p>{selectedRequestProperty.accessNotes}</p></div>
              ) : null}
              {selectedRequestProperty?.serviceNotes ? (
                <div className={styles.salesNote}><span>Service notes</span><p>{selectedRequestProperty.serviceNotes}</p></div>
              ) : null}
            </section>

            <section className={styles.salesSection}>
              <div className={styles.salesSectionHeader}>
                <div>
                  <p className={styles.salesSectionEyebrow}>Quote readiness</p>
                  <h3>{selectedRequestQuote ? "Quote created" : selectedMissing.length ? "More information needed" : "Ready to price"}</h3>
                </div>
                {selectedRequestQuote ? <StatusBadge tone={statusBadgeTone(selectedRequestQuote.status)}>{selectedRequestQuote.status.replaceAll("_", " ")}</StatusBadge> : null}
              </div>

              {selectedRequestQuote ? (
                <div className={styles.quoteSnapshot}>
                  <div><span>Total</span><strong>{formatMinorMoney(selectedRequestQuote.totalMinor, selectedRequestQuote.currency)}</strong></div>
                  <div><span>Deposit</span><strong>{formatMinorMoney(selectedRequestQuote.depositMinor, selectedRequestQuote.currency)}</strong></div>
                  <div><span>Version</span><strong>v{selectedRequestQuote.version}</strong></div>
                  <a className="app-button-primary" href={`/app/${encodeURIComponent(workspaceSlug)}/quotes?quote=${encodeURIComponent(selectedRequestQuote.id)}`}>Open quote</a>
                </div>
              ) : (
                <>
                  <ul className={styles.readinessList}>
                    <li className={selectedRequest.serviceCode ? styles.ready : styles.notReady}><span>{selectedRequest.serviceCode ? "✓" : "!"}</span><strong>Service</strong><small>{selectedRequest.serviceCode ?? "Missing"}</small></li>
                    <li className={selectedRequest.bedrooms !== undefined ? styles.ready : styles.notReady}><span>{selectedRequest.bedrooms !== undefined ? "✓" : "!"}</span><strong>Bedrooms</strong><small>{selectedRequest.bedrooms ?? "Missing"}</small></li>
                    <li className={selectedRequest.bathrooms !== undefined ? styles.ready : styles.notReady}><span>{selectedRequest.bathrooms !== undefined ? "✓" : "!"}</span><strong>Bathrooms</strong><small>{selectedRequest.bathrooms ?? "Missing"}</small></li>
                  </ul>
                  <form action={calculateQuote} className={styles.salesPrimaryAction}>
                    <input type="hidden" name="requestId" value={selectedRequest.id} />
                    <button className="app-button-primary" type="submit" disabled={!selectedRequestCanCalculate}>Calculate quote</button>
                    {!selectedRequestCanCalculate ? <span>Complete the missing intake details before pricing.</span> : <span>Uses the current authoritative pricing rules.</span>}
                  </form>
                </>
              )}
            </section>
          </div>
        </article>
      </div>
    </section>
  );
}

function QuotesView({
  data,
  workspaceSlug,
  selectedQuoteId,
}: {
  data: OperationalStaffSnapshot;
  workspaceSlug: string;
  selectedQuoteId?: string;
}) {
  async function sendQuote(formData: FormData) {
    "use server";
    const quoteId = String(formData.get("quoteId") ?? "");
    const result = await sendOperationalQuote(workspaceSlug, quoteId);
    actionRedirect(
      workspaceSlug,
      "quotes",
      result,
      "quote=" + encodeURIComponent(quoteId) + "&",
    );
  }

  if (data.quotes.length === 0) {
    return <EmptyState title="No quotes yet" detail="Calculated and saved quotes will appear here." />;
  }

  const orderedQuotes = [...data.quotes].sort((left, right) => {
    const statusWeight: Record<string, number> = { APPROVED: 0, SENT: 1, ACCEPTED: 2, DRAFT: 3, EXPIRED: 4, DECLINED: 5, SUPERSEDED: 6 };
    return (statusWeight[left.status] ?? 9) - (statusWeight[right.status] ?? 9)
      || right.version - left.version;
  });
  const selectedQuote = orderedQuotes.find((quote) => quote.id === selectedQuoteId) ?? orderedQuotes[0];
  const selectedQuoteRequest = data.requests.find((request) => request.id === selectedQuote.requestId);
  const selectedQuoteCustomer = data.customers.find((customer) => customer.id === selectedQuoteRequest?.customerId);
  const selectedQuoteProperty = data.properties.find((property) => property.id === selectedQuoteRequest?.propertyId);
  const awaitingCustomer = orderedQuotes.filter((quote) => quote.status === "SENT").length;
  const readyToSend = orderedQuotes.filter((quote) => quote.status === "APPROVED").length;

  return (
    <section className={styles.salesWorkspace} aria-label="Quote workspace">
      <header className={styles.salesToolbar}>
        <div>
          <p className={styles.salesEyebrow}>Sales pipeline</p>
          <h2>Quotes</h2>
          <p>{orderedQuotes.length} total · {readyToSend} ready to send · {awaitingCustomer} awaiting customer</p>
        </div>
        <a className="app-button-secondary" href={buildStaffModuleHref(workspaceSlug, "requests")}>Open requests</a>
      </header>

      <div className={styles.salesSplit}>
        <aside className={styles.salesQueue} aria-label="Quote list">
          {orderedQuotes.map((quote) => {
            const request = data.requests.find((item) => item.id === quote.requestId);
            const customer = data.customers.find((item) => item.id === request?.customerId);
            const selected = quote.id === selectedQuote.id;
            return (
              <a
                className={`${styles.salesQueueItem} ${selected ? styles.salesQueueSelected : ""}`.trim()}
                href={"?quote=" + encodeURIComponent(quote.id)}
                aria-current={selected ? "page" : undefined}
                key={quote.id}
              >
                <span className={styles.salesQueueTop}>
                  <strong>{request?.serviceLabel ?? "Service quote"}</strong>
                  <StatusBadge tone={statusBadgeTone(quote.status)}>{quote.status.replaceAll("_", " ")}</StatusBadge>
                </span>
                <span className={styles.salesQueueCustomer}>{customer?.displayName ?? "Customer unavailable"}</span>
                <span className={styles.salesQueueMeta}>
                  <span>{formatMinorMoney(quote.totalMinor, quote.currency)}</span>
                  <span>v{quote.version}</span>
                </span>
              </a>
            );
          })}
        </aside>

        <article className={styles.salesDetail}>
          <header className={styles.salesDetailHeader}>
            <div>
              <p className={styles.salesEyebrow}>Quote v{selectedQuote.version}</p>
              <h2>{selectedQuoteRequest?.serviceLabel ?? "Service quote"}</h2>
              <p>{selectedQuoteCustomer?.displayName ?? "Customer unavailable"} · {selectedQuoteProperty?.label ?? "No property linked"}</p>
            </div>
            <StatusBadge tone={statusBadgeTone(selectedQuote.status)}>{selectedQuote.status.replaceAll("_", " ")}</StatusBadge>
          </header>

          <section className={styles.quoteFinancials} aria-label="Quote financial summary">
            <div className={styles.quoteTotal}><span>Total</span><strong>{formatMinorMoney(selectedQuote.totalMinor, selectedQuote.currency)}</strong></div>
            <div><span>Deposit</span><strong>{formatMinorMoney(selectedQuote.depositMinor, selectedQuote.currency)}</strong></div>
            <div><span>Balance</span><strong>{formatMinorMoney(selectedQuote.balanceMinor, selectedQuote.currency)}</strong></div>
          </section>

          <div className={styles.salesDetailGrid}>
            <section className={styles.salesSection}>
              <div className={styles.salesSectionHeader}>
                <div><p className={styles.salesSectionEyebrow}>Service</p><h3>Quote details</h3></div>
              </div>
              <dl className={styles.salesSummary}>
                <div><dt>Customer</dt><dd>{selectedQuoteCustomer?.displayName ?? "Unavailable"}</dd></div>
                <div><dt>Property</dt><dd>{selectedQuoteProperty?.label ?? "Not linked"}</dd></div>
                <div><dt>Address</dt><dd>{selectedQuoteProperty?.address ?? "Not available"}</dd></div>
                <div><dt>Service time</dt><dd>{selectedQuote.durationMinutes} min + {selectedQuote.bufferMinutes} min buffer</dd></div>
                <div><dt>Valid until</dt><dd>{formatWhen(selectedQuote.validUntil, data.workspace.timezone)}</dd></div>
              </dl>
            </section>

            <section className={styles.salesSection}>
              <div className={styles.salesSectionHeader}>
                <div><p className={styles.salesSectionEyebrow}>Next step</p><h3>{selectedQuote.status === "APPROVED" ? "Ready to send" : selectedQuote.status === "SENT" ? "Waiting for customer" : selectedQuote.status === "ACCEPTED" ? "Ready to schedule" : "Quote status"}</h3></div>
              </div>
              <div className={styles.quoteNextStep}>
                {selectedQuote.status === "APPROVED" ? (
                  <>
                    <p>The quote is approved internally and ready to send to the customer.</p>
                    <form action={sendQuote}>
                      <input type="hidden" name="quoteId" value={selectedQuote.id} />
                      <button className="app-button-primary" type="submit">Send quote</button>
                    </form>
                  </>
                ) : selectedQuote.status === "SENT" ? (
                  <><p>The quote is with the customer. No additional staff action is needed until they respond.</p><StatusBadge tone="info">Awaiting reply</StatusBadge></>
                ) : selectedQuote.status === "ACCEPTED" ? (
                  <><p>The customer accepted this quote. Continue to scheduling and capacity selection.</p><a className="app-button-primary" href={buildStaffModuleHref(workspaceSlug, "schedule")}>Open schedule</a></>
                ) : (
                  <><p>No staff action is available for this quote in its current state.</p><StatusBadge tone={statusBadgeTone(selectedQuote.status)}>{selectedQuote.status.replaceAll("_", " ")}</StatusBadge></>
                )}
              </div>
            </section>
          </div>
        </article>
      </div>
    </section>
  );
}

function ScheduleView({
  data,
  workspaceSlug,
}: {
  data: OperationalStaffSnapshot;
  workspaceSlug: string;
}) {
  async function assignCrew(formData: FormData) {
    "use server";
    const visitId = String(formData.get("visitId") ?? "");
    const crewId = String(formData.get("crewId") ?? "");
    const expectedVersion = Number(formData.get("expectedVersion"));
    const result = await assignOperationalCrew(
      workspaceSlug,
      visitId,
      crewId,
      expectedVersion,
    );
    actionRedirect(workspaceSlug, "schedule", result);
  }

  async function holdSlot(formData: FormData) {
    "use server";
    const result = await holdOperationalSlot(
      workspaceSlug,
      String(formData.get("quoteId") ?? ""),
      String(formData.get("slotId") ?? ""),
    );
    actionRedirect(workspaceSlug, "schedule", result);
  }

  const now = Date.parse(data.loadedAt);
  const week = now + 7 * 24 * 60 * 60 * 1000;
  const upcoming = data.visits.filter((visit) => {
    const time = visit.startAt ? Date.parse(visit.startAt) : Number.NaN;
    return Number.isFinite(time) && time >= now && time <= week;
  });
  const scheduledRequestIds = new Set(data.visits.map((visit) => visit.requestId));
  const unscheduled = data.requests.filter(
    (request) =>
      !scheduledRequestIds.has(request.id) && !["LOST", "CLOSED"].includes(request.status),
  );
  const acceptedQuotes = data.quotes.filter(
    (quote) =>
      quote.status === "ACCEPTED" &&
      !data.visits.some((visit) => visit.quoteId === quote.id),
  );
  const heldSlotIds = new Set(
    data.slotHolds
      .filter((hold) => hold.status === "HELD" && Date.parse(hold.expiresAt) > now)
      .map((hold) => hold.slotId),
  );
  const dispatch = buildOperationalDispatchIntelligence(data);
  const visitLabels = Object.fromEntries(data.visits.map((visit) => {
    const request = data.requests.find((item) => item.id === visit.requestId);
    const customer = request?.customerId
      ? data.customers.find((item) => item.id === request.customerId)
      : undefined;
    return [visit.id, `${request?.serviceLabel ?? "Service visit"}${customer ? ` · ${customer.displayName}` : ""}`];
  }));
  const visitMeta = Object.fromEntries(data.visits.map((visit) => [
    visit.id,
    formatWhen(visit.startAt, data.workspace.timezone),
  ]));

  return (
    <div className={styles.stack}>
      <DispatcherIntelligence
        recommendations={dispatch.recommendations}
        timeline={dispatch.timeline}
        workspaceTimeZone={data.workspace.timezone}
        assignmentAvailability={{ enabled: true, label: "Assignment available" }}
        crewLabels={Object.fromEntries(data.crews.map((crew) => [crew.id, crew.name]))}
        visitLabels={visitLabels}
        visitMeta={visitMeta}
        renderApprovalControl={({ recommendation, candidate }) => (
          <form action={assignCrew}>
            <input type="hidden" name="visitId" value={recommendation.visitId} />
            <input type="hidden" name="crewId" value={candidate.candidateCrewId} />
            <input type="hidden" name="expectedVersion" value={recommendation.visitVersion} />
            <button className="app-button-primary" type="submit">Assign crew</button>
          </form>
        )}
      />
      <Panel>
        <SectionHeader
          title="Next 7 days"
          description={upcoming.length + " scheduled visit" + (upcoming.length === 1 ? "" : "s") + " · " + unscheduled.length + " unscheduled"}
        />
        <DataTable<OperationalVisit>
          caption="Upcoming scheduled visits"
          rows={upcoming}
          getRowKey={(visit) => visit.id}
          emptyTitle="No visits scheduled"
          emptyDescription="No visits are scheduled in the next seven days."
          columns={[
            {
              id: "start",
              header: "Start",
              priority: "primary",
              cell: (visit) => formatWhen(visit.startAt, data.workspace.timezone),
            },
            {
              id: "service",
              header: "Service",
              priority: "primary",
              cell: (visit) => data.requests.find((item) => item.id === visit.requestId)?.serviceLabel ?? "Visit",
            },
            {
              id: "crew",
              header: "Crew",
              cell: (visit) => visit.crewId ? data.crews.find((crew) => crew.id === visit.crewId)?.name ?? "Assigned crew" : "Unassigned",
            },
            {
              id: "status",
              header: "Status",
              cell: (visit) => <StatusBadge tone={statusBadgeTone(visit.status)}>{visit.status.replaceAll("_", " ")}</StatusBadge>,
            },
          ]}
          renderMobileRow={(visit) => (
            <DataCellStack
              primary={data.requests.find((item) => item.id === visit.requestId)?.serviceLabel ?? "Visit"}
              secondary={formatWhen(visit.startAt, data.workspace.timezone) + " · " + visit.status.replaceAll("_", " ")}
            />
          )}
        />
      </Panel>

      <Panel>
        <SectionHeader
          title="Accepted quotes awaiting booking"
          description="Choose only from current capacity; holding a slot never implies payment."
        />
        {acceptedQuotes.length === 0 ? (
          <p>No accepted quotes are waiting for a slot.</p>
        ) : (
          acceptedQuotes.map((quote) => {
            const activeHold = data.slotHolds.find(
              (hold) =>
                hold.quoteId === quote.id &&
                hold.status === "HELD" &&
                Date.parse(hold.expiresAt) > now,
            );
            const requiredMinutes = quote.durationMinutes + quote.bufferMinutes;
            const candidates = data.capacitySlots.filter((slot) => {
              const start = Date.parse(slot.startAt);
              const end = Date.parse(slot.endAt);
              const windowMinutes = Number.isFinite(start) && Number.isFinite(end)
                ? Math.floor((end - start) / 60000)
                : 0;
              return (
                start >= now &&
                !heldSlotIds.has(slot.id) &&
                slot.capacityMinutes >= requiredMinutes &&
                windowMinutes >= requiredMinutes
              );
            });
            return (
              <div className={styles.bookingBlock} key={quote.id}>
                <p>
                  <strong>{data.requests.find((item) => item.id === quote.requestId)?.serviceLabel ?? "Service"}</strong>
                  {" · "}{quote.durationMinutes} min
                </p>
                {activeHold ? (
                  <p>Slot held until {formatWhen(activeHold.expiresAt, data.workspace.timezone)}. Payment remains pending.</p>
                ) : candidates.length === 0 ? (
                  <p>No capacity slot currently fits this quote.</p>
                ) : (
                  <div className={styles.actions}>
                    {candidates.slice(0, 5).map((slot) => (
                      <form action={holdSlot} key={slot.id}>
                        <input type="hidden" name="quoteId" value={quote.id} />
                        <input type="hidden" name="slotId" value={slot.id} />
                        <button className="app-button-secondary" type="submit">
                          Hold {formatWhen(slot.startAt, data.workspace.timezone)}
                        </button>
                      </form>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
        <p className="app-field-help">
          ServiceDesk rechecks availability when you hold a slot. Holding a slot does not create
          a payment or a confirmed visit.
        </p>
      </Panel>

      <Panel>
        <SectionHeader title="Unscheduled work" description="Open requests without a visit." />
        {unscheduled.length === 0 ? (
          <AppEmptyState title="No unscheduled work" description="No open requests are waiting for a visit." />
        ) : (
          <div className="app-row-list">
            {unscheduled.slice(0, 20).map((request) => (
              <article className="app-row" key={request.id}>
                <div>
                  <h3>{request.serviceLabel}</h3>
                  <p>Requested {formatWhen(request.requestedStartAt, data.workspace.timezone)}</p>
                </div>
                <StatusBadge tone={statusBadgeTone(request.status)}>{request.status.replaceAll("_", " ")}</StatusBadge>
              </article>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function JobsView({
  data,
  workspaceSlug,
  selectedJobId,
}: {
  data: OperationalStaffSnapshot;
  workspaceSlug: string;
  selectedJobId?: string;
}) {
  async function transitionVisit(formData: FormData) {
    "use server";
    const action = String(formData.get("action") ?? "") as
      | "ASSIGN"
      | "EN_ROUTE"
      | "START"
      | "SUBMIT_REVIEW"
      | "COMPLETE";
    if (!["ASSIGN", "EN_ROUTE", "START", "SUBMIT_REVIEW", "COMPLETE"].includes(action)) {
      actionRedirect(workspaceSlug, "jobs", { ok: false, message: "Unsupported visit action." });
    }
    const visitId = String(formData.get("visitId") ?? "");
    const result = await transitionOperationalVisit(workspaceSlug, visitId, action);
    actionRedirect(workspaceSlug, "jobs", result, "job=" + encodeURIComponent(visitId) + "&");
  }

  async function saveVisitNote(formData: FormData) {
    "use server";
    const kind = String(formData.get("kind") ?? "TIME_MATERIAL_NOTE") === "INCIDENT_NOTE"
      ? "INCIDENT_NOTE"
      : "TIME_MATERIAL_NOTE";
    const visitId = String(formData.get("visitId") ?? "");
    const result = await addOperationalVisitNote(
      workspaceSlug,
      visitId,
      kind,
      String(formData.get("note") ?? ""),
    );
    actionRedirect(workspaceSlug, "jobs", result, "job=" + encodeURIComponent(visitId) + "&");
  }

  async function saveChecklistItem(formData: FormData) {
    "use server";
    const visitId = String(formData.get("visitId") ?? "");
    const result = await setOperationalChecklistItem(
      workspaceSlug,
      visitId,
      String(formData.get("itemKey") ?? ""),
      String(formData.get("completed") ?? "") === "true",
      String(formData.get("note") ?? ""),
    );
    actionRedirect(workspaceSlug, "jobs", result, "job=" + encodeURIComponent(visitId) + "&");
  }

  const nextAction = (status: string) => {
    if (status === "CONFIRMED") return { action: "ASSIGN" as const, label: "Confirm crew assignment" };
    if (status === "ASSIGNED") return { action: "EN_ROUTE" as const, label: "Mark en route" };
    if (status === "EN_ROUTE") return { action: "START" as const, label: "Start job" };
    if (status === "IN_PROGRESS") return { action: "SUBMIT_REVIEW" as const, label: "Submit for review" };
    if (status === "PENDING_REVIEW") return { action: "COMPLETE" as const, label: "Complete after review" };
    return undefined;
  };

  if (data.visits.length === 0) {
    return <EmptyState title="No jobs yet" detail="Paid and scheduled visits will appear here." />;
  }

  const orderedVisits = [...data.visits].sort((left, right) => {
    const leftClosed = ["COMPLETED", "CANCELLED"].includes(left.status) ? 1 : 0;
    const rightClosed = ["COMPLETED", "CANCELLED"].includes(right.status) ? 1 : 0;
    return leftClosed - rightClosed || Date.parse(left.startAt) - Date.parse(right.startAt);
  });
  const activeVisits = orderedVisits.filter((visit) => !["COMPLETED", "CANCELLED"].includes(visit.status));
  const selectedVisit = orderedVisits.find((visit) => visit.id === selectedJobId) ?? activeVisits[0] ?? orderedVisits[0];
  const selectedRequest = data.requests.find((request) => request.id === selectedVisit.requestId);
  const selectedCustomer = data.customers.find((customer) => customer.id === selectedRequest?.customerId);
  const selectedProperty = data.properties.find((property) => property.id === selectedRequest?.propertyId);
  const selectedCrew = selectedVisit.crewId ? data.crews.find((crew) => crew.id === selectedVisit.crewId) : undefined;
  const selectedEvidence = data.visitEvidence.filter((item) => item.visitId === selectedVisit.id);
  const selectedChecklist = data.visitChecklistItems.filter((item) => item.visitId === selectedVisit.id);
  const selectedChecklistDone = selectedChecklist.filter((item) => item.completed).length;
  const selectedBefore = selectedEvidence.some((item) => item.kind === "BEFORE_PHOTO");
  const selectedAfter = selectedEvidence.some((item) => item.kind === "AFTER_PHOTO");
  const selectedReviewEvidenceReady = selectedBefore && selectedAfter;
  const selectedNextAction = nextAction(selectedVisit.status);
  const unassigned = activeVisits.filter((visit) => !visit.crewId).length;
  const inProgress = activeVisits.filter((visit) => ["EN_ROUTE", "IN_PROGRESS"].includes(visit.status)).length;
  const pendingReview = activeVisits.filter((visit) => visit.status === "PENDING_REVIEW").length;

  return (
    <section className={styles.jobsWorkspace} aria-label="Field jobs workspace">
      <header className={styles.jobsToolbar}>
        <div>
          <p className={styles.jobsEyebrow}>Field operations</p>
          <h2>Jobs</h2>
          <p>{activeVisits.length} active · {unassigned} unassigned · {pendingReview} awaiting review</p>
        </div>
        <a className="app-button-secondary" href={buildStaffModuleHref(workspaceSlug, "schedule")}>Open dispatch</a>
      </header>

      <section className={styles.jobsMetrics} aria-label="Job operation summary">
        <div><span>Active jobs</span><strong>{activeVisits.length}</strong></div>
        <div className={unassigned ? styles.jobsMetricWarning : undefined}><span>Unassigned</span><strong>{unassigned}</strong></div>
        <div><span>Underway</span><strong>{inProgress}</strong></div>
        <div><span>Review queue</span><strong>{pendingReview}</strong></div>
      </section>

      <div className={styles.jobsSplit}>
        <aside className={styles.jobsQueue} aria-label="Job list">
          {orderedVisits.map((visit) => {
            const request = data.requests.find((item) => item.id === visit.requestId);
            const customer = data.customers.find((item) => item.id === request?.customerId);
            const crew = visit.crewId ? data.crews.find((item) => item.id === visit.crewId) : undefined;
            const evidence = data.visitEvidence.filter((item) => item.visitId === visit.id);
            const checklist = data.visitChecklistItems.filter((item) => item.visitId === visit.id);
            const selected = visit.id === selectedVisit.id;
            return (
              <a
                className={`${styles.jobsQueueItem} ${selected ? styles.jobsQueueSelected : ""}`.trim()}
                href={"?job=" + encodeURIComponent(visit.id)}
                aria-current={selected ? "page" : undefined}
                key={visit.id}
              >
                <span className={styles.jobsQueueTop}>
                  <strong>{request?.serviceLabel ?? "Service visit"}</strong>
                  <StatusBadge tone={statusBadgeTone(visit.status)}>{visit.status.replaceAll("_", " ")}</StatusBadge>
                </span>
                <span className={styles.jobsQueueCustomer}>{customer?.displayName ?? "Customer"}</span>
                <span className={styles.jobsQueueMeta}>
                  <span>{formatWhen(visit.startAt, data.workspace.timezone)}</span>
                  <span>{crew?.name ?? "Unassigned"}</span>
                </span>
                <span className={styles.jobsQueueProgress}>{evidence.length} evidence · {checklist.filter((item) => item.completed).length}/{checklist.length} checklist</span>
              </a>
            );
          })}
        </aside>

        <article className={styles.jobsDetail}>
          <header className={styles.jobsDetailHeader}>
            <div>
              <p className={styles.jobsEyebrow}>Job {selectedVisit.id.slice(0, 8)}</p>
              <h2>{selectedRequest?.serviceLabel ?? "Service visit"}</h2>
              <p>{selectedCustomer?.displayName ?? "Customer"} · {selectedProperty?.label ?? "Property not linked"}</p>
            </div>
            <div className={styles.jobsHeaderActions}>
              <StatusBadge tone={statusBadgeTone(selectedVisit.status)}>{selectedVisit.status.replaceAll("_", " ")}</StatusBadge>
              {selectedNextAction ? (
                <form action={transitionVisit}>
                  <input type="hidden" name="visitId" value={selectedVisit.id} />
                  <button
                    className="app-button-primary"
                    name="action"
                    value={selectedNextAction.action}
                    disabled={
                      (selectedNextAction.action === "ASSIGN" && !selectedVisit.crewId) ||
                      (selectedNextAction.action === "SUBMIT_REVIEW" && !selectedReviewEvidenceReady)
                    }
                    title={
                      selectedNextAction.action === "ASSIGN" && !selectedVisit.crewId
                        ? "Choose a crew before confirming assignment."
                        : selectedNextAction.action === "SUBMIT_REVIEW" && !selectedReviewEvidenceReady
                          ? "Add both before and after evidence before submitting for review."
                          : undefined
                    }
                  >
                    {selectedNextAction.label}
                  </button>
                </form>
              ) : null}
            </div>
          </header>

          <section className={styles.jobFactStrip} aria-label="Selected job summary">
            <div><span>Scheduled</span><strong>{formatWhen(selectedVisit.startAt, data.workspace.timezone)}</strong></div>
            <div><span>Crew</span><strong>{selectedCrew?.name ?? "Unassigned"}</strong></div>
            <div><span>Duration</span><strong>{selectedVisit.serviceMinutes} min</strong></div>
            <div><span>Checklist</span><strong>{selectedChecklistDone}/{selectedChecklist.length}</strong></div>
          </section>

          {selectedProperty ? (
            <section className={styles.jobLocationBar}>
              <div><span>Service location</span><strong>{selectedProperty.address || selectedProperty.label}</strong></div>
              {selectedProperty.accessNotes ? <div><span>Access</span><strong>{selectedProperty.accessNotes}</strong></div> : null}
            </section>
          ) : null}

          <div className={styles.jobsDetailGrid}>
            <section className={styles.jobsSection}>
              <div className={styles.jobsSectionHeader}>
                <div><p className={styles.jobsSectionEyebrow}>Field record</p><h3>Evidence & notes</h3></div>
                <div className={styles.evidenceMiniStatus}>
                  <span className={selectedBefore ? styles.evidenceReady : undefined}>Before {selectedBefore ? "✓" : "—"}</span>
                  <span className={selectedAfter ? styles.evidenceReady : undefined}>After {selectedAfter ? "✓" : "—"}</span>
                </div>
              </div>

              {selectedEvidence.length ? (
                <div className={styles.jobEvidenceList}>
                  {selectedEvidence.slice(0, 8).map((item) => (
                    <article className={styles.jobEvidenceRow} key={item.id}>
                      <span className={styles.jobEvidenceIcon} aria-hidden="true">{item.kind.includes("PHOTO") ? "▣" : "•"}</span>
                      <span><strong>{item.kind.replaceAll("_", " ")}</strong><small>{item.text ?? "Photo evidence"}</small></span>
                      <time>{formatWhen(item.capturedAt, data.workspace.timezone)}</time>
                    </article>
                  ))}
                </div>
              ) : (
                <div className={styles.jobsEmpty}><strong>No field evidence yet</strong><p>Before/after photos are added from the crew workflow.</p></div>
              )}

              <form action={saveVisitNote} className={styles.jobNoteForm}>
                <input type="hidden" name="visitId" value={selectedVisit.id} />
                <FormGrid columns={1}>
                  <FormField id={"job-note-kind-" + selectedVisit.id} label="Note type">
                    {({ id, describedBy, invalid }) => (
                      <SelectInput id={id} name="kind" defaultValue="TIME_MATERIAL_NOTE" describedBy={describedBy} invalid={invalid}>
                        <option value="TIME_MATERIAL_NOTE">Time / material note</option>
                        <option value="INCIDENT_NOTE">Incident</option>
                      </SelectInput>
                    )}
                  </FormField>
                  <FormField id={"job-note-" + selectedVisit.id} label="Add staff note" required>
                    {({ id, describedBy, invalid }) => (
                      <TextArea id={id} name="note" rows={3} required describedBy={describedBy} invalid={invalid} placeholder="Record an operational note" />
                    )}
                  </FormField>
                </FormGrid>
                <button className="app-button-secondary" type="submit">Save note</button>
              </form>
            </section>

            <section className={styles.jobsSection}>
              <div className={styles.jobsSectionHeader}>
                <div><p className={styles.jobsSectionEyebrow}>Completion</p><h3>Checklist</h3></div>
                <span className={styles.jobsSectionMeta}>{selectedChecklistDone}/{selectedChecklist.length} complete</span>
              </div>

              {selectedChecklist.length ? (
                <ul className={styles.staffChecklist}>
                  {selectedChecklist.map((item) => (
                    <li className={item.completed ? styles.staffChecklistDone : undefined} key={item.id}>
                      <span className={styles.staffCheckMark} aria-hidden="true">{item.completed ? "✓" : ""}</span>
                      <span><strong>{item.itemKey}</strong><small>{item.note ?? "No note"}</small></span>
                      <StatusBadge tone={item.completed ? "success" : "neutral"}>{item.completed ? "Complete" : "Open"}</StatusBadge>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className={styles.jobsEmpty}><strong>No checklist items</strong><p>Add an item below to start the staff checklist.</p></div>
              )}

              <form action={saveChecklistItem} className={styles.jobChecklistForm}>
                <input type="hidden" name="visitId" value={selectedVisit.id} />
                <input type="hidden" name="completed" value="true" />
                <FormGrid columns={1}>
                  <FormField id={"checklist-key-" + selectedVisit.id} label="Checklist item" required>
                    {({ id, describedBy, invalid }) => <TextInput id={id} name="itemKey" required describedBy={describedBy} invalid={invalid} placeholder="e.g. kitchen" />}
                  </FormField>
                  <FormField id={"checklist-note-" + selectedVisit.id} label="Note">
                    {({ id, describedBy, invalid }) => <TextInput id={id} name="note" describedBy={describedBy} invalid={invalid} placeholder="Optional note" />}
                  </FormField>
                </FormGrid>
                <button className="app-button-secondary" type="submit">Mark complete</button>
              </form>
            </section>
          </div>
        </article>
      </div>
    </section>
  );
}

function InvoicesView({
  data,
  workspaceSlug,
  selectedInvoiceId,
}: {
  data: OperationalStaffSnapshot;
  workspaceSlug: string;
  selectedInvoiceId?: string;
}) {
  async function manualPayment(formData: FormData) {
    "use server";
    const invoiceId = String(formData.get("invoiceId") ?? "");
    const amount = String(formData.get("amount") ?? "").trim();
    const match = amount.match(/^(\d+)(?:\.(\d{1,2}))?$/);
    if (!match) {
      actionRedirect(workspaceSlug, "invoices", { ok: false, message: "Enter a valid payment amount." }, "invoice=" + encodeURIComponent(invoiceId) + "&");
    }
    const amountMinor = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
    const methodRaw = String(formData.get("method") ?? "OTHER");
    const method = methodRaw === "CASH" || methodRaw === "BANK_TRANSFER" ? methodRaw : "OTHER";
    const result = await applyOperationalManualPayment(workspaceSlug, invoiceId, amountMinor, method, String(formData.get("reference") ?? ""));
    actionRedirect(workspaceSlug, "invoices", result, "invoice=" + encodeURIComponent(invoiceId) + "&");
  }

  if (data.invoices.length === 0) {
    return <EmptyState title="No invoices yet" detail="Invoices will appear after billable visits are created." />;
  }

  const orderedInvoices = [...data.invoices].sort((left, right) => {
    const leftOpen = left.balanceMinor > 0 && left.status !== "VOID" ? 0 : 1;
    const rightOpen = right.balanceMinor > 0 && right.status !== "VOID" ? 0 : 1;
    return leftOpen - rightOpen || right.balanceMinor - left.balanceMinor;
  });
  const selectedInvoice = orderedInvoices.find((invoice) => invoice.id === selectedInvoiceId) ?? orderedInvoices[0];
  const selectedInvoiceQuote = data.quotes.find((quote) => quote.id === selectedInvoice.quoteId);
  const selectedInvoiceRequest = data.requests.find((request) => request.id === selectedInvoiceQuote?.requestId);
  const selectedInvoiceCustomer = data.customers.find((customer) => customer.id === selectedInvoiceRequest?.customerId);
  const selectedInvoiceProperty = data.properties.find((property) => property.id === selectedInvoiceRequest?.propertyId);
  const selectedInvoiceCanRecordPayment = selectedInvoice.balanceMinor > 0 && selectedInvoice.status !== "VOID";
  const openInvoices = orderedInvoices.filter((invoice) => invoice.balanceMinor > 0 && invoice.status !== "VOID");
  const paidInvoices = orderedInvoices.filter((invoice) => invoice.status === "PAID").length;

  return (
    <section className={styles.financeWorkspace} aria-label="Invoice collection workspace">
      <header className={styles.financeToolbar}>
        <div>
          <p className={styles.financeEyebrow}>Customer finance</p>
          <h2>Invoices</h2>
          <p>{openInvoices.length} open balance{openInvoices.length === 1 ? "" : "s"} · {paidInvoices} paid</p>
        </div>
        <a className="app-button-secondary" href={buildStaffModuleHref(workspaceSlug, "reports")}>Open reports</a>
      </header>

      <div className={styles.financeSplit}>
        <aside className={styles.financeQueue} aria-label="Invoice list">
          {orderedInvoices.map((invoice) => {
            const quote = data.quotes.find((item) => item.id === invoice.quoteId);
            const request = data.requests.find((item) => item.id === quote?.requestId);
            const customer = data.customers.find((item) => item.id === request?.customerId);
            const selected = invoice.id === selectedInvoice.id;
            return (
              <a
                className={`${styles.financeQueueItem} ${selected ? styles.financeQueueSelected : ""}`.trim()}
                href={"?invoice=" + encodeURIComponent(invoice.id)}
                aria-current={selected ? "page" : undefined}
                key={invoice.id}
              >
                <span className={styles.financeQueueTop}>
                  <strong>{customer?.displayName ?? "Customer"}</strong>
                  <StatusBadge tone={statusBadgeTone(invoice.status)}>{invoice.status.replaceAll("_", " ")}</StatusBadge>
                </span>
                <span className={styles.financeQueueService}>{request?.serviceLabel ?? "Service invoice"}</span>
                <span className={styles.financeQueueMoney}>
                  <span>{formatMinorMoney(invoice.balanceMinor, invoice.currency)} due</span>
                  <small>Invoice {invoice.id.slice(0, 8)}</small>
                </span>
              </a>
            );
          })}
        </aside>

        <article className={styles.financeDetail}>
          <header className={styles.financeDetailHeader}>
            <div>
              <p className={styles.financeEyebrow}>Invoice {selectedInvoice.id.slice(0, 8)}</p>
              <h2>{selectedInvoiceCustomer?.displayName ?? "Customer unavailable"}</h2>
              <p>{selectedInvoiceRequest?.serviceLabel ?? "Service invoice"} · {selectedInvoiceProperty?.label ?? "Property not linked"}</p>
            </div>
            <StatusBadge tone={statusBadgeTone(selectedInvoice.status)}>{selectedInvoice.status.replaceAll("_", " ")}</StatusBadge>
          </header>

          <section className={styles.invoiceHero} aria-label="Invoice balance summary">
            <div className={styles.invoiceBalance}>
              <span>Outstanding balance</span>
              <strong>{formatMinorMoney(selectedInvoice.balanceMinor, selectedInvoice.currency)}</strong>
              <small>{selectedInvoice.status === "PAID" ? "Paid in full" : selectedInvoice.status === "VOID" ? "Invoice void" : "Current amount still to collect"}</small>
            </div>
            <div><span>Invoice total</span><strong>{formatMinorMoney(selectedInvoice.totalMinor, selectedInvoice.currency)}</strong></div>
            <div><span>Allocated</span><strong>{formatMinorMoney(selectedInvoice.allocatedMinor, selectedInvoice.currency)}</strong></div>
            <div><span>Refunded</span><strong>{formatMinorMoney(selectedInvoice.refundedMinor, selectedInvoice.currency)}</strong></div>
          </section>

          <div className={styles.financeDetailGrid}>
            <section className={styles.financeSection}>
              <div className={styles.financeSectionHeader}>
                <div><p className={styles.financeSectionEyebrow}>Invoice context</p><h3>Customer & service</h3></div>
              </div>
              <dl className={styles.financeSummary}>
                <div><dt>Customer</dt><dd>{selectedInvoiceCustomer?.displayName ?? "Unavailable"}</dd></div>
                <div><dt>Service</dt><dd>{selectedInvoiceRequest?.serviceLabel ?? "Service invoice"}</dd></div>
                <div><dt>Property</dt><dd>{selectedInvoiceProperty?.label ?? "Not linked"}</dd></div>
                <div><dt>Quote</dt><dd>{selectedInvoiceQuote ? `v${selectedInvoiceQuote.version} · ${selectedInvoiceQuote.status.replaceAll("_", " ")}` : "Unavailable"}</dd></div>
              </dl>
              {selectedInvoiceCanRecordPayment ? (
                <div className={styles.sandboxInfo}>
                  <strong>Customer online payment</strong>
                  <p>Eligible open invoices can be paid from the customer portal using the ServiceDesk SANDBOX checkout. Paid state changes only after verified payment application.</p>
                </div>
              ) : null}
            </section>

            <section className={styles.financeSection}>
              <div className={styles.financeSectionHeader}>
                <div><p className={styles.financeSectionEyebrow}>Collection</p><h3>{selectedInvoiceCanRecordPayment ? "Record offline payment" : "Payment status"}</h3></div>
              </div>
              {selectedInvoiceCanRecordPayment ? (
                <form action={manualPayment} className={styles.paymentForm}>
                  <input type="hidden" name="invoiceId" value={selectedInvoice.id} />
                  <FormGrid columns={2}>
                    <FormField id={"payment-amount-" + selectedInvoice.id} label="Amount" required>
                      {({ id, describedBy, invalid }) => <TextInput id={id} name="amount" type="text" defaultValue={(selectedInvoice.balanceMinor / 100).toFixed(2)} required describedBy={describedBy} invalid={invalid} />}
                    </FormField>
                    <FormField id={"payment-method-" + selectedInvoice.id} label="Method" required>
                      {({ id, describedBy, invalid }) => (
                        <SelectInput id={id} name="method" defaultValue="BANK_TRANSFER" required describedBy={describedBy} invalid={invalid}>
                          <option value="BANK_TRANSFER">Bank transfer</option>
                          <option value="CASH">Cash</option>
                          <option value="OTHER">Other</option>
                        </SelectInput>
                      )}
                    </FormField>
                    <FormField id={"payment-reference-" + selectedInvoice.id} label="Reference" required>
                      {({ id, describedBy, invalid }) => <TextInput id={id} name="reference" placeholder="Bank reference or receipt number" required describedBy={describedBy} invalid={invalid} />}
                    </FormField>
                  </FormGrid>
                  <button className="app-button-primary" type="submit">Record payment</button>
                  <p>Use this only for money already received outside the online checkout flow. It does not simulate online settlement.</p>
                </form>
              ) : (
                <div className={styles.financeClosedState}>
                  <span aria-hidden="true">✓</span>
                  <div><strong>{selectedInvoice.status === "VOID" ? "Invoice void" : "Nothing outstanding"}</strong><p>{selectedInvoice.status === "VOID" ? "Payments cannot be recorded on this invoice." : "This invoice has no outstanding balance."}</p></div>
                </div>
              )}
            </section>
          </div>
        </article>
      </div>
    </section>
  );
}

function QualityView({
  data,
  workspaceSlug,
  selectedQualityCaseId,
}: {
  data: OperationalStaffSnapshot;
  workspaceSlug: string;
  selectedQualityCaseId?: string;
}) {
  async function qualityAction(formData: FormData) {
    "use server";
    const action = String(formData.get("action") ?? "") as
      | "START_REVIEW"
      | "ASSIGN"
      | "RESOLVE"
      | "REQUEST_REVIEW";
    const allowed = ["START_REVIEW", "ASSIGN", "RESOLVE", "REQUEST_REVIEW"];
    if (!allowed.includes(action)) {
      actionRedirect(workspaceSlug, "quality", { ok: false, message: "Unsupported quality action." });
    }
    const qualityCaseId = String(formData.get("qualityCaseId") ?? "");
    const result = await applyOperationalQualityAction(
      workspaceSlug,
      qualityCaseId,
      action,
      String(formData.get("resolutionNote") ?? ""),
    );
    actionRedirect(workspaceSlug, "quality", result, "case=" + encodeURIComponent(qualityCaseId) + "&");
  }

  if (data.qualityCases.length === 0) {
    return <EmptyState title="No quality cases" detail="Customer feedback that requires operational review will appear here." />;
  }

  const orderedCases = [...data.qualityCases].sort((left, right) => {
    const stateWeight: Record<string, number> = { IN_REVIEW: 0, OPEN: 1, RESOLVED: 2 };
    return (stateWeight[left.state] ?? 9) - (stateWeight[right.state] ?? 9)
      || (left.dueAt ? Date.parse(left.dueAt) : Number.MAX_SAFE_INTEGER) - (right.dueAt ? Date.parse(right.dueAt) : Number.MAX_SAFE_INTEGER);
  });
  const selected = orderedCases.find((qualityCase) => qualityCase.id === selectedQualityCaseId) ?? orderedCases[0];
  const visit = data.visits.find((item) => item.id === selected.visitId);
  const request = visit ? data.requests.find((item) => item.id === visit.requestId) : undefined;
  const customer = request?.customerId ? data.customers.find((item) => item.id === request.customerId) : undefined;
  const property = request?.propertyId ? data.properties.find((item) => item.id === request.propertyId) : undefined;
  const crew = visit?.crewId ? data.crews.find((item) => item.id === visit.crewId) : undefined;
  const evidence = data.visitEvidence.filter((item) => item.visitId === selected.visitId);
  const openCount = orderedCases.filter((item) => item.state === "OPEN").length;
  const reviewCount = orderedCases.filter((item) => item.state === "IN_REVIEW").length;
  const resolvedCount = orderedCases.filter((item) => item.state === "RESOLVED").length;

  return (
    <section className={styles.qualityWorkspace} aria-label="Quality review workspace">
      <header className={styles.qualityToolbar}>
        <div>
          <p className={styles.qualityEyebrow}>Service quality</p>
          <h2>Quality</h2>
          <p>{openCount} open · {reviewCount} in review · {resolvedCount} resolved</p>
        </div>
        <a className="app-button-secondary" href={buildStaffModuleHref(workspaceSlug, "jobs")}>Open jobs</a>
      </header>

      <div className={styles.qualitySplit}>
        <aside className={styles.qualityQueue} aria-label="Quality case list">
          {orderedCases.map((qualityCase) => {
            const caseVisit = data.visits.find((item) => item.id === qualityCase.visitId);
            const caseRequest = caseVisit ? data.requests.find((item) => item.id === caseVisit.requestId) : undefined;
            const caseCustomer = caseRequest?.customerId ? data.customers.find((item) => item.id === caseRequest.customerId) : undefined;
            const selectedCase = qualityCase.id === selected.id;
            return (
              <a
                className={`${styles.qualityQueueItem} ${selectedCase ? styles.qualityQueueSelected : ""}`.trim()}
                href={"?case=" + encodeURIComponent(qualityCase.id)}
                aria-current={selectedCase ? "page" : undefined}
                key={qualityCase.id}
              >
                <span className={styles.qualityQueueTop}>
                  <strong>{qualityCase.summary}</strong>
                  <StatusBadge tone={statusBadgeTone(qualityCase.state)}>{qualityCase.state.replaceAll("_", " ")}</StatusBadge>
                </span>
                <span className={styles.qualityQueueCustomer}>{caseCustomer?.displayName ?? caseRequest?.serviceLabel ?? "Service visit"}</span>
                <span className={styles.qualityQueueMeta}>
                  <span>{qualityCase.feedbackScore !== undefined ? `${qualityCase.feedbackScore}/5 feedback` : "No score"}</span>
                  <span>{qualityCase.ownerUserId ? "Assigned" : "Unassigned"}</span>
                </span>
              </a>
            );
          })}
        </aside>

        <article className={styles.qualityDetail}>
          <header className={styles.qualityDetailHeader}>
            <div>
              <p className={styles.qualityEyebrow}>Quality case</p>
              <h2>{selected.summary}</h2>
              <p>{customer?.displayName ?? "Customer"} · {request?.serviceLabel ?? "Service visit"}</p>
            </div>
            <div className={styles.qualityHeaderActions}>
              <StatusBadge tone={statusBadgeTone(selected.state)}>{selected.state.replaceAll("_", " ")}</StatusBadge>
              {selected.state === "OPEN" ? (
                <form action={qualityAction} className={styles.qualityInlineActions}>
                  <input type="hidden" name="qualityCaseId" value={selected.id} />
                  <button className="app-button-secondary" name="action" value="ASSIGN">Assign to me</button>
                  <button className="app-button-primary" name="action" value="START_REVIEW">Start review</button>
                </form>
              ) : selected.state === "RESOLVED" && selected.reviewRequestState === "ELIGIBLE" ? (
                <form action={qualityAction}>
                  <input type="hidden" name="qualityCaseId" value={selected.id} />
                  <button className="app-button-primary" name="action" value="REQUEST_REVIEW">Request customer review</button>
                </form>
              ) : null}
            </div>
          </header>

          <section className={styles.qualityMetrics} aria-label="Quality case summary">
            <div><span>Feedback</span><strong>{selected.feedbackScore !== undefined ? `${selected.feedbackScore}/5` : "—"}</strong></div>
            <div><span>Owner</span><strong>{selected.ownerUserId ? "Assigned" : "Unassigned"}</strong></div>
            <div><span>Deadline</span><strong>{formatWhen(selected.dueAt, data.workspace.timezone)}</strong></div>
            <div><span>Evidence</span><strong>{evidence.length}</strong></div>
          </section>

          <div className={styles.qualityDetailGrid}>
            <section className={styles.qualitySection}>
              <div className={styles.qualitySectionHeader}>
                <div><p className={styles.qualitySectionEyebrow}>Service context</p><h3>Visit & customer</h3></div>
                {visit ? <a className={styles.qualityTextLink} href={`/app/${encodeURIComponent(workspaceSlug)}/jobs?job=${encodeURIComponent(visit.id)}`}>Open job →</a> : null}
              </div>
              <dl className={styles.qualitySummary}>
                <div><dt>Customer</dt><dd>{customer?.displayName ?? "Unavailable"}</dd></div>
                <div><dt>Property</dt><dd>{property?.label ?? "Not linked"}</dd></div>
                <div><dt>Visit</dt><dd>{visit ? formatWhen(visit.startAt, data.workspace.timezone) : "Unavailable"}</dd></div>
                <div><dt>Crew</dt><dd>{crew?.name ?? (visit?.crewId ? "Assigned" : "Unassigned")}</dd></div>
                <div><dt>Review request</dt><dd>{selected.reviewRequestState.replaceAll("_", " ")}</dd></div>
              </dl>
              {selected.resolutionNote ? <div className={styles.qualityResolution}><span>Resolution</span><p>{selected.resolutionNote}</p></div> : null}
            </section>

            <section className={styles.qualitySection}>
              <div className={styles.qualitySectionHeader}>
                <div><p className={styles.qualitySectionEyebrow}>Field proof</p><h3>Evidence</h3></div>
                <span className={styles.qualitySectionMeta}>{evidence.length} item{evidence.length === 1 ? "" : "s"}</span>
              </div>
              {evidence.length ? (
                <div className={styles.qualityEvidenceList}>
                  {evidence.map((item) => (
                    <article className={styles.qualityEvidenceRow} key={item.id}>
                      <span className={styles.qualityEvidenceIcon} aria-hidden="true">{item.kind.includes("PHOTO") ? "▣" : "•"}</span>
                      <span><strong>{item.kind.replaceAll("_", " ")}</strong><small>{item.text ?? "Photo evidence"}</small></span>
                      <time>{formatWhen(item.capturedAt, data.workspace.timezone)}</time>
                    </article>
                  ))}
                </div>
              ) : (
                <div className={styles.qualityEmpty}><strong>No evidence recorded</strong><p>No field evidence is currently linked to this visit.</p></div>
              )}
            </section>
          </div>

          {selected.state === "IN_REVIEW" ? (
            <section className={styles.qualityResolutionPanel}>
              <div><p className={styles.qualitySectionEyebrow}>Resolution</p><h3>Close this case</h3><p>Record what was resolved before closing the quality issue.</p></div>
              <form action={qualityAction}>
                <input type="hidden" name="qualityCaseId" value={selected.id} />
                <FormField id={"quality-resolution-" + selected.id} label="Resolution note" required>
                  {({ id, describedBy, invalid }) => (
                    <TextArea id={id} name="resolutionNote" rows={4} required describedBy={describedBy} invalid={invalid} placeholder="Describe what was resolved" />
                  )}
                </FormField>
                <button className="app-button-primary" name="action" value="RESOLVE">Resolve case</button>
              </form>
            </section>
          ) : null}
        </article>
      </div>
    </section>
  );
}

function attentionResourceHref(workspaceSlug: string, item: OperationalAttention): string | undefined {
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
      return undefined;
  }
}

function AutomationsView({ data, workspaceSlug }: { data: OperationalStaffSnapshot; workspaceSlug: string }) {
  if (data.attentionItems.length === 0) {
    return (
      <EmptyState
        title="No recovery work"
        detail="There are no open attention items requiring human intervention."
      />
    );
  }

  return (
    <div className={styles.stack}>
      <OperationsToolbar
        context={<ToolbarResultCount count={data.attentionItems.length} label="attention items" />}
      />
      <DataTable<OperationalAttention>
        caption="Operational recovery queue"
        rows={data.attentionItems}
        getRowKey={(item) => item.id}
        columns={[
          {
            id: "issue",
            header: "Issue",
            priority: "primary",
            cell: (item) => <DataCellStack primary={item.summary} secondary={item.type.replaceAll("_", " ")} />,
          },
          {
            id: "severity",
            header: "Severity",
            cell: (item) => (
              <StatusBadge tone={item.severity === "CRITICAL" ? "danger" : item.severity === "WARNING" ? "warning" : "info"}>
                {item.severity}
              </StatusBadge>
            ),
          },
          {
            id: "resource",
            header: "Resource",
            cell: (item) => item.resourceType,
          },
          {
            id: "owner",
            header: "Owner",
            cell: (item) => item.ownerUserId ? "Assigned" : "Unassigned",
          },
          {
            id: "due",
            header: "Due",
            priority: "optional",
            cell: (item) => formatWhen(item.dueAt, data.workspace.timezone),
          },
          {
            id: "action",
            header: "Action",
            priority: "primary",
            cell: (item) => {
              const href = attentionResourceHref(workspaceSlug, item);
              return href ? (
                <a className="app-button-secondary" href={href}>Open related record</a>
              ) : (
                <span className="app-field-help" title="This attention item has no supported deep link yet.">
                  Reference only
                </span>
              );
            },
          },
        ]}
        renderMobileRow={(item) => {
          const href = attentionResourceHref(workspaceSlug, item);
          return (
            <div>
              <DataCellStack primary={item.summary} secondary={item.severity + " · " + item.resourceType} />
              {href ? (
                <div className="app-row-actions">
                  <a className="app-button-secondary" href={href}>Open related record</a>
                </div>
              ) : null}
            </div>
          );
        }}
      />
      <FeedbackBanner
        title="Recovery remains human-owned"
        description="This queue surfaces persisted operational attention. No generic recovery mutation exists, so ServiceDesk does not invent a workflow-builder action."
        tone="info"
      />
    </div>
  );
}


function ReportsView({ data }: { data: OperationalStaffSnapshot }) {
  const snapshot = data.reporting;
  if (!snapshot) {
    return <EmptyState title="Reports unavailable" detail="Reporting data is temporarily unavailable." />;
  }

  const conversionBps = snapshot.conversionRateBps ?? 0;
  const conversionPercent = Math.max(0, Math.min(100, conversionBps / 100));
  const conversionLabel =
    snapshot.conversionRateBps === undefined
      ? "—"
      : conversionPercent.toFixed(1) + "%";
  const currency = snapshot.currency ?? "USD";
  const requestMax = Math.max(snapshot.requestCount, 1);
  const bookedPercent = Math.round((snapshot.bookedRequestCount / requestMax) * 100);
  const totalSchedule = snapshot.scheduledServiceMinutes + snapshot.scheduledBufferMinutes;
  const serviceShare = totalSchedule > 0
    ? Math.round((snapshot.scheduledServiceMinutes / totalSchedule) * 100)
    : 0;

  return (
    <section className={styles.reportsWorkspace} aria-label="Operations reporting workspace">
      <header className={styles.adminPageHeader}>
        <div>
          <p className={styles.adminEyebrow}>Business performance</p>
          <h2>Reports</h2>
          <p>
            {snapshot.from ? formatWhen(snapshot.from, data.workspace.timezone) : "Rolling period"}
            {" – "}
            {snapshot.to ? formatWhen(snapshot.to, data.workspace.timezone) : "Now"}
          </p>
        </div>
        <div className={styles.reportUpdated}>
          <span>Last updated</span>
          <strong>{formatWhen(snapshot.generatedAt, data.workspace.timezone)}</strong>
        </div>
      </header>

      <section className={styles.reportKpis} aria-label="Business performance summary">
        <article>
          <span>Requests</span>
          <strong>{snapshot.requestCount}</strong>
          <small>Service demand</small>
        </article>
        <article>
          <span>Booked</span>
          <strong>{snapshot.bookedRequestCount}</strong>
          <small>Confirmed demand</small>
        </article>
        <article>
          <span>Request conversion</span>
          <strong>{conversionLabel}</strong>
          <small>Requests converted to bookings</small>
        </article>
        <article>
          <span>Collected</span>
          <strong>{formatMinorMoney(snapshot.collectedMinor, currency)}</strong>
          <small>Allocated collections</small>
        </article>
        <article className={snapshot.outstandingMinor > 0 ? styles.reportAttention : undefined}>
          <span>Outstanding</span>
          <strong>{formatMinorMoney(snapshot.outstandingMinor, currency)}</strong>
          <small>Open customer balances</small>
        </article>
      </section>

      <div className={styles.reportGrid}>
        <section className={styles.adminCard}>
          <div className={styles.adminCardHeader}>
            <div>
              <p className={styles.adminSectionEyebrow}>Conversion</p>
              <h3>Request funnel</h3>
            </div>
          </div>
          <div className={styles.funnelRows}>
            <div>
              <span>Requests</span>
              <div><i style={{ width: "100%" }} /></div>
              <strong>{snapshot.requestCount}</strong>
            </div>
            <div>
              <span>Booked</span>
              <div><i style={{ width: bookedPercent + "%" }} /></div>
              <strong>{snapshot.bookedRequestCount}</strong>
            </div>
            <div>
              <span>Conversion</span>
              <div><i style={{ width: conversionPercent + "%" }} /></div>
              <strong>{conversionLabel}</strong>
            </div>
          </div>
          <div className={styles.reportInsight}>
            <strong>Request conversion</strong>
            <p>Calculated from persisted requests and booked request state for this reporting period.</p>
          </div>
        </section>

        <section className={styles.adminCard}>
          <div className={styles.adminCardHeader}>
            <div>
              <p className={styles.adminSectionEyebrow}>Cash position</p>
              <h3>Collections</h3>
            </div>
          </div>
          <div className={styles.moneySummary}>
            <div>
              <span>Collected</span>
              <strong>{formatMinorMoney(snapshot.collectedMinor, currency)}</strong>
            </div>
            <div className={snapshot.outstandingMinor > 0 ? styles.moneyWarning : undefined}>
              <span>Outstanding</span>
              <strong>{formatMinorMoney(snapshot.outstandingMinor, currency)}</strong>
            </div>
          </div>
          <p className={styles.adminHelp}>Customer invoice balances remain authoritative in Invoices.</p>
        </section>

        <section className={styles.adminCard}>
          <div className={styles.adminCardHeader}>
            <div>
              <p className={styles.adminSectionEyebrow}>Capacity</p>
              <h3>Scheduled workload</h3>
            </div>
          </div>
          <div className={styles.capacityBody}>
            <div className={styles.capacityBar} aria-label="Scheduled service versus buffer">
              <i style={{ width: serviceShare + "%" }} />
            </div>
            <div className={styles.capacityLegend}>
              <span><strong>{Math.round(snapshot.scheduledServiceMinutes / 60)}h</strong> service</span>
              <span><strong>{Math.round(snapshot.scheduledBufferMinutes / 60)}h</strong> buffer</span>
            </div>
          </div>
        </section>

        <section className={styles.adminCard}>
          <div className={styles.adminCardHeader}>
            <div>
              <p className={styles.adminSectionEyebrow}>Exceptions</p>
              <h3>Operational risk</h3>
            </div>
          </div>
          <div className={styles.riskRows}>
            <a href={buildStaffModuleHref(data.workspace.slug, "automations")}>
              <span><strong>Open attention</strong><small>Recovery queue</small></span>
              <b>{snapshot.openAttentionCount}</b>
            </a>
            <a href={buildStaffModuleHref(data.workspace.slug, "quality")}>
              <span><strong>Unresolved quality</strong><small>Quality queue</small></span>
              <b>{snapshot.unresolvedQualityCount}</b>
            </a>
          </div>
        </section>
      </div>
    </section>
  );
}

function BillingView({ data }: { data: OperationalStaffSnapshot }) {
  const snapshot = data.platformBilling;
  if (!snapshot) {
    return <EmptyState title="Platform billing unavailable" detail="Subscription information is temporarily unavailable." />;
  }

  const subscription = snapshot.subscription;
  const atLimit = snapshot.usage.filter((row) => row.state === "LIMIT_REACHED").length;

  return (
    <section className={styles.billingWorkspace} aria-label="ServiceDesk subscription billing">
      <header className={styles.adminPageHeader}>
        <div>
          <p className={styles.adminEyebrow}>Account & plan</p>
          <h2>Billing</h2>
          <p>ServiceDesk subscription billing and platform usage.</p>
        </div>
        <StatusBadge tone={subscription.providerMode === "SANDBOX" ? "warning" : statusBadgeTone(subscription.status)}>
          {subscription.providerMode === "SANDBOX" ? "Sandbox billing" : "Live billing"}
        </StatusBadge>
      </header>

      {subscription.providerMode === "SANDBOX" ? (
        <div className={styles.billingNotice}>
          <span aria-hidden="true">i</span>
          <div>
            <strong>Platform billing is in sandbox mode</strong>
            <p>No live ServiceDesk subscription charge is created in this mode.</p>
          </div>
        </div>
      ) : null}

      <section className={styles.planHero}>
        <div>
          <p>Current plan</p>
          <h3>{subscription.plan}</h3>
          <StatusBadge tone={statusBadgeTone(subscription.status)}>
            {subscription.status.replaceAll("_", " ")}
          </StatusBadge>
        </div>
        <dl>
          <div>
            <dt>Billing mode</dt>
            <dd>{subscription.providerMode === "SANDBOX" ? "Sandbox" : "Live"}</dd>
          </div>
          <div>
            <dt>Trial ends</dt>
            <dd>{formatWhen(subscription.trialEndsAt, data.workspace.timezone)}</dd>
          </div>
          <div>
            <dt>Period ends</dt>
            <dd>{formatWhen(subscription.currentPeriodEndsAt, data.workspace.timezone)}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.adminCard}>
        <div className={styles.adminCardHeader}>
          <div>
            <p className={styles.adminSectionEyebrow}>Plan usage</p>
            <h3>Usage & limits</h3>
          </div>
          <span>{atLimit ? atLimit + " at limit" : "Within limits"}</span>
        </div>
        <div className={styles.usageGrid}>
          {snapshot.usage.map((row) => {
            const percent =
              row.limit && row.limit > 0
                ? Math.min(100, Math.round((row.used / row.limit) * 100))
                : 100;
            return (
              <article key={row.metric}>
                <div>
                  <span>
                    <strong>{row.metric.replaceAll("_", " ").toLowerCase()}</strong>
                    <small>{row.used} used · {row.limit ?? "Unlimited"} limit</small>
                  </span>
                  <StatusBadge tone={row.state === "LIMIT_REACHED" ? "warning" : "neutral"}>
                    {row.state === "UNLIMITED" ? "Unlimited" : row.state.replaceAll("_", " ").toLowerCase()}
                  </StatusBadge>
                </div>
                <div className={styles.usageTrack} aria-label={row.metric.replaceAll("_", " ") + " usage"}>
                  <i style={{ width: percent + "%" }} />
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.billingSeparation}>
        <div>
          <p className={styles.adminSectionEyebrow}>Customer finance</p>
          <h3>Customer invoices are separate</h3>
          <p>Service invoices and customer collections do not change the ServiceDesk subscription shown here.</p>
        </div>
        <a className="app-button-secondary" href={buildStaffModuleHref(data.workspace.slug, "invoices")}>
          Open customer invoices
        </a>
      </section>
    </section>
  );
}

function SettingsView({ data, workspaceSlug }: { data: OperationalStaffSnapshot; workspaceSlug: string }) {
  const snapshot = data.ownerSettings;
  if (!snapshot) {
    return <EmptyState title="Settings unavailable" detail="Workspace settings are temporarily unavailable." />;
  }

  async function serviceCatalogAction(formData: FormData) {
    "use server";
    const result = await updateOperationalServiceCatalogItem(workspaceSlug, {
      serviceId: String(formData.get("serviceId") ?? ""),
      name: String(formData.get("name") ?? ""),
      active: String(formData.get("active") ?? "") === "on",
      requiresReview: String(formData.get("requiresReview") ?? "") === "on",
      expectedUpdatedAt: String(formData.get("expectedUpdatedAt") ?? ""),
    });
    actionRedirect(workspaceSlug, "settings", result);
  }

  async function recurrenceAction(formData: FormData) {
    "use server";
    const raw = String(formData.get("action") ?? "");
    const action = raw === "PAUSE" || raw === "RESUME" || raw === "SKIP_NEXT" ? raw : undefined;
    if (!action) {
      actionRedirect(workspaceSlug, "settings", { ok: false, message: "Unsupported recurring-service action." });
    }
    const result = await applyOperationalRecurrenceAction(
      workspaceSlug,
      String(formData.get("ruleId") ?? ""),
      action,
    );
    actionRedirect(workspaceSlug, "settings", result);
  }

  return (
    <div className={styles.stack}>
      <Panel>
        <SectionHeader
          title="Service catalog"
          description={
            data.actor.role === "OWNER"
              ? "Manage customer-facing service names, availability and manual-review requirements."
              : "Services currently available to this workspace. Only owners can change the catalog."
          }
        />
        {data.serviceCatalog.length === 0 ? (
          <AppEmptyState title="No services configured" description="Add services during workspace setup before taking new enquiries." />
        ) : (
          <div className="app-row-list">
            {data.serviceCatalog.map((service) => (
              data.actor.role === "OWNER" ? (
                <form action={serviceCatalogAction} className="app-row" key={service.id}>
                  <input type="hidden" name="serviceId" value={service.id} />
                  <input type="hidden" name="expectedUpdatedAt" value={service.updatedAt} />
                  <div>
                    <label>
                      <span className="app-sr-only">Service name for {service.code}</span>
                      <input
                        className="app-input"
                        name="name"
                        type="text"
                        defaultValue={service.name}
                        maxLength={120}
                        required
                      />
                    </label>
                    <p>{service.code} · Updated {formatWhen(service.updatedAt, data.workspace.timezone)}</p>
                  </div>
                  <div className="app-row-meta">
                    <label className="app-checkbox-field">
                      <input name="active" type="checkbox" defaultChecked={service.active} />
                      <span><strong>Available</strong><small>Show for new enquiries.</small></span>
                    </label>
                    <label className="app-checkbox-field">
                      <input name="requiresReview" type="checkbox" defaultChecked={service.requiresReview} />
                      <span><strong>Manual review</strong><small>Require staff review before confirmation.</small></span>
                    </label>
                    <button className="app-button-primary" type="submit">Save</button>
                  </div>
                </form>
              ) : (
                <article className="app-row" key={service.id}>
                  <div>
                    <h3>{service.name}</h3>
                    <p>{service.code}{service.requiresReview ? " · Manual review required" : ""}</p>
                  </div>
                  <StatusBadge tone={service.active ? "success" : "neutral"}>
                    {service.active ? "Available" : "Unavailable"}
                  </StatusBadge>
                </article>
              )
            ))}
          </div>
        )}
      </Panel>

      <Panel>
        <SectionHeader title="Team" description="Workspace memberships without exposing private credentials." />
        <div className="app-row-list">
          {snapshot.members.map((member) => (
            <article className="app-row" key={member.userId}>
              <div><h3>{member.role}</h3><p>{member.userId.slice(0, 8)}…</p></div>
              <StatusBadge tone={member.active ? "success" : "neutral"}>{member.active ? "Active" : "Inactive"}</StatusBadge>
            </article>
          ))}
        </div>
      </Panel>

      <Panel>
        <SectionHeader
          title="Invitations"
          description={snapshot.invitations.filter((invite) => invite.state === "PENDING").length + " pending"}
        />
        {snapshot.invitations.length === 0 ? (
          <AppEmptyState title="No invitations" description="No team invitations are recorded." />
        ) : (
          <div className="app-row-list">
            {snapshot.invitations.map((invite) => (
              <article className="app-row" key={invite.id}>
                <div><h3>{invite.role}</h3><p>Created {formatWhen(invite.createdAt, data.workspace.timezone)}</p></div>
                <StatusBadge tone={invite.state === "PENDING" ? "warning" : invite.state === "ACCEPTED" ? "success" : "neutral"}>
                  {invite.state}
                </StatusBadge>
              </article>
            ))}
          </div>
        )}
        <p className="app-field-help">Invitation links and tokens are never displayed here.</p>
      </Panel>

      <Panel>
        <SectionHeader title="Recurring services" description="Pause, resume or skip the next occurrence using the existing recurring-service command." />
        {data.recurrenceRules.length === 0 ? (
          <AppEmptyState title="No recurring services" description="Recurring service rules will appear here when they are configured." />
        ) : (
          <div className="app-row-list">
            {data.recurrenceRules.map((rule) => (
              <article className="app-row" key={rule.id}>
                <div>
                  <h3>{rule.frequency.replaceAll("_", " ")}</h3>
                  <p>{rule.nextOccurrenceOn ? "Next " + rule.nextOccurrenceOn : "No next occurrence"} · {rule.status.replaceAll("_", " ")}</p>
                </div>
                <form action={recurrenceAction}>
                  <input type="hidden" name="ruleId" value={rule.id} />
                  <RowActions label={"Recurring service actions for " + rule.id}>
                    {rule.status === "ACTIVE" ? (
                      <>
                        <button className="app-button-secondary" name="action" value="PAUSE">Pause</button>
                        <button className="app-button-secondary" name="action" value="SKIP_NEXT">Skip next</button>
                      </>
                    ) : rule.status === "PAUSED" ? (
                      <button className="app-button-secondary" name="action" value="RESUME">Resume</button>
                    ) : (
                      <span>Completed</span>
                    )}
                  </RowActions>
                </form>
              </article>
            ))}
          </div>
        )}
      </Panel>

      <Panel>
        <SectionHeader
          title="Integrations"
          description="Server-side readiness only. Secret values are never exposed, and configuration does not count as provider verification."
        />
        <div className="app-row-list">
          {data.integrations.map((integration) => {
            const readyForProof = integration.configurationState === "CONFIGURED";
            const statusLabel = integration.provider === "PAYMENT"
              ? "Sandbox ready"
              : readyForProof
                ? "Ready for proof"
                : integration.configurationState === "PARTIAL"
                  ? "Partial setup"
                  : "Setup required";
            const tone = integration.provider === "PAYMENT" || integration.configurationState === "PARTIAL"
              ? "warning" as const
              : readyForProof
                ? "info" as const
                : "neutral" as const;
            return (
              <article className="app-row" key={integration.provider}>
                <div>
                  <h3>{integration.label}</h3>
                  <p>{integration.mode} · {integration.verificationState.replaceAll("_", " ")}</p>
                  <p>{integration.message}</p>
                  {integration.missingConfiguration.length > 0 ? (
                    <p>
                      Missing: {integration.missingConfiguration
                        .slice(0, 3)
                        .map((item) => item.replaceAll("_", " ").toLowerCase())
                        .join(", ")}
                      {integration.missingConfiguration.length > 3
                        ? ` +${integration.missingConfiguration.length - 3} more`
                        : ""}
                    </p>
                  ) : null}
                </div>
                <StatusBadge tone={tone}>{statusLabel}</StatusBadge>
              </article>
            );
          })}
        </div>
        <FeedbackBanner
          title="Provider proof stays separate"
          description="These statuses are derived from server configuration presence and the internal payment sandbox. WhatsApp, Calendar, Email, n8n and AI are not called provider-verified until controlled external receipts are available."
          tone="info"
        />
      </Panel>
    </div>
  );
}

function renderModule(
  module: OperationalProductRouteProps["module"],
  data: OperationalStaffSnapshot,
  workspaceSlug: string,
  selectedConversationId?: string,
  selectedCustomerId?: string,
  selectedRequestId?: string,
  selectedQuoteId?: string,
  selectedQualityCaseId?: string,
  selectedJobId?: string,
  selectedInvoiceId?: string,
) {
  switch (module) {
    case "inbox":
      return (
        <InboxView
          data={data}
          workspaceSlug={workspaceSlug}
          selectedConversationId={selectedConversationId}
        />
      );
    case "customers":
      return <CustomersView data={data} selectedCustomerId={selectedCustomerId} />;
    case "requests":
      return <RequestsView data={data} workspaceSlug={workspaceSlug} selectedRequestId={selectedRequestId} />;
    case "quotes":
      return <QuotesView data={data} workspaceSlug={workspaceSlug} selectedQuoteId={selectedQuoteId} />;
    case "schedule":
      return <ScheduleView data={data} workspaceSlug={workspaceSlug} />;
    case "jobs":
      return <JobsView data={data} workspaceSlug={workspaceSlug} selectedJobId={selectedJobId} />;
    case "invoices":
      return <InvoicesView data={data} workspaceSlug={workspaceSlug} selectedInvoiceId={selectedInvoiceId} />;
    case "quality":
      return <QualityView data={data} workspaceSlug={workspaceSlug} selectedQualityCaseId={selectedQualityCaseId} />;
    case "automations":
      return <AutomationsView data={data} workspaceSlug={workspaceSlug} />;
    case "reports":
      return <ReportsView data={data} />;
    case "billing":
      return <BillingView data={data} />;
    case "settings":
      return <SettingsView data={data} workspaceSlug={workspaceSlug} />;
  }
}

export async function OperationalProductRoute({
  workspaceSlug,
  module,
  selectedConversationId,
  selectedCustomerId,
  selectedRequestId,
  selectedQuoteId,
  selectedQualityCaseId,
  selectedJobId,
  selectedInvoiceId,
  notice,
  error,
}: OperationalProductRouteProps) {
  const result = await loadOperationalStaffSnapshot(workspaceSlug);
  const config = staffModuleConfig[module];

  return (
    <>
      <PageHeader
        eyebrow={config.group}
        title={config.label}
        description={config.description}
      />

      <Notice notice={notice} error={error} />

      {result.ok ? (
        renderModule(module, result.value, workspaceSlug, selectedConversationId, selectedCustomerId, selectedRequestId, selectedQuoteId, selectedQualityCaseId, selectedJobId, selectedInvoiceId)
      ) : (
        <Panel>
          <FeedbackBanner
            title={result.kind === "authentication" ? "Staff sign-in required" : "Workspace unavailable"}
            description={result.message}
            tone={result.kind === "authentication" ? "warning" : "danger"}
          />
        </Panel>
      )}
    </>
  );
}
