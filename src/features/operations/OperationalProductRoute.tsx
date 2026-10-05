import { redirect } from "next/navigation";
import {
  applyOperationalManualPayment,
  applyOperationalQualityAction,
  calculateOperationalQuote,
  enqueueInboxReply,
  holdOperationalSlot,
  loadOperationalStaffSnapshot,
  sendOperationalQuote,
  toggleInboxHandover,
  transitionOperationalVisit,
  type OperationalActionResult,
  type OperationalStaffSnapshot,
} from "./operational-product-runtime";
import { buildStaffModuleHref, staffModuleConfig, staffNavigationGroups, type StaffModule } from "./staff-modules";
import { formatMinorMoney } from "./view-models";
import styles from "./OperationalProductRoute.module.css";

interface OperationalProductRouteProps {
  workspaceSlug: string;
  module: Exclude<StaffModule, "overview">;
  selectedConversationId?: string;
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

function statusTone(status: string) {
  if (["PAID", "COMPLETED", "RESOLVED", "DELIVERED", "READ", "CONNECTED", "ACTIVE"].includes(status)) {
    return "success";
  }
  if (["FAILED", "PAYMENT_REVIEW", "BLOCKED", "REAUTH_REQUIRED", "VOID"].includes(status)) {
    return "attention";
  }
  return "pending";
}

function StaffNavigation({ workspaceSlug, module }: { workspaceSlug: string; module: StaffModule }) {
  return (
    <nav className="site-nav grouped" aria-label="Workspace navigation">
      {staffNavigationGroups.map((group) => (
        <div className="nav-group" key={group.label}>
          <span>{group.label}</span>
          {group.modules.map((item) => (
            <a
              href={buildStaffModuleHref(workspaceSlug, item)}
              aria-current={item === module ? "page" : undefined}
              key={item}
            >
              {staffModuleConfig[item].label}
            </a>
          ))}
        </div>
      ))}
    </nav>
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

function Notice({ notice, error }: { notice?: string; error?: string }) {
  if (!notice && !error) return null;
  return (
    <p className={error ? styles.errorNotice : styles.successNotice} role="status">
      {error ?? notice}
    </p>
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
    <div className={styles.inboxGrid}>
      <aside className={styles.threadList}>
        <p className="label">Conversations</p>
        {data.conversations.map((conversation) => {
          const threadCustomer = data.customers.find((item) => item.id === conversation.customerId);
          return (
            <a
              className={conversation.id === selected.id ? styles.activeThread : styles.thread}
              href={"?conversation=" + encodeURIComponent(conversation.id)}
              key={conversation.id}
            >
              <strong>{threadCustomer?.displayName ?? "Customer"}</strong>
              <span>
                {conversation.channel} · {conversation.handoverActive ? "Human takeover" : "Open"}
              </span>
            </a>
          );
        })}
      </aside>

      <section className={styles.conversation}>
        <div className={styles.sectionHeader}>
          <div>
            <p className="label">{selected.channel} conversation</p>
            <h2>{customer?.displayName ?? "Customer conversation"}</h2>
          </div>
          <span className={"status-pill " + (selected.handoverActive ? "attention" : "neutral")}>
            {selected.handoverActive ? "Human takeover active" : "Shared inbox"}
          </span>
        </div>

        <div className={styles.timeline}>
          {messages.length === 0 ? (
            <p>No messages are stored in this conversation yet.</p>
          ) : (
            messages.map((message) => (
              <article className={styles.message} key={message.id}>
                <div>
                  <strong>
                    {message.direction === "INBOUND"
                      ? customer?.displayName ?? "Customer"
                      : message.senderKind}
                  </strong>
                  <p>{message.body ?? "Media message"}</p>
                </div>
                <small>
                  {formatWhen(message.createdAt)} ·{" "}
                  {message.deliveryState
                    ? message.deliveryState.replaceAll("_", " ")
                    : "Received"}
                </small>
              </article>
            ))
          )}
        </div>

        <div className={styles.actions}>
          <form action={handover}>
            <input type="hidden" name="conversationId" value={selected.id} />
            <input
              type="hidden"
              name="active"
              value={selected.handoverActive ? "false" : "true"}
            />
            <button className="button-secondary" type="submit">
              {selected.handoverActive ? "Release takeover" : "Take over conversation"}
            </button>
          </form>
        </div>

        <form action={reply} className={styles.replyForm}>
          <input type="hidden" name="conversationId" value={selected.id} />
          <label htmlFor="reply-body">Reply</label>
          <textarea
            id="reply-body"
            name="body"
            rows={4}
            placeholder="Write a customer reply"
            disabled={!replySupported}
            required
          />
          <button className="button-primary" type="submit" disabled={!replySupported}>
            Queue reply
          </button>
          <p className="form-note">
            {replySupported
              ? "The message is queued for sending. Queued does not mean delivered; the delivery status updates when the channel reports it."
              : "Replies are not available for this conversation channel."}
          </p>
        </form>
      </section>

      <aside className={styles.context}>
        <p className="label">Customer context</p>
        <h3>{request?.serviceLabel ?? "No request linked"}</h3>
        <dl className="summary-list">
          <div>
            <dt>Request</dt>
            <dd>{request?.status ?? "None"}</dd>
          </div>
          <div>
            <dt>Property</dt>
            <dd>{property?.label ?? "None"}</dd>
          </div>
          <div>
            <dt>Address</dt>
            <dd>{property?.address ?? "Not available"}</dd>
          </div>
          <div>
            <dt>Delivery</dt>
            <dd>Each message retains its stored delivery state</dd>
          </div>
        </dl>
      </aside>
    </div>
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
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Properties</th>
              <th>Requests</th>
              <th>Lead source</th>
            </tr>
          </thead>
          <tbody>
            {data.customers.map((customer) => (
              <tr key={customer.id}>
                <td>
                  <strong>{customer.displayName}</strong>
                </td>
                <td>{data.properties.filter((item) => item.customerId === customer.id).length}</td>
                <td>{data.requests.filter((item) => item.customerId === customer.id).length}</td>
                <td>{customer.leadSource ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.customers.slice(0, 8).map((customer) => (
        <section className="plain-card" key={customer.id}>
          <h3>{customer.displayName}</h3>
          {data.properties
            .filter((item) => item.customerId === customer.id)
            .map((property) => (
              <div key={property.id}>
                <p>
                  <strong>{property.label}</strong> · {property.address}
                </p>
                {property.accessNotes && <p>Access: {property.accessNotes}</p>}
                {property.serviceNotes && <p>Service notes: {property.serviceNotes}</p>}
              </div>
            ))}
        </section>
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
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Service</th>
            <th>Customer</th>
            <th>Status</th>
            <th>Requested</th>
            <th>Home</th>
            <th>Quote</th>
          </tr>
        </thead>
        <tbody>
          {data.requests.map((request) => {
            const customer = data.customers.find((item) => item.id === request.customerId);
            const currentQuote = data.quotes.find((item) => item.requestId === request.id && item.status !== "SUPERSEDED");
            const canCalculate =
              Boolean(request.serviceCode) &&
              request.bedrooms !== undefined &&
              request.bathrooms !== undefined &&
              !["BOOKED", "LOST", "CLOSED"].includes(request.status);
            return (
              <tr key={request.id}>
                <td>
                  <strong>{request.serviceLabel}</strong>
                </td>
                <td>{customer?.displayName ?? "Visitor enquiry"}</td>
                <td>
                  <span className={"status-pill " + statusTone(request.status)}>
                    {request.status.replaceAll("_", " ")}
                  </span>
                </td>
                <td>{formatWhen(request.requestedStartAt)}</td>
                <td>
                  {request.bedrooms ?? "—"} bed · {request.bathrooms ?? "—"} bath
                </td>
                <td>
                  {currentQuote ? (
                    <span>{currentQuote.status.replaceAll("_", " ")} · v{currentQuote.version}</span>
                  ) : (
                    <form action={calculateQuote}>
                      <input type="hidden" name="requestId" value={request.id} />
                      <button className="button-secondary" type="submit" disabled={!canCalculate}>
                        Calculate quote
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
    return <EmptyState title="No quotes yet" detail="Calculated and persisted quotes will appear here." />;
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Request</th>
            <th>Version</th>
            <th>Total</th>
            <th>Status</th>
            <th>Validity</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {data.quotes.map((quote) => (
            <tr key={quote.id}>
              <td>
                {data.requests.find((item) => item.id === quote.requestId)?.serviceLabel ??
                  "Request"}
              </td>
              <td>v{quote.version}</td>
              <td>{formatMinorMoney(quote.totalMinor, quote.currency)}</td>
              <td>
                <span className={"status-pill " + statusTone(quote.status)}>
                  {quote.status.replaceAll("_", " ")}
                </span>
              </td>
              <td>{formatWhen(quote.validUntil)}</td>
              <td>
                {quote.status === "APPROVED" ? (
                  <form action={sendQuote}>
                    <input type="hidden" name="quoteId" value={quote.id} />
                    <button className="button-secondary" type="submit">
                      Send quote
                    </button>
                  </form>
                ) : (
                  <span>{quote.status === "SENT" ? "Awaiting customer" : "No staff action"}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
  const acceptedQuotes = data.quotes.filter((quote) => quote.status === "ACCEPTED");

  return (
    <div className={styles.stack}>
      <section className="plain-card">
        <div className={styles.sectionHeader}>
          <div>
            <p className="label">Next 7 days</p>
            <h2>{upcoming.length} scheduled visits</h2>
          </div>
          <span className="status-pill neutral">{unscheduled.length} unscheduled</span>
        </div>
        {upcoming.length === 0 ? (
          <p>No visits are scheduled in the next seven days.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Start</th><th>Service</th><th>Crew</th><th>Status</th></tr>
              </thead>
              <tbody>
                {upcoming.map((visit) => (
                  <tr key={visit.id}>
                    <td>{formatWhen(visit.startAt)}</td>
                    <td>{data.requests.find((item) => item.id === visit.requestId)?.serviceLabel ?? "Visit"}</td>
                    <td>{visit.crewId ? "Assigned" : "Unassigned"}</td>
                    <td>{visit.status.replaceAll("_", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="plain-card">
        <h2>Accepted quotes awaiting booking</h2>
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
            const candidates = data.capacitySlots.filter(
              (slot) => slot.capacityMinutes >= quote.durationMinutes,
            );
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
                        <button className="button-secondary" type="submit">
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
        <p className="form-note">
          ServiceDesk rechecks availability when you hold a slot. Holding a slot does not create
          a payment or a confirmed visit.
        </p>
      </section>

      <section className="plain-card">
        <h2>Unscheduled work</h2>
        {unscheduled.length === 0 ? (
          <p>No open requests are waiting for a visit.</p>
        ) : (
          unscheduled.slice(0, 20).map((request) => (
            <p key={request.id}>
              <strong>{request.serviceLabel}</strong> · {request.status.replaceAll("_", " ")} ·
              requested {formatWhen(request.requestedStartAt)}
            </p>
          ))
        )}
      </section>
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
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Start</th>
            <th>Service</th>
            <th>Crew</th>
            <th>Status</th>
            <th>Evidence</th>
            <th>Next action</th>
          </tr>
        </thead>
        <tbody>
          {data.visits.map((visit) => {
            const action = nextAction(visit.status);
            const evidence = data.visitEvidence.filter((item) => item.visitId === visit.id);
            return (
              <tr key={visit.id}>
                <td>{formatWhen(visit.startAt)}</td>
                <td>{data.requests.find((item) => item.id === visit.requestId)?.serviceLabel ?? "Visit"}</td>
                <td>{visit.crewId ? "Assigned" : "Unassigned"}</td>
                <td>
                  <span className={"status-pill " + statusTone(visit.status)}>
                    {visit.status.replaceAll("_", " ")}
                  </span>
                </td>
                <td>{evidence.length} item{evidence.length === 1 ? "" : "s"}</td>
                <td>
                  {action ? (
                    <form action={transitionVisit}>
                      <input type="hidden" name="visitId" value={visit.id} />
                      <button
                        className="button-secondary"
                        name="action"
                        value={action.action}
                        disabled={action.action === "ASSIGN" && !visit.crewId}
                        title={action.action === "SUBMIT_REVIEW" && evidence.length < 2 ? "Before and after evidence is required by the server before review." : undefined}
                      >
                        {action.label}
                      </button>
                    </form>
                  ) : (
                    <span>No lifecycle action</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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

  return (
    <div className={styles.stack}>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Total</th>
              <th>Paid / allocated</th>
              <th>Balance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td>{invoice.id.slice(0, 8)}</td>
                <td>{formatMinorMoney(invoice.totalMinor, invoice.currency)}</td>
                <td>{formatMinorMoney(invoice.allocatedMinor, invoice.currency)}</td>
                <td>{formatMinorMoney(invoice.balanceMinor, invoice.currency)}</td>
                <td>
                  <span className={"status-pill " + statusTone(invoice.status)}>
                    {invoice.status.replaceAll("_", " ")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.invoices
        .filter((invoice) => invoice.balanceMinor > 0 && invoice.status !== "VOID")
        .slice(0, 6)
        .map((invoice) => (
          <form action={manualPayment} className="plain-card" key={invoice.id}>
            <h3>
              Record manual payment · {formatMinorMoney(invoice.balanceMinor, invoice.currency)} due
            </h3>
            <input type="hidden" name="invoiceId" value={invoice.id} />
            <div className={styles.formGrid}>
              <label>
                Amount
                <input
                  name="amount"
                  inputMode="decimal"
                  defaultValue={(invoice.balanceMinor / 100).toFixed(2)}
                  required
                />
              </label>
              <label>
                Method
                <select name="method" defaultValue="BANK_TRANSFER">
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
              <label>
                Reference
                <input name="reference" placeholder="Bank reference or receipt number" required />
              </label>
            </div>
            <button className="button-secondary" type="submit">
              Apply payment
            </button>
            <p className="form-note">
              This records an offline/manual payment only. It does not simulate Stripe or provider
              settlement.
            </p>
          </form>
        ))}
    </div>
  );
}

function QualityView({
  data,
  workspaceSlug,
}: {
  data: OperationalStaffSnapshot;
  workspaceSlug: string;
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
    const result = await applyOperationalQualityAction(
      workspaceSlug,
      String(formData.get("qualityCaseId") ?? ""),
      action,
      String(formData.get("resolutionNote") ?? ""),
    );
    actionRedirect(workspaceSlug, "quality", result);
  }

  if (data.qualityCases.length === 0) {
    return (
      <EmptyState
        title="No quality cases"
        detail="Customer feedback that requires operational review will appear here."
      />
    );
  }

  return (
    <div className={styles.stack}>
      {data.qualityCases.map((qualityCase) => {
        const visit = data.visits.find((item) => item.id === qualityCase.visitId);
        return (
          <section className="plain-card" key={qualityCase.id}>
            <div className={styles.sectionHeader}>
              <div>
                <p className="label">Quality case</p>
                <h2>{qualityCase.summary}</h2>
              </div>
              <span className={"status-pill " + statusTone(qualityCase.state)}>
                {qualityCase.state.replaceAll("_", " ")}
              </span>
            </div>
            <dl className="summary-list">
              <div>
                <dt>Visit</dt>
                <dd>{visit ? formatWhen(visit.startAt) : "Visit unavailable"}</dd>
              </div>
              <div>
                <dt>Score</dt>
                <dd>{qualityCase.feedbackScore ?? "Not scored"}</dd>
              </div>
              <div>
                <dt>Deadline</dt>
                <dd>{formatWhen(qualityCase.dueAt)}</dd>
              </div>
              <div>
                <dt>Review request</dt>
                <dd>{qualityCase.reviewRequestState.replaceAll("_", " ")}</dd>
              </div>
            </dl>

            <form action={qualityAction} className={styles.actions}>
              <input type="hidden" name="qualityCaseId" value={qualityCase.id} />
              {qualityCase.state === "OPEN" && (
                <>
                  <button className="button-secondary" name="action" value="ASSIGN">
                    Assign to me
                  </button>
                  <button className="button-secondary" name="action" value="START_REVIEW">
                    Start review
                  </button>
                </>
              )}
              {qualityCase.state === "IN_REVIEW" && (
                <>
                  <input name="resolutionNote" placeholder="Resolution note" required />
                  <button className="button-primary" name="action" value="RESOLVE">
                    Resolve case
                  </button>
                </>
              )}
              {qualityCase.state === "RESOLVED" &&
                qualityCase.reviewRequestState === "ELIGIBLE" && (
                  <button className="button-secondary" name="action" value="REQUEST_REVIEW">
                    Request customer review
                  </button>
                )}
            </form>
          </section>
        );
      })}
    </div>
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
      {data.attentionItems.map((item) => (
        <section className="plain-card" key={item.id}>
          <div className={styles.sectionHeader}>
            <div>
              <p className="label">{item.type.replaceAll("_", " ")}</p>
              <h3>{item.summary}</h3>
            </div>
            <span
              className={
                "status-pill " +
                statusTone(item.severity === "CRITICAL" ? "FAILED" : "PENDING")
              }
            >
              {item.severity}
            </span>
          </div>
          <dl className="summary-list">
            <div>
              <dt>Resource</dt>
              <dd>{item.resourceType}</dd>
            </div>
            <div>
              <dt>Owner</dt>
              <dd>{item.ownerUserId ? "Assigned" : "Unassigned"}</dd>
            </div>
            <div>
              <dt>Due</dt>
              <dd>{formatWhen(item.dueAt)}</dd>
            </div>
          </dl>
          <button
            className="button-secondary"
            type="button"
            disabled
            title="Recovery must be handled manually from the related record."
          >
            Run recovery
          </button>
        </section>
      ))}
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
  const cards = [
    ["Requests", String(snapshot.requestCount)],
    ["Booked", String(snapshot.bookedRequestCount)],
    ["Conversion", conversion],
    ["Collected", formatMinorMoney(snapshot.collectedMinor, currency)],
    ["Outstanding", formatMinorMoney(snapshot.outstandingMinor, currency)],
    ["Scheduled service", Math.round(snapshot.scheduledServiceMinutes / 60) + "h"],
    ["Open attention", String(snapshot.openAttentionCount)],
    ["Quality cases", String(snapshot.unresolvedQualityCount)],
  ];
  return (
    <div className={styles.stack}>
      <section className="plain-card">
        <div className={styles.sectionHeader}>
          <div>
            <p className="label">Performance</p>
            <h2>Business activity</h2>
          </div>
          <span className="status-pill neutral">
            {snapshot.from ? formatWhen(snapshot.from) : "Rolling period"} – {snapshot.to ? formatWhen(snapshot.to) : "Now"}
          </span>
        </div>
        <div className="metric-grid">
          {cards.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </div>
        <p className="form-note">Updated {formatWhen(snapshot.generatedAt)}.</p>
      </section>
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
      <section className="plain-card">
        <div className={styles.sectionHeader}>
          <div>
            <p className="label">ServiceDesk subscription</p>
            <h2>{subscription.plan} · {subscription.status.replaceAll("_", " ")}</h2>
          </div>
          <span className={"status-pill " + statusTone(subscription.status)}>
            {subscription.providerMode === "SANDBOX" ? "Sandbox billing" : "Live billing"}
          </span>
        </div>
        {subscription.providerMode === "SANDBOX" && (
          <p>Platform subscription billing is running in sandbox mode and does not represent a live charge.</p>
        )}
        <dl className="summary-list">
          <div><dt>Trial ends</dt><dd>{formatWhen(subscription.trialEndsAt)}</dd></div>
          <div><dt>Current period ends</dt><dd>{formatWhen(subscription.currentPeriodEndsAt)}</dd></div>
        </dl>
      </section>
      <section className="plain-card">
        <h2>Usage</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Metric</th><th>Used</th><th>Limit</th><th>Status</th></tr></thead>
            <tbody>
              {snapshot.usage.map((row) => (
                <tr key={row.metric}>
                  <td>{row.metric.replaceAll("_", " ").toLowerCase()}</td>
                  <td>{row.used}</td>
                  <td>{row.limit ?? "Unlimited"}</td>
                  <td>{row.state.replaceAll("_", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="plain-card">
        <h2>Customer payments are separate</h2>
        <p>
          Cleaning invoices and customer payment balances stay in Invoices. They do not change the
          ServiceDesk subscription shown here.
        </p>
      </section>
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
      <section className="plain-card">
        <h2>Service catalog</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Service</th><th>Code</th><th>Status</th></tr></thead>
            <tbody>
              {snapshot.services.map((service) => (
                <tr key={service.code}>
                  <td><strong>{service.label}</strong></td>
                  <td>{service.code}</td>
                  <td>{service.enabled ? "Enabled" : "Disabled"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="plain-card">
        <h2>Team</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Member</th><th>Role</th><th>Status</th></tr></thead>
            <tbody>
              {snapshot.members.map((member) => (
                <tr key={member.userId}>
                  <td>{member.userId.slice(0, 8)}…</td>
                  <td>{member.role}</td>
                  <td>{member.active ? "Active" : "Inactive"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="plain-card">
        <div className={styles.sectionHeader}>
          <div><p className="label">Invitations</p><h2>{snapshot.invitations.filter((invite) => invite.state === "PENDING").length} pending</h2></div>
        </div>
        {snapshot.invitations.length === 0 ? <p>No invitations.</p> : snapshot.invitations.map((invite) => (
          <p key={invite.id}>{invite.role} · {invite.state.replaceAll("_", " ")} · created {formatWhen(invite.createdAt)}</p>
        ))}
        <p className="form-note">Invitation links and tokens are never displayed here.</p>
      </section>
      <section className="plain-card">
        <h2>Integrations</h2>
        <p>Connection status is not available from this settings read yet. Provider credentials remain private.</p>
        <button className="button-secondary" type="button" disabled title="Integration settings require a workspace integration-status read.">
          Manage integrations
        </button>
      </section>
    </div>
  );
}

function renderModule(
  module: OperationalProductRouteProps["module"],
  data: OperationalStaffSnapshot,
  workspaceSlug: string,
  selectedConversationId?: string,
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
      return <QualityView data={data} workspaceSlug={workspaceSlug} />;
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
  notice,
  error,
}: OperationalProductRouteProps) {
  const result = await loadOperationalStaffSnapshot(workspaceSlug);
  const config = staffModuleConfig[module];

  return (
    <main className="site-shell">
      <header className="site-header" aria-label="Staff workspace navigation">
        <a className="brand-lockup" href="/">
          <span className="brand-mark" aria-hidden="true">
            SD
          </span>
          <span>{result.ok ? result.value.workspace.name : workspaceSlug}</span>
        </a>
        <StaffNavigation workspaceSlug={workspaceSlug} module={module} />
      </header>

      <section className="section-card">
        <div className="section-heading compact">
          <p className="eyebrow">{config.group} · live workspace</p>
          <h1>{config.label}</h1>
          <p className="lead">{config.description}</p>
        </div>

        <Notice notice={notice} error={error} />

        {result.ok ? (
          renderModule(module, result.value, workspaceSlug, selectedConversationId)
        ) : (
          <section className="plain-card">
            <span className="status-pill attention">
              {result.kind.replaceAll("_", " ")}
            </span>
            <h2>
              {result.kind === "authentication" ? "Staff sign-in required" : "Workspace unavailable"}
            </h2>
            <p>{result.message}</p>
          </section>
        )}
      </section>
    </main>
  );
}
