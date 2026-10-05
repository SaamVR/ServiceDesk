import { redirect } from "next/navigation";
import {
  addOperationalVisitNote,
  applyOperationalManualPayment,
  applyOperationalQualityAction,
  calculateOperationalQuote,
  enqueueInboxReply,
  holdOperationalSlot,
  loadOperationalStaffSnapshot,
  sendOperationalQuote,
  setOperationalChecklistItem,
  toggleInboxHandover,
  transitionOperationalVisit,
  type OperationalActionResult,
  type OperationalAttention,
  type OperationalCustomer,
  type OperationalInvoice,
  type OperationalQuote,
  type OperationalRequest,
  type OperationalStaffSnapshot,
  type OperationalVisit,
} from "./operational-product-runtime";
import { staffModuleConfig, type StaffModule } from "./staff-modules";
import { EmptyState as AppEmptyState, PageHeader, Panel, SectionHeader, StatusBadge } from "@/components/product/PagePrimitives";
import { DataCellStack, DataTable, RowActions } from "@/components/product/DataTable";
import { OperationsToolbar, SplitWorkspace, ToolbarResultCount, WorkspaceList, WorkspaceListItem, WorkspacePane } from "@/components/product/WorkspacePrimitives";
import { FormActions, FormField, FormGrid, FormSection, SelectInput, TextArea, TextInput } from "@/components/product/FormPrimitives";
import { FeedbackBanner } from "@/components/product/FeedbackPrimitives";
import { DispatcherIntelligence } from "@/features/dispatch/DispatcherIntelligence";
import { buildOperationalDispatchIntelligence } from "./dispatch-product-adapter";
import { formatMinorMoney } from "./view-models";
import styles from "./OperationalProductRoute.module.css";

interface OperationalProductRouteProps {
  workspaceSlug: string;
  module: Exclude<StaffModule, "overview">;
  selectedConversationId?: string;
  selectedQualityCaseId?: string;
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

function formatWhen(value?: string) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
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
  const selected =
    data.conversations.find((item) => item.id === selectedConversationId) ?? data.conversations[0];
  if (!selected) {
    return <EmptyState title="Inbox is clear" detail="No customer conversations are stored for this workspace yet." />;
  }

  const customer = data.customers.find((item) => item.id === selected.customerId);
  const request = data.requests.find((item) => item.id === selected.requestId);
  const property = request?.propertyId
    ? data.properties.find((item) => item.id === request.propertyId)
    : undefined;
  const messages = data.messages.filter((item) => item.conversationId === selected.id);

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
    <SplitWorkspace
      ariaLabel="Customer conversations"
      mobileFocus="detail"
      list={
        <WorkspacePane
          title="Conversations"
          description={data.conversations.length + " active thread" + (data.conversations.length === 1 ? "" : "s")}
        >
          <WorkspaceList ariaLabel="Conversation list">
            {data.conversations.map((conversation) => {
              const threadCustomer = data.customers.find((item) => item.id === conversation.customerId);
              return (
                <WorkspaceListItem
                  href={"?conversation=" + encodeURIComponent(conversation.id)}
                  selected={conversation.id === selected.id}
                  ariaLabel={(threadCustomer?.displayName ?? "Customer") + " " + conversation.channel + " conversation"}
                  key={conversation.id}
                >
                  <DataCellStack
                    primary={threadCustomer?.displayName ?? "Customer"}
                    secondary={conversation.channel + " · " + (conversation.handoverActive ? "Human takeover" : "Open")}
                  />
                </WorkspaceListItem>
              );
            })}
          </WorkspaceList>
        </WorkspacePane>
      }
      detail={
        <WorkspacePane
          title={customer?.displayName ?? "Customer conversation"}
          description={selected.channel + " conversation"}
          actions={
            <form action={handover}>
              <input type="hidden" name="conversationId" value={selected.id} />
              <input type="hidden" name="active" value={selected.handoverActive ? "false" : "true"} />
              <button className="app-button-secondary" type="submit">
                {selected.handoverActive ? "Release takeover" : "Take over"}
              </button>
            </form>
          }
        >
          <div className={styles.timeline}>
            {messages.length === 0 ? (
              <AppEmptyState title="No messages yet" description="This conversation does not contain any stored messages." />
            ) : (
              messages.map((message) => (
                <article className={styles.message} key={message.id}>
                  <div>
                    <strong>{message.direction === "INBOUND" ? customer?.displayName ?? "Customer" : message.senderKind}</strong>
                    <p>{message.body ?? "Media message"}</p>
                  </div>
                  <small>
                    {formatWhen(message.createdAt)} · {message.deliveryState ? message.deliveryState.replaceAll("_", " ") : "Received"}
                  </small>
                </article>
              ))
            )}
          </div>

          <form action={reply}>
            <input type="hidden" name="conversationId" value={selected.id} />
            <FormSection
              title="Reply"
              description={replySupported
                ? "Queued messages keep their stored delivery state until the channel reports a later status."
                : "Replies are not available for this conversation channel."}
            >
              <FormField id="reply-body" label="Message" required>
                {({ id, describedBy, invalid }) => (
                  <TextArea
                    id={id}
                    name="body"
                    rows={4}
                    placeholder="Write a customer reply"
                    disabled={!replySupported}
                    required
                    describedBy={describedBy}
                    invalid={invalid}
                  />
                )}
              </FormField>
              <FormActions>
                <button className="app-button-primary" type="submit" disabled={!replySupported}>
                  Queue reply
                </button>
              </FormActions>
            </FormSection>
          </form>
        </WorkspacePane>
      }
      context={
        <WorkspacePane title="Customer context" description={request?.serviceLabel ?? "No request linked"}>
          <dl className="summary-list">
            <div><dt>Request</dt><dd>{request?.status ?? "None"}</dd></div>
            <div><dt>Property</dt><dd>{property?.label ?? "None"}</dd></div>
            <div><dt>Address</dt><dd>{property?.address ?? "Not available"}</dd></div>
            <div><dt>Delivery</dt><dd>Stored per message</dd></div>
          </dl>
        </WorkspacePane>
      }
    />
  );
}

function CustomersView({ data }: { data: OperationalStaffSnapshot }) {
  if (data.customers.length === 0) {
    return (
      <EmptyState
        title="No customers yet"
        detail="Customers will appear here after enquiries are linked to a customer record."
      />
    );
  }

  return (
    <div className={styles.stack}>
      <OperationsToolbar
        context={<ToolbarResultCount count={data.customers.length} label="customers" />}
      />
      <DataTable<OperationalCustomer>
        caption="Customers"
        rows={data.customers}
        getRowKey={(customer) => customer.id}
        columns={[
          {
            id: "customer",
            header: "Customer",
            priority: "primary",
            cell: (customer) => <DataCellStack primary={customer.displayName} secondary={customer.leadSource ?? "Lead source not recorded"} />,
          },
          {
            id: "properties",
            header: "Properties",
            cell: (customer) => data.properties.filter((item) => item.customerId === customer.id).length,
          },
          {
            id: "requests",
            header: "Requests",
            cell: (customer) => data.requests.filter((item) => item.customerId === customer.id).length,
          },
        ]}
        renderMobileRow={(customer) => (
          <DataCellStack
            primary={customer.displayName}
            secondary={
              data.properties.filter((item) => item.customerId === customer.id).length +
              " properties · " +
              data.requests.filter((item) => item.customerId === customer.id).length +
              " requests"
            }
          />
        )}
      />

      {data.customers.slice(0, 8).map((customer) => (
        <Panel key={customer.id}>
          <SectionHeader title={customer.displayName} description="Property context" />
          {data.properties.filter((item) => item.customerId === customer.id).length === 0 ? (
            <AppEmptyState title="No properties" description="No property is linked to this customer yet." />
          ) : (
            <div className="app-row-list">
              {data.properties
                .filter((item) => item.customerId === customer.id)
                .map((property) => (
                  <article className="app-row" key={property.id}>
                    <div>
                      <h3>{property.label}</h3>
                      <p>{property.address || "Address not recorded"}</p>
                      {property.serviceNotes ? <p>Service: {property.serviceNotes}</p> : null}
                    </div>
                    <div className="app-row-meta">
                      <span>{property.accessNotes ? "Access notes saved" : "No access notes"}</span>
                    </div>
                  </article>
                ))}
            </div>
          )}
        </Panel>
      ))}
    </div>
  );
}

function RequestsView({
  data,
  workspaceSlug,
}: {
  data: OperationalStaffSnapshot;
  workspaceSlug: string;
}) {
  async function calculateQuote(formData: FormData) {
    "use server";
    const result = await calculateOperationalQuote(
      workspaceSlug,
      String(formData.get("requestId") ?? ""),
    );
    actionRedirect(workspaceSlug, "requests", result);
  }

  if (data.requests.length === 0) {
    return (
      <EmptyState
        title="No requests in the queue"
        detail="New enquiries will appear here as persisted requests."
      />
    );
  }

  return (
    <div className={styles.stack}>
      <OperationsToolbar
        context={<ToolbarResultCount count={data.requests.length} label="requests" />}
      />
      <DataTable<OperationalRequest>
        caption="Request queue"
        rows={data.requests}
        getRowKey={(request) => request.id}
        columns={[
          {
            id: "service",
            header: "Service",
            priority: "primary",
            cell: (request) => (
              <DataCellStack
                primary={request.serviceLabel}
                secondary={data.customers.find((item) => item.id === request.customerId)?.displayName ?? "Visitor enquiry"}
              />
            ),
          },
          {
            id: "status",
            header: "Status",
            cell: (request) => <StatusBadge tone={statusBadgeTone(request.status)}>{request.status.replaceAll("_", " ")}</StatusBadge>,
          },
          {
            id: "requested",
            header: "Requested",
            cell: (request) => formatWhen(request.requestedStartAt),
          },
          {
            id: "home",
            header: "Home",
            priority: "optional",
            cell: (request) => (request.bedrooms ?? "—") + " bed · " + (request.bathrooms ?? "—") + " bath",
          },
          {
            id: "quote",
            header: "Quote",
            priority: "primary",
            cell: (request) => {
              const currentQuote = data.quotes.find((item) => item.requestId === request.id && item.status !== "SUPERSEDED");
              const canCalculate =
                Boolean(request.serviceCode) &&
                request.bedrooms !== undefined &&
                request.bathrooms !== undefined &&
                !["BOOKED", "LOST", "CLOSED"].includes(request.status);
              return currentQuote ? (
                <DataCellStack primary={currentQuote.status.replaceAll("_", " ")} secondary={"Version " + currentQuote.version} />
              ) : (
                <RowActions label={"Actions for " + request.serviceLabel}>
                  <form action={calculateQuote}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <button className="app-button-secondary" type="submit" disabled={!canCalculate}>
                      Calculate quote
                    </button>
                  </form>
                </RowActions>
              );
            },
          },
        ]}
        renderMobileRow={(request) => (
          <DataCellStack
            primary={request.serviceLabel}
            secondary={request.status.replaceAll("_", " ") + " · " + formatWhen(request.requestedStartAt)}
          />
        )}
      />
    </div>
  );
}

function QuotesView({
  data,
  workspaceSlug,
}: {
  data: OperationalStaffSnapshot;
  workspaceSlug: string;
}) {
  async function sendQuote(formData: FormData) {
    "use server";
    const result = await sendOperationalQuote(
      workspaceSlug,
      String(formData.get("quoteId") ?? ""),
    );
    actionRedirect(workspaceSlug, "quotes", result);
  }

  if (data.quotes.length === 0) {
    return <EmptyState title="No quotes yet" detail="Calculated and saved quotes will appear here." />;
  }

  return (
    <div className={styles.stack}>
      <OperationsToolbar
        context={<ToolbarResultCount count={data.quotes.length} label="quotes" />}
      />
      <DataTable<OperationalQuote>
        caption="Quotes"
        rows={data.quotes}
        getRowKey={(quote) => quote.id}
        columns={[
          {
            id: "request",
            header: "Request",
            priority: "primary",
            cell: (quote) => (
              <DataCellStack
                primary={data.requests.find((item) => item.id === quote.requestId)?.serviceLabel ?? "Request"}
                secondary={"Version " + quote.version}
              />
            ),
          },
          {
            id: "total",
            header: "Total",
            cell: (quote) => formatMinorMoney(quote.totalMinor, quote.currency),
          },
          {
            id: "status",
            header: "Status",
            cell: (quote) => <StatusBadge tone={statusBadgeTone(quote.status)}>{quote.status.replaceAll("_", " ")}</StatusBadge>,
          },
          {
            id: "validity",
            header: "Valid until",
            priority: "optional",
            cell: (quote) => formatWhen(quote.validUntil),
          },
          {
            id: "action",
            header: "Action",
            priority: "primary",
            cell: (quote) => (
              <RowActions label={"Actions for quote " + quote.id}>
                {quote.status === "APPROVED" ? (
                  <form action={sendQuote}>
                    <input type="hidden" name="quoteId" value={quote.id} />
                    <button className="app-button-secondary" type="submit">Send quote</button>
                  </form>
                ) : (
                  <span>{quote.status === "SENT" ? "Awaiting customer" : "No action available"}</span>
                )}
              </RowActions>
            ),
          },
        ]}
        renderMobileRow={(quote) => (
          <DataCellStack
            primary={formatMinorMoney(quote.totalMinor, quote.currency)}
            secondary={quote.status.replaceAll("_", " ") + " · v" + quote.version}
          />
        )}
      />
    </div>
  );
}

function ScheduleView({
  data,
  workspaceSlug,
}: {
  data: OperationalStaffSnapshot;
  workspaceSlug: string;
}) {
  async function holdSlot(formData: FormData) {
    "use server";
    const result = await holdOperationalSlot(
      workspaceSlug,
      String(formData.get("quoteId") ?? ""),
      String(formData.get("slotId") ?? ""),
    );
    actionRedirect(workspaceSlug, "schedule", result);
  }

  const now = Date.now();
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

  return (
    <div className={styles.stack}>
      <DispatcherIntelligence
        recommendations={dispatch.recommendations}
        timeline={dispatch.timeline}
        approvalCommandAvailable={false}
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
              cell: (visit) => formatWhen(visit.startAt),
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
              secondary={formatWhen(visit.startAt) + " · " + visit.status.replaceAll("_", " ")}
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
                  <p>Slot held until {formatWhen(activeHold.expiresAt)}. Payment remains pending.</p>
                ) : candidates.length === 0 ? (
                  <p>No capacity slot currently fits this quote.</p>
                ) : (
                  <div className={styles.actions}>
                    {candidates.slice(0, 5).map((slot) => (
                      <form action={holdSlot} key={slot.id}>
                        <input type="hidden" name="quoteId" value={quote.id} />
                        <input type="hidden" name="slotId" value={slot.id} />
                        <button className="app-button-secondary" type="submit">
                          Hold {formatWhen(slot.startAt)}
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
                  <p>Requested {formatWhen(request.requestedStartAt)}</p>
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
}: {
  data: OperationalStaffSnapshot;
  workspaceSlug: string;
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
    const result = await transitionOperationalVisit(
      workspaceSlug,
      String(formData.get("visitId") ?? ""),
      action,
    );
    actionRedirect(workspaceSlug, "jobs", result);
  }

  async function saveVisitNote(formData: FormData) {
    "use server";
    const kind = String(formData.get("kind") ?? "TIME_MATERIAL_NOTE") === "INCIDENT_NOTE"
      ? "INCIDENT_NOTE"
      : "TIME_MATERIAL_NOTE";
    const result = await addOperationalVisitNote(
      workspaceSlug,
      String(formData.get("visitId") ?? ""),
      kind,
      String(formData.get("note") ?? ""),
    );
    actionRedirect(workspaceSlug, "jobs", result);
  }

  async function saveChecklistItem(formData: FormData) {
    "use server";
    const result = await setOperationalChecklistItem(
      workspaceSlug,
      String(formData.get("visitId") ?? ""),
      String(formData.get("itemKey") ?? ""),
      String(formData.get("completed") ?? "") === "true",
      String(formData.get("note") ?? ""),
    );
    actionRedirect(workspaceSlug, "jobs", result);
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

  return (
    <div className={styles.stack}>
      <OperationsToolbar
        context={<ToolbarResultCount count={data.visits.length} label="jobs" />}
      />
      <DataTable<OperationalVisit>
        caption="Jobs"
        rows={data.visits}
        getRowKey={(visit) => visit.id}
        columns={[
          {
            id: "visit",
            header: "Job",
            priority: "primary",
            cell: (visit) => (
              <DataCellStack
                primary={data.requests.find((item) => item.id === visit.requestId)?.serviceLabel ?? "Visit"}
                secondary={formatWhen(visit.startAt)}
              />
            ),
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
          {
            id: "field",
            header: "Field record",
            priority: "optional",
            cell: (visit) => {
              const evidence = data.visitEvidence.filter((item) => item.visitId === visit.id);
              const checklist = data.visitChecklistItems.filter((item) => item.visitId === visit.id);
              return evidence.length + " evidence · " + checklist.filter((item) => item.completed).length + "/" + checklist.length + " checklist";
            },
          },
          {
            id: "action",
            header: "Next action",
            priority: "primary",
            cell: (visit) => {
              const action = nextAction(visit.status);
              const evidence = data.visitEvidence.filter((item) => item.visitId === visit.id);
              const reviewEvidenceReady =
                evidence.some((item) => item.kind === "BEFORE_PHOTO") &&
                evidence.some((item) => item.kind === "AFTER_PHOTO");
              return action ? (
                <RowActions label={"Actions for job " + visit.id}>
                  <form action={transitionVisit}>
                    <input type="hidden" name="visitId" value={visit.id} />
                    <button
                      className="app-button-secondary"
                      name="action"
                      value={action.action}
                      disabled={
                        (action.action === "ASSIGN" && !visit.crewId) ||
                        (action.action === "SUBMIT_REVIEW" && !reviewEvidenceReady)
                      }
                      title={
                        action.action === "ASSIGN" && !visit.crewId
                          ? "Choose a crew before confirming assignment."
                          : action.action === "SUBMIT_REVIEW" && !reviewEvidenceReady
                            ? "Add both before and after evidence before submitting for review."
                            : undefined
                      }
                    >
                      {action.label}
                    </button>
                  </form>
                </RowActions>
              ) : <span>No lifecycle action</span>;
            },
          },
        ]}
        renderMobileRow={(visit) => (
          <DataCellStack
            primary={data.requests.find((item) => item.id === visit.requestId)?.serviceLabel ?? "Visit"}
            secondary={visit.status.replaceAll("_", " ") + " · " + formatWhen(visit.startAt)}
          />
        )}
      />

      {data.visits
        .filter((visit) => !["COMPLETED", "CANCELLED"].includes(visit.status))
        .slice(0, 6)
        .map((visit) => {
          const evidence = data.visitEvidence.filter((item) => item.visitId === visit.id);
          const checklist = data.visitChecklistItems.filter((item) => item.visitId === visit.id);
          return (
            <Panel key={visit.id}>
              <SectionHeader
                title={data.requests.find((item) => item.id === visit.requestId)?.serviceLabel ?? "Service visit"}
                description={formatWhen(visit.startAt) + " · " + visit.status.replaceAll("_", " ")}
                action={<StatusBadge tone={statusBadgeTone(visit.status)}>{visit.status.replaceAll("_", " ")}</StatusBadge>}
              />

              <div className="app-grid app-grid-two">
                <FormSection
                  title="Field notes"
                  description="Save time, material or incident notes directly to the job record."
                >
                  <form action={saveVisitNote}>
                    <input type="hidden" name="visitId" value={visit.id} />
                    <FormGrid columns={1}>
                      <FormField id={"job-note-kind-" + visit.id} label="Note type">
                        {({ id, describedBy, invalid }) => (
                          <SelectInput id={id} name="kind" defaultValue="TIME_MATERIAL_NOTE" describedBy={describedBy} invalid={invalid}>
                            <option value="TIME_MATERIAL_NOTE">Time / material note</option>
                            <option value="INCIDENT_NOTE">Incident</option>
                          </SelectInput>
                        )}
                      </FormField>
                      <FormField id={"job-note-" + visit.id} label="Note" required>
                        {({ id, describedBy, invalid }) => (
                          <TextArea id={id} name="note" rows={3} required describedBy={describedBy} invalid={invalid} placeholder="Add a field note" />
                        )}
                      </FormField>
                    </FormGrid>
                    <FormActions>
                      <button className="app-button-secondary" type="submit">Save note</button>
                    </FormActions>
                  </form>
                  {evidence.length ? (
                    <div className="app-row-list">
                      {evidence.slice(0, 5).map((item) => (
                        <article className="app-row" key={item.id}>
                          <div>
                            <h3>{item.kind.replaceAll("_", " ")}</h3>
                            <p>{item.text ?? "Photo evidence"}</p>
                          </div>
                          <div className="app-row-meta"><span>{formatWhen(item.capturedAt)}</span></div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <AppEmptyState title="No field evidence yet" description="Before/after photos are added from the authorized crew workflow; staff can record notes here." />
                  )}
                </FormSection>

                <FormSection
                  title="Checklist"
                  description="Record or update a named checklist item for this visit."
                >
                  <form action={saveChecklistItem}>
                    <input type="hidden" name="visitId" value={visit.id} />
                    <input type="hidden" name="completed" value="true" />
                    <FormGrid columns={1}>
                      <FormField id={"checklist-key-" + visit.id} label="Item" required>
                        {({ id, describedBy, invalid }) => (
                          <TextInput id={id} name="itemKey" required describedBy={describedBy} invalid={invalid} placeholder="e.g. kitchen" />
                        )}
                      </FormField>
                      <FormField id={"checklist-note-" + visit.id} label="Note">
                        {({ id, describedBy, invalid }) => (
                          <TextInput id={id} name="note" describedBy={describedBy} invalid={invalid} placeholder="Optional note" />
                        )}
                      </FormField>
                    </FormGrid>
                    <FormActions>
                      <button className="app-button-secondary" type="submit">Mark complete</button>
                    </FormActions>
                  </form>
                  {checklist.length ? (
                    <div className="app-row-list">
                      {checklist.map((item) => (
                        <article className="app-row" key={item.id}>
                          <div><h3>{item.itemKey}</h3><p>{item.note ?? "No note"}</p></div>
                          <StatusBadge tone={item.completed ? "success" : "neutral"}>{item.completed ? "Complete" : "Open"}</StatusBadge>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <AppEmptyState title="No checklist items yet" description="Checklist items saved for this job will appear here." />
                  )}
                </FormSection>
              </div>
            </Panel>
          );
        })}
    </div>
  );
}

function InvoicesView({
  data,
  workspaceSlug,
}: {
  data: OperationalStaffSnapshot;
  workspaceSlug: string;
}) {
  async function manualPayment(formData: FormData) {
    "use server";
    const amount = String(formData.get("amount") ?? "").trim();
    const match = amount.match(/^(\d+)(?:\.(\d{1,2}))?$/);
    if (!match) {
      actionRedirect(workspaceSlug, "invoices", {
        ok: false,
        message: "Enter a valid payment amount.",
      });
    }
    const amountMinor =
      Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
    const methodRaw = String(formData.get("method") ?? "OTHER");
    const method =
      methodRaw === "CASH" || methodRaw === "BANK_TRANSFER" ? methodRaw : "OTHER";
    const result = await applyOperationalManualPayment(
      workspaceSlug,
      String(formData.get("invoiceId") ?? ""),
      amountMinor,
      method,
      String(formData.get("reference") ?? ""),
    );
    actionRedirect(workspaceSlug, "invoices", result);
  }

  if (data.invoices.length === 0) {
    return (
      <EmptyState title="No invoices yet" detail="Invoices will appear after billable visits are created." />
    );
  }

  const outstanding = data.invoices.filter(
    (invoice) => invoice.balanceMinor > 0 && invoice.status !== "VOID",
  );

  return (
    <div className={styles.stack}>
      <OperationsToolbar
        context={<ToolbarResultCount count={data.invoices.length} label="invoices" />}
      />
      <DataTable<OperationalInvoice>
        caption="Invoices"
        rows={data.invoices}
        getRowKey={(invoice) => invoice.id}
        columns={[
          {
            id: "invoice",
            header: "Invoice",
            priority: "primary",
            cell: (invoice) => <DataCellStack primary={invoice.id.slice(0, 8)} secondary={invoice.status.replaceAll("_", " ")} />,
          },
          {
            id: "total",
            header: "Total",
            cell: (invoice) => formatMinorMoney(invoice.totalMinor, invoice.currency),
          },
          {
            id: "paid",
            header: "Paid / allocated",
            cell: (invoice) => formatMinorMoney(invoice.allocatedMinor, invoice.currency),
          },
          {
            id: "balance",
            header: "Balance",
            priority: "primary",
            cell: (invoice) => formatMinorMoney(invoice.balanceMinor, invoice.currency),
          },
          {
            id: "status",
            header: "Status",
            cell: (invoice) => <StatusBadge tone={statusBadgeTone(invoice.status)}>{invoice.status.replaceAll("_", " ")}</StatusBadge>,
          },
        ]}
        renderMobileRow={(invoice) => (
          <DataCellStack
            primary={formatMinorMoney(invoice.balanceMinor, invoice.currency) + " due"}
            secondary={invoice.status.replaceAll("_", " ") + " · invoice " + invoice.id.slice(0, 8)}
          />
        )}
      />

      {outstanding.length ? (
        <Panel>
          <SectionHeader
            title="Record manual payment"
            description="Use this only for payment received outside the online checkout flow."
          />
          <div className="app-grid app-grid-two">
            {outstanding.slice(0, 6).map((invoice) => (
              <FormSection
                key={invoice.id}
                title={formatMinorMoney(invoice.balanceMinor, invoice.currency) + " due"}
                description={"Invoice " + invoice.id.slice(0, 8)}
              >
                <form action={manualPayment}>
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <FormGrid columns={2}>
                    <FormField id={"payment-amount-" + invoice.id} label="Amount" required>
                      {({ id, describedBy, invalid }) => (
                        <TextInput
                          id={id}
                          name="amount"
                          type="text"
                          defaultValue={(invoice.balanceMinor / 100).toFixed(2)}
                          required
                          describedBy={describedBy}
                          invalid={invalid}
                        />
                      )}
                    </FormField>
                    <FormField id={"payment-method-" + invoice.id} label="Method" required>
                      {({ id, describedBy, invalid }) => (
                        <SelectInput
                          id={id}
                          name="method"
                          defaultValue="BANK_TRANSFER"
                          required
                          describedBy={describedBy}
                          invalid={invalid}
                        >
                          <option value="BANK_TRANSFER">Bank transfer</option>
                          <option value="CASH">Cash</option>
                          <option value="OTHER">Other</option>
                        </SelectInput>
                      )}
                    </FormField>
                    <FormField id={"payment-reference-" + invoice.id} label="Reference" required>
                      {({ id, describedBy, invalid }) => (
                        <TextInput
                          id={id}
                          name="reference"
                          placeholder="Bank reference or receipt number"
                          required
                          describedBy={describedBy}
                          invalid={invalid}
                        />
                      )}
                    </FormField>
                  </FormGrid>
                  <FormActions>
                    <button className="app-button-secondary" type="submit">Apply payment</button>
                  </FormActions>
                  <p className="app-field-help">
                    Records an offline/manual payment only. It does not simulate online settlement.
                  </p>
                </form>
              </FormSection>
            ))}
          </div>
        </Panel>
      ) : (
        <Panel>
          <AppEmptyState title="Nothing outstanding" description="There are no invoice balances requiring payment." />
        </Panel>
      )}
    </div>
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
      actionRedirect(workspaceSlug, "quality", {
        ok: false,
        message: "Unsupported quality action.",
      });
    }
    const qualityCaseId = String(formData.get("qualityCaseId") ?? "");
    const result = await applyOperationalQualityAction(
      workspaceSlug,
      qualityCaseId,
      action,
      String(formData.get("resolutionNote") ?? ""),
    );
    actionRedirect(
      workspaceSlug,
      "quality",
      result,
      "case=" + encodeURIComponent(qualityCaseId) + "&",
    );
  }

  if (data.qualityCases.length === 0) {
    return (
      <EmptyState
        title="No quality cases"
        detail="Customer feedback that requires operational review will appear here."
      />
    );
  }

  const selected =
    data.qualityCases.find((qualityCase) => qualityCase.id === selectedQualityCaseId) ??
    data.qualityCases[0];
  const visit = data.visits.find((item) => item.id === selected.visitId);
  const evidence = data.visitEvidence.filter((item) => item.visitId === selected.visitId);

  const actions = (
    <form action={qualityAction}>
      <input type="hidden" name="qualityCaseId" value={selected.id} />
      <RowActions label="Quality case actions">
        {selected.state === "OPEN" ? (
          <>
            <button className="app-button-secondary" name="action" value="ASSIGN">Assign to me</button>
            <button className="app-button-secondary" name="action" value="START_REVIEW">Start review</button>
          </>
        ) : null}
        {selected.state === "RESOLVED" && selected.reviewRequestState === "ELIGIBLE" ? (
          <button className="app-button-secondary" name="action" value="REQUEST_REVIEW">Request customer review</button>
        ) : null}
      </RowActions>
    </form>
  );

  return (
    <SplitWorkspace
      ariaLabel="Quality review workspace"
      mobileFocus="detail"
      list={
        <WorkspacePane
          title="Quality queue"
          description={data.qualityCases.length + " case" + (data.qualityCases.length === 1 ? "" : "s")}
        >
          <WorkspaceList ariaLabel="Quality cases">
            {data.qualityCases.map((qualityCase) => (
              <WorkspaceListItem
                key={qualityCase.id}
                href={"?case=" + encodeURIComponent(qualityCase.id)}
                selected={qualityCase.id === selected.id}
                ariaLabel={qualityCase.summary}
              >
                <DataCellStack
                  primary={qualityCase.summary}
                  secondary={qualityCase.state.replaceAll("_", " ") + " · " + formatWhen(qualityCase.dueAt)}
                />
              </WorkspaceListItem>
            ))}
          </WorkspaceList>
        </WorkspacePane>
      }
      detail={
        <WorkspacePane
          title={selected.summary}
          description={"Quality case · " + selected.state.replaceAll("_", " ")}
          actions={actions}
        >
          <div className="app-grid app-grid-two">
            <dl className="summary-list">
              <div><dt>Visit</dt><dd>{visit ? formatWhen(visit.startAt) : "Visit unavailable"}</dd></div>
              <div><dt>Score</dt><dd>{selected.feedbackScore ?? "Not scored"}</dd></div>
              <div><dt>Deadline</dt><dd>{formatWhen(selected.dueAt)}</dd></div>
              <div><dt>Review request</dt><dd>{selected.reviewRequestState.replaceAll("_", " ")}</dd></div>
              <div><dt>Owner</dt><dd>{selected.ownerUserId ? "Assigned" : "Unassigned"}</dd></div>
            </dl>
            <div>
              <h3>Field evidence</h3>
              {evidence.length ? (
                <div className="app-row-list">
                  {evidence.map((item) => (
                    <article className="app-row" key={item.id}>
                      <div><strong>{item.kind.replaceAll("_", " ")}</strong><p>{item.text ?? "Photo evidence"}</p></div>
                      <span>{formatWhen(item.capturedAt)}</span>
                    </article>
                  ))}
                </div>
              ) : (
                <AppEmptyState title="No evidence recorded" description="No field evidence is currently linked to this visit." />
              )}
            </div>
          </div>

          {selected.state === "IN_REVIEW" ? (
            <form action={qualityAction}>
              <input type="hidden" name="qualityCaseId" value={selected.id} />
              <FormSection title="Resolve case" description="Record the resolution before closing this quality issue.">
                <FormField id={"quality-resolution-" + selected.id} label="Resolution note" required>
                  {({ id, describedBy, invalid }) => (
                    <TextArea
                      id={id}
                      name="resolutionNote"
                      rows={4}
                      required
                      describedBy={describedBy}
                      invalid={invalid}
                      placeholder="Describe what was resolved"
                    />
                  )}
                </FormField>
                <FormActions>
                  <button className="app-button-primary" name="action" value="RESOLVE">Resolve case</button>
                </FormActions>
              </FormSection>
            </form>
          ) : null}
        </WorkspacePane>
      }
      context={
        <WorkspacePane title="Visit context" description={visit?.status.replaceAll("_", " ") ?? "Visit unavailable"}>
          {visit ? (
            <dl className="summary-list">
              <div><dt>Start</dt><dd>{formatWhen(visit.startAt)}</dd></div>
              <div><dt>Crew</dt><dd>{visit.crewId ? data.crews.find((crew) => crew.id === visit.crewId)?.name ?? "Assigned" : "Unassigned"}</dd></div>
              <div><dt>Evidence</dt><dd>{evidence.length}</dd></div>
            </dl>
          ) : (
            <AppEmptyState title="Visit unavailable" description="The linked visit could not be found in the current workspace data." />
          )}
        </WorkspacePane>
      }
    />
  );
}

function AutomationsView({ data }: { data: OperationalStaffSnapshot }) {
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
            cell: (item) => formatWhen(item.dueAt),
          },
          {
            id: "action",
            header: "Action",
            priority: "primary",
            cell: () => (
              <button
                className="app-button-secondary"
                type="button"
                disabled
                title="Recovery must be handled manually from the related record."
              >
                Open related record
              </button>
            ),
          },
        ]}
        renderMobileRow={(item) => (
          <DataCellStack primary={item.summary} secondary={item.severity + " · " + item.resourceType} />
        )}
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
  const conversion =
    snapshot.conversionRateBps === undefined
      ? "—"
      : (snapshot.conversionRateBps / 100).toFixed(1) + "%";
  const currency = snapshot.currency ?? "USD";

  return (
    <div className={styles.stack}>
      <MetricStrip
        items={[
          { label: "Requests", value: snapshot.requestCount, detail: "In selected reporting period" },
          { label: "Booked", value: snapshot.bookedRequestCount, detail: "Persisted booked requests" },
          { label: "Conversion", value: conversion, detail: "Stored reporting metric" },
          { label: "Collected", value: formatMinorMoney(snapshot.collectedMinor, currency), detail: "Allocated collections" },
          { label: "Outstanding", value: formatMinorMoney(snapshot.outstandingMinor, currency), detail: "Open customer balances", tone: snapshot.outstandingMinor > 0 ? "attention" : "default" },
        ]}
      />
      <Panel>
        <SectionHeader
          title="Operations"
          description={(snapshot.from ? formatWhen(snapshot.from) : "Rolling period") + " – " + (snapshot.to ? formatWhen(snapshot.to) : "Now")}
        />
        <div className="app-grid app-grid-two">
          <div className="app-row-list">
            <article className="app-row"><div><h3>Scheduled service</h3><p>{Math.round(snapshot.scheduledServiceMinutes / 60)} hours</p></div></article>
            <article className="app-row"><div><h3>Scheduled buffer</h3><p>{Math.round(snapshot.scheduledBufferMinutes / 60)} hours</p></div></article>
          </div>
          <div className="app-row-list">
            <article className="app-row"><div><h3>Open attention</h3><p>{snapshot.openAttentionCount}</p></div></article>
            <article className="app-row"><div><h3>Unresolved quality</h3><p>{snapshot.unresolvedQualityCount}</p></div></article>
          </div>
        </div>
        <p className="app-field-help">Updated {formatWhen(snapshot.generatedAt)}.</p>
      </Panel>
    </div>
  );
}

function BillingView({ data }: { data: OperationalStaffSnapshot }) {
  const snapshot = data.platformBilling;
  if (!snapshot) {
    return <EmptyState title="Platform billing unavailable" detail="Subscription information is temporarily unavailable." />;
  }
  const subscription = snapshot.subscription;
  return (
    <div className={styles.stack}>
      <Panel>
        <SectionHeader
          title={subscription.plan + " · " + subscription.status.replaceAll("_", " ")}
          description="ServiceDesk subscription"
          action={
            <StatusBadge tone={subscription.providerMode === "SANDBOX" ? "warning" : statusBadgeTone(subscription.status)}>
              {subscription.providerMode === "SANDBOX" ? "Sandbox billing" : "Live billing"}
            </StatusBadge>
          }
        />
        {subscription.providerMode === "SANDBOX" ? (
          <FeedbackBanner
            title="Sandbox platform billing"
            description="Platform subscription billing is not a live charge in this mode."
            tone="warning"
          />
        ) : null}
        <dl className="summary-list">
          <div><dt>Trial ends</dt><dd>{formatWhen(subscription.trialEndsAt)}</dd></div>
          <div><dt>Current period ends</dt><dd>{formatWhen(subscription.currentPeriodEndsAt)}</dd></div>
        </dl>
      </Panel>

      <Panel>
        <SectionHeader title="Usage" description="Current platform usage and limits." />
        <div className="app-row-list">
          {snapshot.usage.map((row) => (
            <article className="app-row" key={row.metric}>
              <div>
                <h3>{row.metric.replaceAll("_", " ").toLowerCase()}</h3>
                <p>{row.used} used · {row.limit ?? "Unlimited"} limit</p>
              </div>
              <StatusBadge tone={row.state === "LIMIT_REACHED" ? "warning" : "neutral"}>
                {row.state.replaceAll("_", " ")}
              </StatusBadge>
            </article>
          ))}
        </div>
      </Panel>

      <Panel>
        <SectionHeader title="Customer payments are separate" />
        <p>
          Cleaning invoices and customer payment balances stay in Invoices. They do not change the
          ServiceDesk subscription shown here.
        </p>
      </Panel>
    </div>
  );
}

function SettingsView({ data }: { data: OperationalStaffSnapshot }) {
  const snapshot = data.ownerSettings;
  if (!snapshot) {
    return <EmptyState title="Settings unavailable" detail="Workspace settings are temporarily unavailable." />;
  }
  return (
    <div className={styles.stack}>
      <Panel>
        <SectionHeader title="Service catalog" description="Services currently available to this workspace." />
        <div className="app-row-list">
          {snapshot.services.map((service) => (
            <article className="app-row" key={service.code}>
              <div><h3>{service.label}</h3><p>{service.code}</p></div>
              <StatusBadge tone={service.enabled ? "success" : "neutral"}>{service.enabled ? "Enabled" : "Disabled"}</StatusBadge>
            </article>
          ))}
        </div>
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
                <div><h3>{invite.role}</h3><p>Created {formatWhen(invite.createdAt)}</p></div>
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
        <SectionHeader title="Integrations" description="Connection health requires a dedicated workspace integration-status read." />
        <button className="app-button-secondary" type="button" disabled title="Integration status is not part of the current settings read.">
          Manage integrations
        </button>
      </Panel>
    </div>
  );
}

function renderModule(
  module: OperationalProductRouteProps["module"],
  data: OperationalStaffSnapshot,
  workspaceSlug: string,
  selectedConversationId?: string,
  selectedQualityCaseId?: string,
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
      return <CustomersView data={data} />;
    case "requests":
      return <RequestsView data={data} workspaceSlug={workspaceSlug} />;
    case "quotes":
      return <QuotesView data={data} workspaceSlug={workspaceSlug} />;
    case "schedule":
      return <ScheduleView data={data} workspaceSlug={workspaceSlug} />;
    case "jobs":
      return <JobsView data={data} workspaceSlug={workspaceSlug} />;
    case "invoices":
      return <InvoicesView data={data} workspaceSlug={workspaceSlug} />;
    case "quality":
      return <QualityView data={data} workspaceSlug={workspaceSlug} selectedQualityCaseId={selectedQualityCaseId} />;
    case "automations":
      return <AutomationsView data={data} />;
    case "reports":
      return <ReportsView data={data} />;
    case "billing":
      return <BillingView data={data} />;
    case "settings":
      return <SettingsView data={data} />;
  }
}

export async function OperationalProductRoute({
  workspaceSlug,
  module,
  selectedConversationId,
  selectedQualityCaseId,
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
        renderModule(module, result.value, workspaceSlug, selectedConversationId, selectedQualityCaseId)
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
