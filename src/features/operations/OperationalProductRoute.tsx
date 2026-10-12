import Image from "next/image";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { setupAuthorizedCleaningPricing } from "@/server/core/owner-cleaning-pricing-setup";
import { OwnerCleaningPricingSetupForm } from "./OwnerCleaningPricingSetupForm";
import { completeOperationalRequestQuoteInputs } from "./request-quote-input-action";
import { OwnerAutomationActivationChecklist } from "./OwnerAutomationActivationChecklist";
import { availableFirstRunUsdBranches } from "./owner-pricing-readiness";
import { queueApprovedInboxReply } from "@/server/core/reviewed-inbox-reply";
import { runOwnerSavedRequestAutomation } from "@/server/workflows/owner-request-automation";
import {
  addOperationalVisitNote,
  assignOperationalCrew,
  applyOperationalManualPayment,
  applyOperationalRecurrenceAction,
  applyOperationalQualityAction,
  calculateOperationalQuote,
  holdOperationalSlot,
  loadOperationalStaffSnapshot,
  resolveOperationalConversationIdentity,
  reviewOperationalPhotoSuggestion,
  saveOperationalWorkflowDraft,
  previewOperationalWorkflowVersion,
  publishOperationalWorkflowVersion,
  rollbackOperationalWorkflowRule,
  approveOperationalWorkflowExternalAction,
  replayOperationalWorkflowAction,
  executeOperationalWorkflowAttentionAction,
  sendOperationalQuote,
  setOperationalChecklistItem,
  setOperationalBranchMembership,
  grantOperationalTenantSupportAccess,
  revokeOperationalTenantSupportAccess,
  setOperationalCustomerRetentionControl,
  setOperationalServiceCatalogDelegation,
  setOperationalVoiceCallbackState,
  toggleInboxHandover,
  upsertOperationalBranch,
  upsertOperationalReferralCode,
  upsertOperationalRetentionCampaign,
  transitionOperationalVisit,
  updateOperationalServiceCatalogItem,
  type OperationalActionResult,
  type OperationalAttention,
  type OperationalStaffSnapshot,
} from "./operational-product-runtime";
import { buildStaffModuleHref, staffModuleConfig, type StaffModule } from "./staff-modules";
import { filterDirectoryRows, directoryRecordHref, normalizeDirectoryQuery } from "./record-directory";
import { RecordDirectorySearch } from "./RecordDirectorySearch";
import { filterJobsQueue, filterJobsSearch, indexJobProgress, jobsActionFeedbackPrefix, jobsQueueHref, normalizeJobsQueue, normalizeJobsSearch } from "./jobs-queue";
import { JobQueueSearch } from "./JobQueueSearch";
import { JobQueueFilters } from "./JobQueueFilters";
import { countStaffBy, indexCurrentQuoteByRequest, indexStaffById } from "./staff-snapshot-index";
import { buildQuotePipeline, isCurrentApprovedQuote } from "./quote-pipeline";
import { StaffSubmitButton } from "@/components/product/StaffSubmitButton";
import { InboxThreadNavigator } from "./InboxThreadNavigator";
import { InboxDeliveryDiagnostics } from "./InboxDeliveryDiagnostics";
import { StaffAiReviewComposer } from "./StaffAiReviewComposer";
import { AiRequestBrief } from "./AiRequestBrief";
import { AiOperationsStatus } from "./AiOperationsStatus";
import { OwnerQuoteAcceptedAutomationControl } from "./OwnerQuoteAcceptedAutomationControl";
import { WorkflowEvidenceStrip } from "./WorkflowEvidenceStrip";
import { CatalogReadinessBanner } from "./CatalogReadinessBanner";
import { automationPlaybooks, automationPlaybookCategories, getAutomationPlaybook } from "./automation-playbooks";
import { runOwnerSavedOperationalAutomation, type OwnerOperationalEventType } from "@/server/workflows/owner-operational-automation";
import { readConfiguredAiRuntimeConfig } from "@/server/ai/runtime-config";
import { operationalDatabaseMode } from "@/features/auth/operational-preview-mode";
import { inboxThreadPosition } from "./inbox-thread-navigation";
import { presentOutboundDelivery } from "./inbox-delivery-presentation";
import { settingsFeedbackFragment } from "./settings-navigation";
import { EmptyState as AppEmptyState, PageHeader, Panel, SectionHeader, StatusBadge } from "@/components/product/PagePrimitives";
import { FormField, FormGrid, SelectInput, TextArea, TextInput } from "@/components/product/FormPrimitives";
import { FeedbackBanner } from "@/components/product/FeedbackPrimitives";
import { DispatcherIntelligence } from "@/features/dispatch/DispatcherIntelligence";
import { DispatchCoverageWeek } from "./DispatchCoverageWeek";
import { buildDispatchCoverageWeek, normalizeCoverageDay, scheduleCoverageHref } from "./dispatch-coverage-week";
import { CommercialBillingWorkspace } from "@/features/commercial/CommercialBillingWorkspace";
import { TeamInvitationManager } from "@/features/settings/TeamInvitationManager";
import { buildOperationalDispatchIntelligence } from "./dispatch-product-adapter";
import { formatWorkspaceDateTime } from "./product-truth";
import { operationalJourneyCounts, type OperationalJourneyModule } from "./operational-journey-counts";
import { filterQualityQueue, isOverdueQualityCase, normalizeQualityQueue, normalizeQualitySearch, prioritizeQualityFollowUp, qualityFeedbackPrefix, qualityQueueCount, qualityQueueHref } from "./quality-queue";
import { QualityQueueFilters } from "./QualityQueueFilters";
import { filterInvoiceQueue, invoiceFeedbackPrefix, invoiceQueueCounts, invoiceQueueHref, isCollectibleInvoice, normalizeInvoiceQueue, orderCustomerCollectionInvoices, parseManualPaymentAmountMinor } from "./invoice-collection-queue";
import { InvoiceCollectionFilters } from "./InvoiceCollectionFilters";
import { buildScheduleWindow, filterScheduleWindow, scheduleWindowHref, scheduleWindowFeedbackPrefix } from "./staff-schedule-window";
import { deriveDispatchBacklog } from "./dispatch-backlog";
import { formatMinorMoney } from "./view-models";
import { createLocalDayKey } from "./staff-local-day";
import { buildOperationalReleaseReadiness } from "./release-readiness-runtime";
import styles from "./OperationalProductRoute.module.css";
import {
  buildInboxTriage,
  inboxQueueHref,
  inboxQueues,
  normalizeInboxQueue,
  type InboxQueue,
  type InboxQueueCounts,
  searchInboxQueue,
  indexLatestExternalInboxMessages,
} from "./inbox-triage";

interface OperationalProductRouteProps {
  workspaceSlug: string;
  module: Exclude<StaffModule, "overview">;
  selectedConversationId?: string;
  selectedQueue?: string;
  searchQuery?: string;
  selectedScheduleQueue?: string;
  selectedScheduleFrom?: string;
  selectedScheduleDay?: string;
  selectedCustomerId?: string;
  selectedRequestId?: string;
  selectedQuoteId?: string;
  selectedQualityCaseId?: string;
  selectedQualityQueue?: string;
  qualitySearchQuery?: string;
  selectedJobId?: string;
  selectedJobQueue?: string;
  selectedInvoiceId?: string;
  selectedInvoiceQueue?: string;
  automationTemplate?: string;
  invoiceSurface?: string;
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
      encodeURIComponent(result.message) +
      settingsFeedbackFragment(module, extra),
  );
}

function formatWhen(value: string | undefined, timeZone: string) {
  return formatWorkspaceDateTime(value, timeZone);
}

function requestDisplayLabel(request: OperationalStaffSnapshot["requests"][number]) {
  return request.sourceChannel === "VOICE" ? "Missed call" : request.serviceLabel;
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

function EmptyState({ title, detail, action }: {
  title: string;
  detail: string;
  action?: { label: string; href: string };
}) {
  return (
    <Panel>
      <AppEmptyState
        title={title}
        description={detail}
        action={action ? <a className="app-button-secondary" href={action.href}>{action.label}</a> : undefined}
      />
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
function InboxQueueNavigation({
  queue,
  counts,
  search,
}: {
  queue: InboxQueue;
  counts: InboxQueueCounts;
  search?: string;
}) {
  const labels: Record<InboxQueue, string> = {
    all: "All",
    "needs-reply": "Needs reply",
    "delivery-issues": "Delivery issues",
    handover: "Human takeover",
    unverified: "Identity review",
  };
  return (
    <nav className={styles.inboxQueueNav} aria-label="Conversation queues">
      {inboxQueues.map((item) => (
        <a
          key={item}
          className={`${styles.inboxQueueLink} ${item === queue ? styles.inboxQueueActive : ""}`}
          href={inboxQueueHref(item, undefined, search)}
          aria-current={item === queue ? "page" : undefined}
        >
          <span>{labels[item]}</span>
          <span className={styles.inboxQueueCount}>{counts[item]}</span>
        </a>
      ))}
    </nav>
  );
}

function InboxSearchForm({ queue, search }: { queue: InboxQueue; search?: string }) {
  return (
    <form method="get" className={styles.inboxSearchForm} role="search" aria-label="Search workspace conversations">
      {queue !== "all" ? <input type="hidden" name="queue" value={queue} /> : null}
      <label htmlFor="inbox-search">Find a conversation</label>
      <div className={styles.inboxSearchControl}>
        <input id="inbox-search" type="search" name="search" defaultValue={search ?? ""}
          placeholder="Name, channel, or message" maxLength={120} autoComplete="off" />
        <StaffSubmitButton aria-label="Search conversations" pendingLabel="Searching…">Search</StaffSubmitButton>
      </div>
    </form>
  );
}

function InboxView({
  data,
  workspaceSlug,
  selectedConversationId,
  selectedQueue,
  searchQuery,
}: {
  data: OperationalStaffSnapshot;
  workspaceSlug: string;
  selectedConversationId?: string;
  selectedQueue?: string;
  searchQuery?: string;
}) {
  const queue = normalizeInboxQueue(selectedQueue);
  const triage = buildInboxTriage(data.conversations, data.messages, data.customers, queue);
  const search = searchQuery?.trim().slice(0, 120) ?? "";
  const orderedConversations = searchInboxQueue(triage.visible, data.messages, data.customers, search);
  const selected = orderedConversations.find((item) => item.id === selectedConversationId)
    ?? orderedConversations[0];
  if (!selected) {
    return (
      <section className={styles.inboxEmptyQueueWorkspace} aria-label="Customer conversation triage">
        <div className={styles.inboxEmptyQueueHeading}>
          <div>
            <p className={styles.inboxEyebrow}>Inbox</p>
            <h2>Conversations</h2>
            <p>{triage.counts.all} stored conversations</p>
          </div>
        </div>
        <InboxQueueNavigation queue={queue} counts={triage.counts} search={search} />
        <InboxSearchForm queue={queue} search={search} />
        {search ? (
          <a className={styles.inboxClearSearch} href={inboxQueueHref(queue)}>Clear search and see this queue</a>
        ) : null}
        <EmptyState
          title={search ? "No matching conversations" : triage.counts.all ? "No conversations in this queue" : "Inbox is clear"}
          detail={search ? "Try a different name, channel or message phrase." : triage.counts.all
            ? "Choose another queue to see existing conversations."
            : "No customer conversations are stored for this workspace yet."}
        />
      </section>
    );
  }

  const threadPosition = inboxThreadPosition(orderedConversations, selected.id, queue, search);
  const customersById = indexStaffById(data.customers);
  const customer = customersById.get(selected.customerId ?? "");
  const request = data.requests.find((item) => item.id === selected.requestId);
  const property = request?.propertyId
    ? data.properties.find((item) => item.id === request.propertyId)
    : undefined;
  const activeQuote = request
    ? [...data.quotes]
      .filter((quote) => quote.requestId === request.id && quote.status !== "SUPERSEDED")
      .sort((a, b) => b.version - a.version)[0]
    : undefined;
  const relatedVisit = request
    ? data.visits.find((visit) => visit.requestId === request.id && !["COMPLETED", "CANCELLED"].includes(visit.status))
      ?? data.visits.find((visit) => visit.requestId === request.id)
    : undefined;
  const relatedInvoice = activeQuote
    ? data.invoices.find((invoice) => invoice.quoteId === activeQuote.id)
    : undefined;
  const messages = data.messages
    .filter((item) => item.conversationId === selected.id)
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
  // Bind the approval to the latest actual inbound customer message. Never
  // attach a draft to an outgoing or internal message or to another thread.
  const latestInbound = [...messages].reverse().find(
    (item) => item.direction === "INBOUND" && item.senderKind === "CUSTOMER",
  );
  // Stable for every submission from this exact rendered composer. A retry
  // uses the same SQL idempotency key; opening a new composer gets a new key.
  const replyApprovalKey = "staff-reply-" + randomUUID();
  const lastMessageByConversation = indexLatestExternalInboxMessages(data.messages);

  async function handover(formData: FormData) {
    "use server";
    const conversationId = String(formData.get("conversationId") ?? "");
    const active = String(formData.get("active")) === "true";
    const result = await toggleInboxHandover(workspaceSlug, conversationId, active);
    actionRedirect(
      workspaceSlug,
      "inbox",
      result,
      "conversation=" + encodeURIComponent(conversationId) + "&queue=" + encodeURIComponent(queue) + "&search=" + encodeURIComponent(search) + "&",
    );
  }

  async function resolveIdentity(formData: FormData) {
    "use server";
    const conversationId = String(formData.get("conversationId") ?? "");
    const expectedVersion = Number(formData.get("expectedVersion") ?? 0);
    const result = await resolveOperationalConversationIdentity(
      workspaceSlug,
      conversationId,
      expectedVersion,
    );
    actionRedirect(
      workspaceSlug,
      "inbox",
      result,
      "conversation=" + encodeURIComponent(conversationId) + "&queue=" + encodeURIComponent(queue) + "&search=" + encodeURIComponent(search) + "&",
    );
  }

  async function reply(formData: FormData) {
    "use server";
    const conversationId = String(formData.get("conversationId") ?? "");
    const redirectPrefix = "conversation=" + encodeURIComponent(conversationId) +
      "&queue=" + encodeURIComponent(queue) + "&search=" + encodeURIComponent(search) + "&";
    // The checkbox is human approval, not an AI completion or an inbound hook.
    // Even forged FormData must pass trusted current-message, version, consent,
    // membership, branch and replay checks in queueApprovedInboxReply.
    if (formData.get("confirmedByStaff") !== "yes") {
      actionRedirect(workspaceSlug, "inbox",
        { ok: false, message: "Review and confirm the reply before queuing." },
        redirectPrefix);
    }
    const result = await queueApprovedInboxReply({
      workspaceSlug,
      conversationId,
      sourceMessageId: String(formData.get("sourceMessageId") ?? ""),
      reviewedBody: String(formData.get("body") ?? ""),
      expectedVersion: Number(formData.get("expectedVersion") ?? 0),
      idempotencyKey: String(formData.get("idempotencyKey") ?? ""),
      confirmedByStaff: true,
    });
    actionRedirect(workspaceSlug, "inbox",
      result.ok
        ? { ok: true, message: result.value.state === "EXISTING_REPLY"
          ? "Previously queued reply verified. Check delivery status before sending again."
          : "Reply queued. Provider delivery is not yet confirmed." }
        : { ok: false, message: result.message },
      redirectPrefix);
  }

  const relatedConversations = customer
    ? orderedConversations.filter((conversation) =>
        conversation.id !== selected.id && conversation.customerId === customer.id)
    : [];
  const participantLabel = customer?.displayName ?? "Unverified sender";
  const identityResolutionSupported = selected.channel === "WHATSAPP" || selected.channel === "EMAIL";
  const replySupported = identityResolutionSupported && Boolean(customer) && Boolean(latestInbound);
  const latestInboundMessage = [...messages].reverse().find((item) =>
    item.direction === "INBOUND" && item.senderKind === "CUSTOMER");
  // Staff AI is server-side opt-in. A configured model key alone never
  // enables it; the authenticated handler rechecks all permissions and scope.
  const showStaffAiReview = process.env.SERVICEDESK_AI_ENABLED === "true" &&
    replySupported && !selected.handoverActive &&
    ["OWNER", "DISPATCHER"].includes(data.actor.role) &&
    Boolean(latestInboundMessage) && Number.isSafeInteger(selected.version) && selected.version >= 1;

  return (
    <section className={styles.inboxWorkspace} aria-label="Customer conversations">
      <aside className={styles.inboxListPane} aria-label="Conversation list">
        <header className={styles.inboxPaneHeader}>
          <div>
            <p className={styles.inboxEyebrow}>Inbox</p>
            <h2>Conversations</h2>
            <p>{triage.counts.all} stored threads · {triage.counts["needs-reply"]} awaiting reply</p>
          </div>
        </header>
        <InboxQueueNavigation queue={queue} counts={triage.counts} search={search} />
        <InboxSearchForm queue={queue} search={search} />
        <div className={styles.inboxResultsBar} aria-live="polite">
          <span>{search
            ? `${orderedConversations.length} matching conversation${orderedConversations.length === 1 ? "" : "s"}`
            : `${orderedConversations.length} conversation${orderedConversations.length === 1 ? "" : "s"} in this queue`}</span>
          {search ? <a href={inboxQueueHref(queue)}>Clear search</a> : null}
        </div>
        <a className={styles.inboxMobileJump} href="#active-inbox-thread">Jump to selected conversation ↓</a>
        <div id="inbox-conversation-list" className={styles.conversationList} role="list">
          {orderedConversations.map((conversation) => {
            const threadCustomer = customersById.get(conversation.customerId ?? "");
            const latest = lastMessageByConversation.get(conversation.id);
            const selectedThread = conversation.id === selected.id;
            return (
              <a
                className={`${styles.conversationItem} ${selectedThread ? styles.conversationSelected : ""}`.trim()}
                href={inboxQueueHref(queue, conversation.id, search) + "#active-inbox-thread"}
                aria-current={selectedThread ? "page" : undefined}
                aria-label={(threadCustomer?.displayName ?? "Unverified sender") + " " + conversation.channel + " conversation"}
                role="listitem"
                key={conversation.id}
              >
                <span className={styles.conversationAvatar} aria-hidden="true">
                  {(threadCustomer?.displayName ?? "Unverified sender").slice(0, 1).toUpperCase()}
                </span>
                <span className={styles.conversationCopy}>
                  <span className={styles.conversationTopline}>
                    <strong>{threadCustomer?.displayName ?? "Unverified sender"}</strong>
                    <small>{formatWhen(conversation.lastMessageAt, data.workspace.timezone)}</small>
                  </span>
                  <span className={styles.conversationPreview}>{latest?.body ?? (latest?.mediaReference ? "Media message" : "No messages yet")}</span>
                  <span className={styles.conversationMeta}>
                    <span>{conversation.channel}</span>
                    {conversation.handoverActive
                      ? <span className={styles.takeoverDot}>Human takeover</span>
                      : triage.threadFlags.get(conversation.id)?.deliveryIssue
                        ? <span className={styles.inboxDeliveryIssue}>Delivery issue</span>
                        : triage.threadFlags.get(conversation.id)?.needsReply
                          ? <span className={styles.inboxNeedsReply}>Reply due</span>
                          : <span>Open</span>}
                    {triage.threadFlags.get(conversation.id)?.unverified
                      ? <span className={styles.inboxUnverified}>Identity review</span>
                      : null}
                  </span>
                </span>
              </a>
            );
          })}
        </div>
      </aside>

      <section id="active-inbox-thread" className={styles.inboxThreadPane} aria-label={customer ? customer.displayName + " conversation" : "Unverified sender conversation"}>
        <a className={styles.inboxBackToList} href="#inbox-conversation-list">↑ Back to conversations</a>
        <header className={styles.threadHeader}>
          <div className={styles.threadIdentity}>
            <span className={styles.threadAvatar} aria-hidden="true">{participantLabel.slice(0, 1).toUpperCase()}</span>
            <span>
              <h2>{participantLabel}</h2>
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
              <StaffSubmitButton className="app-button-secondary" pendingLabel="Updating handover…">
                {selected.handoverActive ? "Release" : "Take over"}
              </StaffSubmitButton>
            </form>
          </div>
        </header>

        <InboxThreadNavigator
          current={threadPosition.index}
          total={threadPosition.total}
          previousHref={threadPosition.previousHref}
          nextHref={threadPosition.nextHref}
        />

        {triage.threadFlags.get(selected.id)?.deliveryIssue ? (
          <FeedbackBanner
            title="Outbound delivery needs review"
            description="The latest outbound message failed or was suppressed. The customer has not received a confirmed reply. Check the provider status, recipient identity and consent before deciding whether to send a new message."
            tone="danger"
          />
        ) : null}

        {!customer && identityResolutionSupported ? (
          <div className={styles.identityReview}>
            <FeedbackBanner
              title="Identity review required"
              description="This sender is not attached to exactly one verified customer contact. Review verified customer contact data before retrying identity resolution."
              tone="warning"
            />
            <form action={resolveIdentity}>
              <input type="hidden" name="conversationId" value={selected.id} />
              <input type="hidden" name="expectedVersion" value={selected.version} />
              <StaffSubmitButton className="app-button-secondary" pendingLabel="Verifying identity…">Resolve verified identity</StaffSubmitButton>
              <span>Only an exact, unique verified contact match can be linked. Human takeover stays active.</span>
            </form>
          </div>
        ) : null}

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
                ? participantLabel
                : message.senderKind === "STAFF"
                  ? "Staff"
                  : message.senderKind;
              const delivery = outbound && message.deliveryState
                ? presentOutboundDelivery(message.deliveryState)
                : undefined;
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
                    {delivery ? (
                      <span className={styles.deliveryState}>
                        <StatusBadge tone={delivery.tone}>{delivery.label}</StatusBadge>
                      </span>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </div>

        {showStaffAiReview && latestInboundMessage ? (
          <StaffAiReviewComposer
            key={selected.id + ":" + selected.version + ":" + latestInboundMessage.id}
            workspaceSlug={workspaceSlug}
            conversationId={selected.id}
            sourceMessageId={latestInboundMessage.id}
            expectedVersion={selected.version}
          />
        ) : null}

        <form action={reply} className={styles.replyComposer}>
          <input type="hidden" name="conversationId" value={selected.id} />
          <input type="hidden" name="sourceMessageId" value={latestInbound?.id ?? ""} />
          <input type="hidden" name="expectedVersion" value={selected.version} />
          <input type="hidden" name="idempotencyKey" value={replyApprovalKey} />
          <FormField id="reply-body" label="Reply" required>
            {({ id, describedBy, invalid }) => (
              <TextArea
                id={id}
                name="body"
                rows={3}
                placeholder={replySupported ? "Write a reply…" : !customer ? "Verify and link this sender before replying" : !latestInbound ? "Await an inbound customer message before replying" : "Replies are unavailable for this channel"}
                disabled={!replySupported}
                required
                describedBy={describedBy}
                invalid={invalid}
              />
            )}
          </FormField>
          <label className={styles.replyReviewConfirm}>
            <input type="checkbox" name="confirmedByStaff" value="yes" required disabled={!replySupported} />
            <span>I reviewed this reply and approve queueing it for delivery.</span>
          </label>
          <div className={styles.composerFooter}>
            <span>{replySupported ? `Reply via ${selected.channel} · delivery not guaranteed` : !customer ? "Identity must be verified before reply" : !latestInbound ? "Await a customer message before replying" : "Read-only conversation"}</span>
            <StaffSubmitButton className="app-button-primary" disabled={!replySupported} pendingLabel="Queueing reply…">
              Queue reply
            </StaffSubmitButton>
          </div>
        </form>
      </section>

      <aside className={styles.inboxContextPane} aria-label="Customer context">
        <header className={styles.inboxPaneHeader}>
          <div>
            <p className={styles.inboxEyebrow}>Customer context</p>
            <h2>{participantLabel}</h2>
            <p>{customer ? request?.serviceLabel ?? "No request linked" : "No customer record linked"}</p>
          </div>
        </header>

        {customer || request ? (
          <nav className={styles.contextActions} aria-label="Open related business records">
            {customer ? (
              <a href={`/app/${encodeURIComponent(workspaceSlug)}/customers?customer=${encodeURIComponent(customer.id)}`}>
                Customer record <span aria-hidden="true">↗</span>
              </a>
            ) : null}
            {request ? (
              <a href={`/app/${encodeURIComponent(workspaceSlug)}/requests?request=${encodeURIComponent(request.id)}`}>
                Service request <span aria-hidden="true">↗</span>
              </a>
            ) : null}
            {activeQuote ? (
              <a href={`/app/${encodeURIComponent(workspaceSlug)}/quotes?quote=${encodeURIComponent(activeQuote.id)}`}>
                Quote · {activeQuote.status.replaceAll("_", " ").toLowerCase()} <span aria-hidden="true">↗</span>
              </a>
            ) : null}
            {relatedVisit ? (
              <a href={`/app/${encodeURIComponent(workspaceSlug)}/jobs?job=${encodeURIComponent(relatedVisit.id)}`}>
                Job · {relatedVisit.status.replaceAll("_", " ").toLowerCase()} <span aria-hidden="true">↗</span>
              </a>
            ) : null}
            {relatedInvoice ? (
              <a href={`/app/${encodeURIComponent(workspaceSlug)}/invoices?invoice=${encodeURIComponent(relatedInvoice.id)}`}>
                Invoice · {relatedInvoice.status.replaceAll("_", " ").toLowerCase()} <span aria-hidden="true">↗</span>
              </a>
            ) : null}
          </nav>
        ) : null}

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

        <InboxDeliveryDiagnostics workspaceSlug={workspaceSlug} />

        {customer && relatedConversations.length > 0 ? (
          <div className={styles.contextSection}>
            <span className={styles.contextLabel}>Other channels</span>
            <div className={styles.relatedChannels}>
              {relatedConversations.map((conversation) => (
                <a
                  href={inboxQueueHref("all", conversation.id, search)}
                  key={conversation.id}
                >
                  <strong>{conversation.channel}</strong>
                  <span>{formatWhen(conversation.lastMessageAt, data.workspace.timezone)}</span>
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </aside>
    </section>
  );
}

function CustomersView({ data, selectedCustomerId, searchQuery }: { data: OperationalStaffSnapshot; selectedCustomerId?: string; searchQuery?: string }) {
  if (data.customers.length === 0) {
    return <EmptyState title="No customers yet" detail="Customers will appear here after enquiries are linked to a customer record." action={{ label: "Open conversations", href: buildStaffModuleHref(data.workspace.slug, "inbox") }} />;
  }

  const orderedCustomers = [...data.customers].sort((left, right) => left.displayName.localeCompare(right.displayName));
  const search = normalizeDirectoryQuery(searchQuery);
  const visibleCustomers = filterDirectoryRows(orderedCustomers, search, (customer) => {
    return [customer.displayName, customer.leadSource];
  });
  if (!visibleCustomers.length) {
    return (
      <section aria-label="Customer relationship workspace">
        <RecordDirectorySearch label="customers" search={search} visible={0} total={orderedCustomers.length} />
        <EmptyState title="No matching customers" detail="Try a different name or lead source, or clear the search." />
      </section>
    );
  }
  const propertiesByCustomer = countStaffBy(data.properties, (property) => property.customerId);
  const requestsByCustomer = countStaffBy(data.requests, (request) => request.customerId);
  const selectedCustomer = visibleCustomers.find((customer) => customer.id === selectedCustomerId) ?? visibleCustomers[0];
  const selectedProperties = data.properties.filter((property) => property.customerId === selectedCustomer.id);
  const selectedRequests = data.requests
    .filter((request) => request.customerId === selectedCustomer.id)
    .sort((left, right) => Date.parse(right.createdAt ?? "1970-01-01T00:00:00.000Z") - Date.parse(left.createdAt ?? "1970-01-01T00:00:00.000Z"));
  const selectedRequestIds = new Set(selectedRequests.map((request) => request.id));
  const selectedQuotes = data.quotes.filter((quote) => selectedRequestIds.has(quote.requestId));
  const selectedQuoteIds = new Set(selectedQuotes.map((quote) => quote.id));
  const selectedInvoices = data.invoices.filter((invoice) => invoice.quoteId && selectedQuoteIds.has(invoice.quoteId));
  const openInvoices = selectedInvoices.filter(isCollectibleInvoice);
  const openInvoiceTotal = openInvoices.reduce((sum, invoice) => sum + invoice.balanceMinor, 0);
  const openInvoiceCurrency = openInvoices.length > 0 && openInvoices.every((invoice) => invoice.currency === openInvoices[0].currency)
    ? openInvoices[0].currency
    : undefined;
  const activeRequests = selectedRequests.filter((request) => !["CLOSED", "LOST"].includes(request.status));
  const selectedContacts = (data.customerContacts ?? []).filter((contact) => contact.customerId === selectedCustomer.id);
  const verifiedContacts = selectedContacts.filter((contact) => Boolean(contact.verifiedAt));
  const conflictingContacts = selectedContacts.filter((contact) => contact.identityConflictCount > 1);
  const retentionControls = data.retentionControls ?? [];
  const communicationConsents = data.communicationConsents ?? [];

  async function retentionControlAction(formData: FormData) {
    "use server";
    const rawChannel = String(formData.get("channel") ?? "");
    const rawStatus = String(formData.get("status") ?? "");
    if ((rawChannel !== "EMAIL" && rawChannel !== "WHATSAPP")
        || (rawStatus !== "ACTIVE" && rawStatus !== "PAUSED" && rawStatus !== "SUPPRESSED")) {
      actionRedirect(data.workspace.slug, "customers", {
        ok: false,
        message: "Unsupported retention-control change.",
      }, "customer=" + encodeURIComponent(selectedCustomer.id) + "&");
    }
    const result = await setOperationalCustomerRetentionControl(data.workspace.slug, {
      customerId: selectedCustomer.id,
      channel: rawChannel,
      status: rawStatus,
      reasonCode: rawStatus === "SUPPRESSED" ? "STAFF_SUPPRESSED" : rawStatus === "PAUSED" ? "STAFF_PAUSED" : "STAFF_CLEARED",
    });
    actionRedirect(
      data.workspace.slug,
      "customers",
      result,
      "customer=" + encodeURIComponent(selectedCustomer.id) + "&",
    );
  }

  return (
    <section className={styles.crmWorkspace} aria-label="Customer relationship workspace">
      <header className={styles.crmToolbar}>
        <div>
          <p className={styles.crmEyebrow}>Customer directory</p>
          <h2>Customer records</h2>
          <p>{orderedCustomers.length} customer{orderedCustomers.length === 1 ? "" : "s"} · linked properties and service history</p>
        </div>
      </header>

      <RecordDirectorySearch label="customers" search={search} visible={visibleCustomers.length} total={orderedCustomers.length} />
      <div className={styles.crmSplit}>
        <aside className={styles.crmQueue} aria-label="Customer list">
          {visibleCustomers.map((customer) => {
            const properties = propertiesByCustomer.get(customer.id) ?? 0;
            const requests = requestsByCustomer.get(customer.id) ?? 0;
            const selected = customer.id === selectedCustomer.id;
            return (
              <a
                className={`${styles.crmQueueItem} ${selected ? styles.crmQueueSelected : ""}`.trim()}
                href={directoryRecordHref("customer", customer.id, search)}
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

          <section className={styles.contactReview} aria-label="Customer contact identity review">
            <div className={styles.crmSectionHeader}>
              <div>
                <p className={styles.crmSectionEyebrow}>Identity</p>
                <h3>Contact verification</h3>
              </div>
              <span>{verifiedContacts.length}/{selectedContacts.length} verified</span>
            </div>
            {selectedContacts.length === 0 ? (
              <div className={styles.crmEmpty}>
                <strong>No contact identities</strong>
                <p>Add and verify a contact through the accepted customer-data workflow before linking provider conversations.</p>
              </div>
            ) : (
              <div className={styles.contactRows}>
                {selectedContacts.map((contact) => {
                  const conflict = contact.identityConflictCount > 1;
                  const verified = Boolean(contact.verifiedAt);
                  const channel = contact.kind === "EMAIL" ? "EMAIL" : "WHATSAPP";
                  const consent = communicationConsents.find((item) =>
                    item.customerId === selectedCustomer.id && item.channel === channel);
                  const control = retentionControls.find((item) =>
                    item.customerId === selectedCustomer.id && item.channel === channel);
                  const retentionStatus = control?.status ?? "ACTIVE";
                  return (
                    <article className={styles.contactRow} key={contact.id}>
                      <div className={styles.contactIdentity}>
                        <strong>{contact.value}</strong>
                        <span>{contact.kind.toLowerCase()} {contact.isPrimary ? "· primary" : ""} {contact.isBilling ? "· billing" : ""}</span>
                        <div className={styles.contactPolicyBadges}>
                          <StatusBadge tone={consent?.status === "GRANTED" ? "success" : consent?.status === "REVOKED" ? "danger" : "warning"}>
                            {consent?.status === "GRANTED" ? "Campaign opt-in" : consent?.status === "REVOKED" ? "Opted out" : "No campaign opt-in"}
                          </StatusBadge>
                          <StatusBadge tone={retentionStatus === "ACTIVE" ? "neutral" : retentionStatus === "PAUSED" ? "warning" : "danger"}>
                            {retentionStatus === "ACTIVE" ? "No internal hold" : retentionStatus === "PAUSED" ? "Retention paused" : "Retention suppressed"}
                          </StatusBadge>
                        </div>
                      </div>
                      <div className={styles.contactPolicyActions}>
                        <StatusBadge tone={conflict ? "danger" : verified ? "success" : "warning"}>
                          {conflict ? "Identity conflict" : verified ? "Verified" : "Needs verification"}
                        </StatusBadge>
                        {verified && data.retentionAvailable ? (
                          <form action={retentionControlAction}>
                            <input name="channel" type="hidden" value={channel} />
                            <StaffSubmitButton className="app-button-secondary" name="status" value="ACTIVE" pendingLabel="Updating hold…">Clear hold</StaffSubmitButton>
                            <StaffSubmitButton className="app-button-secondary" name="status" value="PAUSED" pendingLabel="Pausing…">Pause</StaffSubmitButton>
                            <StaffSubmitButton className="app-button-secondary" name="status" value="SUPPRESSED" pendingLabel="Suppressing…">Suppress</StaffSubmitButton>
                          </form>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
            {conflictingContacts.length > 0 ? (
              <FeedbackBanner
                title="Duplicate verified identity detected"
                description="At least one verified email or phone value is attached to more than one active customer. Resolve the duplicate customer-contact records before using automatic identity linking."
                tone="danger"
              />
            ) : (
              <p className={styles.contactReviewNote}>
                Verification status is evidence-backed customer data. Clearing an internal retention hold never grants campaign consent; the latest customer opt-in is still checked at dispatch time.
              </p>
            )}
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
                          <strong>{requestDisplayLabel(request)}</strong>
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
  searchQuery,
}: {
  data: OperationalStaffSnapshot;
  workspaceSlug: string;
  selectedRequestId?: string;
  searchQuery?: string;
}) {
  async function updateVoiceCallback(formData: FormData) {
    "use server";
    const requestId = String(formData.get("requestId") ?? "");
    const intakeId = String(formData.get("intakeId") ?? "");
    const state = String(formData.get("state") ?? "");
    const result = await setOperationalVoiceCallbackState(
      workspaceSlug,
      intakeId,
      state === "RESOLVED" ? "RESOLVED" : "PENDING",
    );
    actionRedirect(
      workspaceSlug,
      "requests",
      result,
      "request=" + encodeURIComponent(requestId) + "&",
    );
  }

  async function completeRequestQuoteInputs(formData: FormData) {
    "use server";
    const requestId = String(formData.get("requestId") ?? "");
    const result = await completeOperationalRequestQuoteInputs(workspaceSlug, formData);
    actionRedirect(workspaceSlug, "requests", result,
      "request=" + encodeURIComponent(requestId) + "&");
  }

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

  async function executePublishedRequestRules(formData: FormData) {
    "use server";
    const requestId = String(formData.get("requestId") ?? "");
    const outcome = await runOwnerSavedRequestAutomation(workspaceSlug, requestId);
    const result: OperationalActionResult = outcome.ok
      ? { ok: true, message: `Checked published request rules: ${outcome.value.matchedExecutions} matched; ${outcome.value.completedAttentionActions} internal attention actions verified; ${outcome.value.newlyRecordedRuleExecutions} new and ${outcome.value.reusedRuleExecutions} reused durable rule executions. ${outcome.value.replayedSourceEvent ? "Existing request event reused safely." : "Request event evaluated."} External sends remain approval-required.` }
      : { ok: false, message: outcome.message };
    actionRedirect(
      workspaceSlug,
      "requests",
      result,
      "request=" + encodeURIComponent(requestId) + "&",
    );
  }

  async function reviewPhotoSuggestion(formData: FormData) {
    "use server";
    const requestId = String(formData.get("requestId") ?? "");
    const suggestionId = String(formData.get("suggestionId") ?? "");
    const expectedVersion = Number(formData.get("expectedVersion") ?? 0);
    const decision = String(formData.get("decision")) === "ACCEPTED" ? "ACCEPTED" : "REJECTED";
    const result = await reviewOperationalPhotoSuggestion(
      workspaceSlug,
      suggestionId,
      decision,
      expectedVersion,
    );
    actionRedirect(
      workspaceSlug,
      "requests",
      result,
      "request=" + encodeURIComponent(requestId) + "&",
    );
  }

  if (data.requests.length === 0) {
    return (
      <>
        <CatalogReadinessBanner workspaceSlug={workspaceSlug} serviceCatalog={data.serviceCatalog}
        branchScope={data.branchScope} ownerPricingBookProof={data.ownerPricingBookProof} />
        <EmptyState title="No requests in the queue" detail="New enquiries will appear here as persisted requests." action={{ label: "Review conversations", href: buildStaffModuleHref(workspaceSlug, "inbox") }} />
      </>
    );
  }

  const orderedRequests = [...data.requests].sort((left, right) =>
    Date.parse(right.createdAt ?? "1970-01-01T00:00:00.000Z")
    - Date.parse(left.createdAt ?? "1970-01-01T00:00:00.000Z"),
  );
  const search = normalizeDirectoryQuery(searchQuery);
  const customerById = indexStaffById(data.customers);
  const customerNameById = new Map(data.customers.map((customer) => [customer.id, customer.displayName]));
  const quoteByRequestId = indexCurrentQuoteByRequest(data.quotes);
  const visibleRequests = filterDirectoryRows(orderedRequests, search, (request) => {
    return [request.serviceLabel, request.status, request.sourceChannel, request.customerId ? customerNameById.get(request.customerId) : undefined];
  });
  if (!visibleRequests.length) {
    return (
      <section aria-label="Request intake workspace">
        <RecordDirectorySearch label="requests" search={search} visible={0} total={orderedRequests.length} />
        <EmptyState title="No matching requests" detail="Try a customer, service, channel or status, or clear the search." />
      </section>
    );
  }
  const selectedRequest = visibleRequests.find((request) => request.id === selectedRequestId) ?? visibleRequests[0];
  const selectedRequestCustomer = customerById.get(selectedRequest.customerId ?? "");
  const selectedRequestProperty = data.properties.find((property) => property.id === selectedRequest.propertyId);
  const selectedRequestQuote = quoteByRequestId.get(selectedRequest.id);
  const selectedPhotoAssets = (data.photoAssets ?? []).filter((asset) => asset.requestId === selectedRequest.id);
  const selectedPhotoSuggestions = (data.photoSuggestions ?? [])
    .filter((suggestion) => suggestion.requestId === selectedRequest.id)
    .sort((left, right) => Date.parse(right.generatedAt) - Date.parse(left.generatedAt));
  const pendingPhotoSuggestions = selectedPhotoSuggestions.filter((suggestion) => suggestion.state === "PENDING_REVIEW");
  const snapshotNow = Date.parse(data.loadedAt);
  const supportedActiveServices = data.serviceCatalog.filter(service =>
    service.active === true && ["STANDARD","DEEP","MOVE_OUT"].includes(service.code));
  const chosenServiceActive = supportedActiveServices.some(service =>
    service.code === selectedRequest.serviceCode);
  const requestCanBeCompleted = ["NEW", "COLLECTING", "READY", "NEEDS_REVIEW"]
    .includes(selectedRequest.status) &&
    (data.actor.role === "OWNER" || data.actor.role === "DISPATCHER") &&
    !selectedRequestQuote;
  const selectedRequestCanCalculate = chosenServiceActive
    && selectedRequest.bedrooms !== undefined
    && selectedRequest.bathrooms !== undefined
    && !["BOOKED", "LOST", "CLOSED"].includes(selectedRequest.status);
  const selectedMissing = [
    !chosenServiceActive ? "Service" : undefined,
    selectedRequest.bedrooms === undefined ? "Bedrooms" : undefined,
    selectedRequest.bathrooms === undefined ? "Bathrooms" : undefined,
  ].filter((item): item is string => Boolean(item));
  const requestsWithoutQuote = orderedRequests.filter((request) => !quoteByRequestId.has(request.id)).length;
  const reviewRequests = orderedRequests.filter((request) => ["NEW", "COLLECTING", "READY", "NEEDS_REVIEW"].includes(request.status)).length;

  return (
    <section className={styles.salesWorkspace} aria-label="Request intake workspace">
      <CatalogReadinessBanner workspaceSlug={workspaceSlug} serviceCatalog={data.serviceCatalog}
        branchScope={data.branchScope} ownerPricingBookProof={data.ownerPricingBookProof} />
      <header className={styles.salesToolbar}>
        <div>
          <p className={styles.salesEyebrow}>Intake queue</p>
          <h2>Request pipeline</h2>
          <p>{orderedRequests.length} total · {reviewRequests} need review · {requestsWithoutQuote} without quote</p>
        </div>
        <a className="app-button-secondary" href={buildStaffModuleHref(workspaceSlug, "inbox")}>Open inbox</a>
      </header>

      <RecordDirectorySearch label="requests" search={search} visible={visibleRequests.length} total={orderedRequests.length} />
      <div className={styles.salesSplit}>
        <aside className={styles.salesQueue} aria-label="Request queue">
          {visibleRequests.map((request) => {
            const requestCustomer = customerById.get(request.customerId ?? "");
            const currentQuote = quoteByRequestId.get(request.id);
            const selected = request.id === selectedRequest.id;
            return (
              <a
                className={`${styles.salesQueueItem} ${selected ? styles.salesQueueSelected : ""}`.trim()}
                href={directoryRecordHref("request", request.id, search)}
                aria-current={selected ? "page" : undefined}
                key={request.id}
              >
                <span className={styles.salesQueueTop}>
                  <strong>{requestDisplayLabel(request)}</strong>
                  <StatusBadge tone={statusBadgeTone(request.status)}>{request.status.replaceAll("_", " ")}</StatusBadge>
                </span>
                <span className={styles.salesQueueCustomer}>
                  {request.sourceChannel === "VOICE"
                    ? request.callbackRequired ? "Callback required" : "Voice enquiry"
                    : requestCustomer?.displayName ?? "Visitor enquiry"}
                </span>
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
              <h2>{requestDisplayLabel(selectedRequest)}</h2>
              <p>
                {selectedRequest.sourceChannel === "VOICE"
                  ? selectedRequest.callbackRequired
                    ? "Anonymous caller · staff callback required"
                    : "Anonymous caller · callback completed"
                  : selectedRequestCustomer?.displayName ?? "Visitor enquiry"}
                {" · "}
                {formatWhen(selectedRequest.requestedStartAt, data.workspace.timezone)}
              </p>
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
                {selectedRequest.sourceChannel ? <div><dt>Source</dt><dd>{selectedRequest.sourceChannel.toLowerCase()}</dd></div> : null}
                {selectedRequest.sourceChannel === "VOICE" ? (
                  <div><dt>Callback contact</dt><dd>{selectedRequest.callbackContactRef ?? "Not available"}</dd></div>
                ) : null}
              </dl>
              {selectedRequest.sourceChannel === "VOICE" && selectedRequest.callbackIntakeId ? (
                <form action={updateVoiceCallback} className={styles.salesPrimaryAction}>
                  <input type="hidden" name="requestId" value={selectedRequest.id} />
                  <input type="hidden" name="intakeId" value={selectedRequest.callbackIntakeId} />
                  <input
                    type="hidden"
                    name="state"
                    value={selectedRequest.callbackRequired ? "RESOLVED" : "PENDING"}
                  />
                  <StaffSubmitButton className="app-button-secondary" pendingLabel="Updating callback…">
                    {selectedRequest.callbackRequired ? "Mark callback complete" : "Reopen callback"}
                  </StaffSubmitButton>
                  <span>
                    {selectedRequest.callbackRequired
                      ? "Completing the callback resolves its operations attention item."
                      : "Reopening the callback puts the request back in the attention queue."}
                  </span>
                </form>
              ) : null}
              {selectedRequestProperty?.accessNotes ? (
                <div className={styles.salesNote}><span>Access</span><p>{selectedRequestProperty.accessNotes}</p></div>
              ) : null}
              {selectedRequestProperty?.serviceNotes ? (
                <div className={styles.salesNote}><span>Service notes</span><p>{selectedRequestProperty.serviceNotes}</p></div>
              ) : null}
            </section>

            <AiRequestBrief
              key={selectedRequest.id}
              workspaceSlug={workspaceSlug}
              requestId={selectedRequest.id}
              configured={readConfiguredAiRuntimeConfig().ok}
            />

            {data.actor.role === "OWNER" && (data.workflowRuleVersions ?? [])
              .some(version => version.state === "PUBLISHED" && version.eventType === "REQUEST_CREATED") ? (
              <section className={styles.salesSection} aria-label="Controlled request automation">
                <div className={styles.salesSectionHeader}>
                  <div>
                    <p className={styles.salesSectionEyebrow}>Persisted event · owner-controlled</p>
                    <h3>Request workflow processing</h3>
                  </div>
                </div>
                <p>Evaluate this saved request against published cleaning workflows. Only internal attention actions can execute here; external templates still need separate owner approval.</p>
                {operationalDatabaseMode() === "SERVICE_ROLE" ? (
                  <form action={executePublishedRequestRules}>
                    <input type="hidden" name="requestId" value={selectedRequest.id} />
                    <StaffSubmitButton className="app-button-secondary" pendingLabel="Evaluating saved event…">
                      Process published request rules
                    </StaffSubmitButton>
                  </form>
                ) : (
                  <p>Protected automation execution is not connected in this QA-session environment. No event was executed.</p>
                )}
              </section>
            ) : null}

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
                    <li className={chosenServiceActive ? styles.ready : styles.notReady}><span>{chosenServiceActive ? "✓" : "!"}</span><strong>Service</strong><small>{chosenServiceActive ? selectedRequest.serviceCode : "Not assigned or inactive"}</small></li>
                    <li className={selectedRequest.bedrooms !== undefined ? styles.ready : styles.notReady}><span>{selectedRequest.bedrooms !== undefined ? "✓" : "!"}</span><strong>Bedrooms</strong><small>{selectedRequest.bedrooms ?? "Missing"}</small></li>
                    <li className={selectedRequest.bathrooms !== undefined ? styles.ready : styles.notReady}><span>{selectedRequest.bathrooms !== undefined ? "✓" : "!"}</span><strong>Bathrooms</strong><small>{selectedRequest.bathrooms ?? "Missing"}</small></li>
                  </ul>
                  {requestCanBeCompleted ? (
                    <section aria-label="Complete this request for real pricing"
                      style={{ border: "1px solid #d0e7de", background: "#fbfefd",
                        borderRadius: 12, padding: 14, marginBlock: 12 }}>
                      <h4 style={{ margin: "0 0 8px", color: "#21564a" }}>
                        Complete human-confirmed cleaning details
                      </h4>
                      <p style={{ fontSize: ".82rem", lineHeight: 1.5, margin: "0 0 12px" }}>
                        Select a real active service and enter the customer's confirmed room counts.
                        This updates the saved request only; it does not create or send a quote,
                        infer details with AI, or contact a customer.
                      </p>
                      {supportedActiveServices.length ? (
                        <form action={completeRequestQuoteInputs}
                          style={{ display: "grid", gap: 12 }}>
                          <input type="hidden" name="requestId" value={selectedRequest.id} />
                          <input type="hidden" name="expectedVersion" value={selectedRequest.version} />
                          <label style={{ display: "grid", gap: 5, fontSize: ".83rem" }}>
                            Confirmed cleaning service
                            <select name="serviceCode" className="app-input"
                              defaultValue={chosenServiceActive ? selectedRequest.serviceCode : ""} required>
                              <option value="" disabled>Select a saved active service</option>
                              {supportedActiveServices.map(service => (
                                <option key={service.id} value={service.code}>{service.name}</option>
                              ))}
                            </select>
                          </label>
                          <div style={{ display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
                            <label style={{ display: "grid", gap: 5, fontSize: ".83rem" }}>
                              Confirmed bedrooms
                              <input className="app-input" name="bedrooms" type="number"
                                min={0} max={10} step={1}
                                defaultValue={selectedRequest.bedrooms ?? ""} required />
                            </label>
                            <label style={{ display: "grid", gap: 5, fontSize: ".83rem" }}>
                              Confirmed bathrooms
                              <input className="app-input" name="bathrooms" type="number"
                                min={0} max={10} step={1}
                                defaultValue={selectedRequest.bathrooms ?? ""} required />
                            </label>
                          </div>
                          <StaffSubmitButton className="app-button-secondary"
                            pendingLabel="Saving request facts…">
                            Save request details
                          </StaffSubmitButton>
                        </form>
                      ) : (
                        <p role="status" style={{ margin: 0, fontSize: ".83rem" }}>
                          No active cleaning services are saved. An owner must configure
                          the real service catalog and branch pricing in Settings first.
                        </p>
                      )}
                    </section>
                  ) : null}
                  <form action={calculateQuote} className={styles.salesPrimaryAction}>
                    <input type="hidden" name="requestId" value={selectedRequest.id} />
                    <StaffSubmitButton className="app-button-primary" disabled={!selectedRequestCanCalculate} pendingLabel="Calculating quote…">Calculate quote</StaffSubmitButton>
                    {!selectedRequestCanCalculate ? <span>Complete the missing intake details before pricing.</span> : <span>Uses the current authoritative pricing rules.</span>}
                  </form>
                </>
              )}
            </section>

            <section className={styles.salesSection}>
              <div className={styles.salesSectionHeader}>
                <div>
                  <p className={styles.salesSectionEyebrow}>Photo-assisted intake</p>
                  <h3>{pendingPhotoSuggestions.length > 0 ? "Human review required" : "No pending photo suggestions"}</h3>
                </div>
                <StatusBadge tone={pendingPhotoSuggestions.length > 0 ? "warning" : "neutral"}>
                  {pendingPhotoSuggestions.length} pending
                </StatusBadge>
              </div>

              {data.photoReviewAvailable === false ? (
                <FeedbackBanner
                  title="Photo review is not available in this environment"
                  description="The V2 photo-intake tables are not available yet. Existing request and quote workflows continue unchanged."
                  tone="info"
                />
              ) : selectedPhotoAssets.length === 0 ? (
                <div className={styles.crmEmpty}>
                  <strong>No customer photos</strong>
                  <p>Photos with explicit processing consent will appear here for staff review.</p>
                </div>
              ) : (
                <div className={styles.photoReviewGrid}>
                  {selectedPhotoAssets.map((asset) => {
                    const suggestions = selectedPhotoSuggestions.filter((item) => item.photoAssetId === asset.id);
                    const latestSuggestion = suggestions[0];
                    const processable = asset.state === "AVAILABLE"
                      && asset.consentStatus === "GRANTED"
                      && !asset.processingOptOut
                      && Date.parse(asset.retentionUntil) > snapshotNow;
                    return (
                      <article className={styles.photoReviewCard} key={asset.id}>
                        <div className={styles.photoPreviewFrame}>
                          {processable ? (
                            <Image
                              alt="Customer-provided request photo for staff review"
                              className={styles.photoPreview}
                              height={420}
                              src={"/api/request-photos/" + encodeURIComponent(asset.id) + "?workspace=" + encodeURIComponent(workspaceSlug)}
                              unoptimized
                              width={640}
                            />
                          ) : (
                            <div className={styles.photoPreviewUnavailable}>
                              <strong>Image unavailable</strong>
                              <span>Consent, opt-out, retention, or asset state no longer permits review.</span>
                            </div>
                          )}
                        </div>
                        <div className={styles.photoReviewBody}>
                          <div className={styles.photoReviewMeta}>
                            <span>{asset.source === "CUSTOMER_UPLOAD" ? "Customer upload" : "WhatsApp media"}</span>
                            <span>{Math.max(1, Math.round(asset.byteSize / 1024))} KB</span>
                            <span>Retain until {formatWhen(asset.retentionUntil, data.workspace.timezone)}</span>
                          </div>
                          {latestSuggestion ? (
                            <>
                              <div className={styles.photoSuggestionHeader}>
                                <div>
                                  <span>AI suggestion</span>
                                  <strong>{latestSuggestion.categoryCode.replaceAll("_", " ")}</strong>
                                </div>
                                <StatusBadge tone={latestSuggestion.state === "PENDING_REVIEW" ? "warning" : statusBadgeTone(latestSuggestion.state)}>
                                  {latestSuggestion.state.replaceAll("_", " ")}
                                </StatusBadge>
                              </div>
                              <dl className={styles.salesSummary}>
                                <div><dt>Confidence</dt><dd>{(latestSuggestion.confidenceBasisPoints / 100).toFixed(0)}%</dd></div>
                                <div><dt>Classifier</dt><dd>{latestSuggestion.classifierRef}</dd></div>
                                <div><dt>Suggested add-on</dt><dd>{latestSuggestion.proposedAddOnCode?.replaceAll("_", " ") ?? "None"}</dd></div>
                              </dl>
                              {latestSuggestion.rationale ? (
                                <div className={styles.salesNote}><span>Why it was suggested</span><p>{latestSuggestion.rationale}</p></div>
                              ) : null}
                              {latestSuggestion.followUpQuestions.length > 0 ? (
                                <div className={styles.photoQuestions}>
                                  <strong>Follow-up questions</strong>
                                  <ul>{latestSuggestion.followUpQuestions.map((question) => <li key={question}>{question}</li>)}</ul>
                                </div>
                              ) : null}
                              {latestSuggestion.state === "PENDING_REVIEW" ? (
                                <form action={reviewPhotoSuggestion} className={styles.photoReviewActions}>
                                  <input name="requestId" type="hidden" value={selectedRequest.id} />
                                  <input name="suggestionId" type="hidden" value={latestSuggestion.id} />
                                  <input name="expectedVersion" type="hidden" value={latestSuggestion.version} />
                                  <StaffSubmitButton className="app-button-primary" name="decision" value="ACCEPTED" pendingLabel="Accepting suggestion…">Accept for review</StaffSubmitButton>
                                  <StaffSubmitButton className="app-button-secondary" name="decision" value="REJECTED" pendingLabel="Rejecting suggestion…">Reject suggestion</StaffSubmitButton>
                                </form>
                              ) : null}
                              <p className={styles.photoSafetyNote}>
                                AI is advisory. Accepting this suggestion does not alter request fields, pricing, an accepted quote, invoice, or payment.
                              </p>
                              {selectedRequestQuote?.status === "ACCEPTED" && latestSuggestion.state === "PENDING_REVIEW" ? (
                                <FeedbackBanner
                                  title="Accepted quote is protected"
                                  description="If this suggestion should affect price or scope, create a separate explicit quote revision. This review cannot change the accepted quote."
                                  tone="warning"
                                />
                              ) : null}
                            </>
                          ) : (
                            <div className={styles.crmEmpty}>
                              <strong>No AI suggestion recorded</strong>
                              <p>The source photo remains available for human inspection. No classification result is being implied.</p>
                            </div>
                          )}
                        </div>
                      </article>
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

function QuotesView({
  data,
  workspaceSlug,
  selectedQuoteId,
  searchQuery,
}: {
  data: OperationalStaffSnapshot;
  workspaceSlug: string;
  selectedQuoteId?: string;
  searchQuery?: string;
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
    return <EmptyState title="No quotes yet" detail="Calculated and saved quotes will appear here." action={{ label: "Review service requests", href: buildStaffModuleHref(workspaceSlug, "requests") }} />;
  }

  const { currentQuoteByRequest, orderedQuotes, readyToSend, awaitingCustomer } = buildQuotePipeline(data.quotes);
  const search = normalizeDirectoryQuery(searchQuery);
  const requestById = new Map(data.requests.map((request) => [request.id, request]));
  const customerById = new Map(data.customers.map((customer) => [customer.id, customer]));
  const visibleQuotes = filterDirectoryRows(orderedQuotes, search, (quote) => {
    const request = requestById.get(quote.requestId);
    return [quote.status, quote.currency, request?.serviceLabel, request?.customerId ? customerById.get(request.customerId)?.displayName : undefined];
  });
  if (!visibleQuotes.length) {
    return (
      <section aria-label="Quote workspace">
        <RecordDirectorySearch label="quotes" search={search} visible={0} total={orderedQuotes.length} />
        <EmptyState title="No matching quotes" detail="Try a customer, service or quote status, or clear the search." />
      </section>
    );
  }
  const selectedQuote = visibleQuotes.find((quote) => quote.id === selectedQuoteId) ?? visibleQuotes[0];
  const currentQuote = currentQuoteByRequest.get(selectedQuote.requestId);
  const selectedQuoteIsCurrent = currentQuote?.id === selectedQuote.id;
  const selectedQuoteCanSend = isCurrentApprovedQuote(selectedQuote, currentQuoteByRequest);
  const selectedQuoteRequest = requestById.get(selectedQuote.requestId);
  const selectedQuoteCustomer = customerById.get(selectedQuoteRequest?.customerId ?? "");
  const selectedQuoteProperty = data.properties.find((property) => property.id === selectedQuoteRequest?.propertyId);

  return (
    <section className={styles.salesWorkspace} aria-label="Quote workspace">
      <header className={styles.salesToolbar}>
        <div>
          <p className={styles.salesEyebrow}>Quote workspace</p>
          <h2>Quote pipeline</h2>
          <p>{orderedQuotes.length} total · {readyToSend} ready to send · {awaitingCustomer} awaiting customer</p>
        </div>
        <a className="app-button-secondary" href={buildStaffModuleHref(workspaceSlug, "requests")}>Open requests</a>
      </header>

      <RecordDirectorySearch label="quotes" search={search} visible={visibleQuotes.length} total={orderedQuotes.length} />
      <div className={styles.salesSplit}>
        <aside className={styles.salesQueue} aria-label="Quote list">
          {visibleQuotes.map((quote) => {
            const request = requestById.get(quote.requestId);
            const customer = customerById.get(request?.customerId ?? "");
            const selected = quote.id === selectedQuote.id;
            return (
              <a
                className={`${styles.salesQueueItem} ${selected ? styles.salesQueueSelected : ""}`.trim()}
                href={directoryRecordHref("quote", quote.id, search)}
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
                  <span>v{quote.version}{currentQuoteByRequest.get(quote.requestId)?.id !== quote.id ? " · history" : ""}</span>
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
            <div className={styles.quoteHeaderBadges}>
              <StatusBadge tone={statusBadgeTone(selectedQuote.status)}>{selectedQuote.status.replaceAll("_", " ")}</StatusBadge>
              {!selectedQuoteIsCurrent ? <StatusBadge tone="warning">Historical version</StatusBadge> : null}
            </div>
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
                <div><p className={styles.salesSectionEyebrow}>Next step</p><h3>{!selectedQuoteIsCurrent ? "Historical quote" : selectedQuote.status === "APPROVED" ? "Ready to send" : selectedQuote.status === "SENT" ? "Waiting for customer" : selectedQuote.status === "ACCEPTED" ? "Ready to schedule" : "Quote status"}</h3></div>
              </div>
              <div className={styles.quoteNextStep}>
                {!selectedQuoteIsCurrent ? (
                  <>
                    <p>This is not the current quote version. Review the latest quote before taking another action.</p>
                    <a className="app-button-secondary" href={currentQuote
                      ? directoryRecordHref("quote", currentQuote.id, search)
                      : buildStaffModuleHref(workspaceSlug, "requests")}>Open current record</a>
                  </>
                ) : selectedQuoteCanSend ? (
                  <>
                    <p>The quote is approved internally and ready to send to the customer.</p>
                    <form action={sendQuote}>
                      <input type="hidden" name="quoteId" value={selectedQuote.id} />
                      <StaffSubmitButton className="app-button-primary" pendingLabel="Sending quote…">Send quote</StaffSubmitButton>
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
  selectedScheduleQueue,
  selectedScheduleFrom,
  selectedScheduleDay,
}: {
  data: OperationalStaffSnapshot;
  workspaceSlug: string;
  selectedScheduleQueue?: string;
  selectedScheduleFrom?: string;
  selectedScheduleDay?: string;
}) {
  const window = buildScheduleWindow(data.loadedAt, data.workspace.timezone, selectedScheduleFrom);
  const upcoming = filterScheduleWindow(data.visits, data.workspace.timezone, window);
  const coverageDays = buildDispatchCoverageWeek(upcoming, data.loadedAt, data.workspace.timezone, window.from);
  const selectedDay = normalizeCoverageDay(selectedScheduleDay, coverageDays);
  const currentQueue = selectedScheduleQueue === "unassigned" ? "unassigned" : "all";
  const redirectPrefix = scheduleWindowFeedbackPrefix(window, currentQueue)
    + (selectedDay ? "day=" + encodeURIComponent(selectedDay) + "&" : "");
  async function assignCrew(formData: FormData) {
    "use server";
    const visitId = String(formData.get("visitId") ?? "");
    const crewId = String(formData.get("crewId") ?? "");
    const expectedVersion = Number(formData.get("expectedVersion"));
    const result = await assignOperationalCrew(workspaceSlug, visitId, crewId, expectedVersion);
    actionRedirect(workspaceSlug, "schedule", result, redirectPrefix);
  }

  async function holdSlot(formData: FormData) {
    "use server";
    const result = await holdOperationalSlot(
      workspaceSlug,
      String(formData.get("quoteId") ?? ""),
      String(formData.get("slotId") ?? ""),
    );
    actionRedirect(workspaceSlug, "schedule", result, redirectPrefix);
  }

  const now = Date.parse(data.loadedAt);

  const requestById = indexStaffById(data.requests);
  const customerById = indexStaffById(data.customers);
  const crewById = indexStaffById(data.crews);
  const activeHoldByQuote = new Map<string, OperationalStaffSnapshot["slotHolds"][number]>();
  for (const hold of data.slotHolds) {
    if (hold.status === "HELD" && Date.parse(hold.expiresAt) > now && !activeHoldByQuote.has(hold.quoteId)) {
      activeHoldByQuote.set(hold.quoteId, hold);
    }
  }
  const { unscheduled, acceptedQuotes } = deriveDispatchBacklog(data.requests, data.quotes, data.visits);
  const heldSlotIds = new Set(
    data.slotHolds
      .filter((hold) => hold.status === "HELD" && Date.parse(hold.expiresAt) > now)
      .map((hold) => hold.slotId),
  );
  const unassignedUpcoming = upcoming.filter((visit) => !visit.crewId).length;
  // A read-only view of already authorized visits; never affects assignment authority.
  const showUnassigned = selectedScheduleQueue === "unassigned";
  const queueVisits = showUnassigned ? upcoming.filter((visit) => !visit.crewId) : upcoming;
  const localDayKey = createLocalDayKey(data.workspace.timezone);
  const visibleUpcoming = selectedDay
    ? queueVisits.filter((visit) => localDayKey(visit.startAt) === selectedDay)
    : queueVisits;
  const activeHolds = data.slotHolds.filter((hold) => hold.status === "HELD" && Date.parse(hold.expiresAt) > now).length;
  const dispatch = buildOperationalDispatchIntelligence(data);
  const visitLabels = Object.fromEntries(data.visits.map((visit) => {
    const request = requestById.get(visit.requestId);
    const customer = request?.customerId ? customerById.get(request.customerId) : undefined;
    return [visit.id, `${request?.serviceLabel ?? "Service visit"}${customer ? ` · ${customer.displayName}` : ""}`];
  }));
  const visitMeta = Object.fromEntries(data.visits.map((visit) => [visit.id, formatWhen(visit.startAt, data.workspace.timezone)]));

  return (
    <section className={styles.scheduleWorkspace} aria-label="Scheduling and dispatch workspace">
      <header className={styles.scheduleHeader}>
        <div>
          <p className={styles.scheduleEyebrow}>Operations planning</p>
          <h2>Planning &amp; dispatch</h2>
          <p>Review crew coverage across business-local calendar days, place accepted work into capacity, and confirm assignments.</p>
        </div>
        <a className="app-button-secondary" href={buildStaffModuleHref(workspaceSlug, "jobs")}>Open jobs</a>
      </header>

      <nav className={styles.scheduleWindowNav} aria-label="Browse seven-day scheduling windows">
        <div className={styles.scheduleWindowPeriod}>
          <span>Service dates · {data.workspace.timezone}</span>
          <strong>{window.from} → {window.end}</strong>
        </div>
        <div className={styles.scheduleWindowActions}>
          <a href={scheduleWindowHref(window.previous, currentQueue, window.today)} aria-label="Previous seven calendar days">← Previous</a>
          <a href={scheduleWindowHref(window.today, currentQueue, window.today)} aria-current={window.isCurrent ? "date" : undefined}>Today</a>
          <a href={scheduleWindowHref(window.next, currentQueue, window.today)} aria-label="Next seven calendar days">Next →</a>
        </div>
      </nav>

      <section className={styles.scheduleMetrics} aria-label="Scheduling summary">
        <div><span>{window.isCurrent ? "Next 7 days" : "Selected 7 days"}</span><strong>{upcoming.length}</strong><small>Scheduled visits</small></div>
        <div className={unassignedUpcoming ? styles.scheduleMetricWarning : undefined}><span>Need crew</span><strong>{unassignedUpcoming}</strong><small>Upcoming visits</small></div>
        <div className={acceptedQuotes.length ? styles.scheduleMetricAttention : undefined}><span>Awaiting slot</span><strong>{acceptedQuotes.length}</strong><small>Accepted quotes</small></div>
        <div><span>Active holds</span><strong>{activeHolds}</strong><small>Temporary capacity holds</small></div>
      </section>

      <DispatchCoverageWeek
        days={coverageDays}
        selectedDay={selectedDay}
        queue={selectedScheduleQueue}
        timeZone={data.workspace.timezone}
        from={window.from}
        today={window.today}
      />

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
            <StaffSubmitButton className="app-button-primary" pendingLabel="Assigning crew…">Assign crew</StaffSubmitButton>
          </form>
        )}
      />

      <nav className={styles.scheduleQueueNav} aria-label="Schedule visit filters">
        <a href={scheduleCoverageHref("all", selectedDay, window.from, window.today)} aria-current={!showUnassigned ? "page" : undefined}>
          All visits <strong>{upcoming.length}</strong>
        </a>
        <a href={scheduleCoverageHref("unassigned", selectedDay, window.from, window.today)} aria-current={showUnassigned ? "page" : undefined}>
          Need crew <strong>{unassignedUpcoming}</strong>
        </a>
      </nav>

      <div className={styles.schedulePlanningGrid}>
        <section className={styles.scheduleCard} aria-labelledby="next-seven-days-heading">
          <div className={styles.scheduleCardHeader}>
            <div><p className={styles.scheduleCardEyebrow}>Verified visits</p><h3 id="next-seven-days-heading">{showUnassigned ? "Visits waiting for crew" : window.isCurrent ? "Next 7 days" : "Selected 7 days"}</h3><p>{visibleUpcoming.length} visit{visibleUpcoming.length === 1 ? "" : "s"} shown from {window.from} through {window.end}.</p></div>
          </div>
          {visibleUpcoming.length === 0 ? (
            <div className={styles.scheduleEmpty}><strong>{showUnassigned ? "Crew coverage complete" : "No scheduled visits"}</strong><p>{showUnassigned ? "All scheduled visits in this window have a crew." : `No visits are scheduled from ${window.from} through ${window.end}.`}</p></div>
          ) : (
            <div className={styles.scheduleVisitList}>
              {visibleUpcoming.slice(0, 12).map((visit) => {
                const request = requestById.get(visit.requestId);
                const customer = request?.customerId ? customerById.get(request.customerId) : undefined;
                const crew = visit.crewId ? crewById.get(visit.crewId) : undefined;
                return (
                  <a className={styles.scheduleVisitRow} href={`/app/${encodeURIComponent(workspaceSlug)}/jobs?job=${encodeURIComponent(visit.id)}`} key={visit.id}>
                    <time>{formatWhen(visit.startAt, data.workspace.timezone)}</time>
                    <span className={styles.scheduleVisitCopy}><strong>{request?.serviceLabel ?? "Service visit"}</strong><small>{customer?.displayName ?? "Customer"} · {crew?.name ?? "Crew unassigned"}</small></span>
                    <StatusBadge tone={statusBadgeTone(visit.status)}>{visit.status.replaceAll("_", " ")}</StatusBadge>
                  </a>
                );
              })}
              {visibleUpcoming.length > 12 ? (
                <div className={styles.scheduleOverflowNotice}>
                  <span>Showing 12 of {visibleUpcoming.length} scheduled visits.</span>
                  <a href={buildStaffModuleHref(workspaceSlug, "jobs")}>Open all jobs →</a>
                </div>
              ) : null}
            </div>
          )}
        </section>

        <section className={styles.scheduleCard} aria-labelledby="booking-queue-heading">
          <div className={styles.scheduleCardHeader}>
            <div><p className={styles.scheduleCardEyebrow}>Capacity</p><h3 id="booking-queue-heading">Accepted work awaiting a slot</h3><p>Holding capacity never implies payment or a confirmed visit.</p></div>
          </div>
          {acceptedQuotes.length === 0 ? (
            <div className={styles.scheduleEmpty}><strong>Booking queue is clear</strong><p>No accepted quotes are waiting for capacity.</p></div>
          ) : (
            <div className={styles.bookingQueue}>
              {acceptedQuotes.map((quote) => {
                const request = requestById.get(quote.requestId);
                const customer = request?.customerId ? customerById.get(request.customerId) : undefined;
                const activeHold = activeHoldByQuote.get(quote.id);
                const requiredMinutes = quote.durationMinutes + quote.bufferMinutes;
                const candidates = data.capacitySlots.filter((slot) => {
                  const start = Date.parse(slot.startAt);
                  const end = Date.parse(slot.endAt);
                  const windowMinutes = Number.isFinite(start) && Number.isFinite(end) ? Math.floor((end - start) / 60000) : 0;
                  return start >= now && !heldSlotIds.has(slot.id) && slot.capacityMinutes >= requiredMinutes && windowMinutes >= requiredMinutes;
                });
                return (
                  <article className={styles.bookingQueueItem} key={quote.id}>
                    <div className={styles.bookingQueueTitle}><span><strong>{request?.serviceLabel ?? "Service"}</strong><small>{customer?.displayName ?? "Customer"} · {quote.durationMinutes} min service</small></span><StatusBadge tone={activeHold ? "warning" : candidates.length ? "info" : "neutral"}>{activeHold ? "Slot held" : candidates.length ? `${candidates.length} slots` : "No fit"}</StatusBadge></div>
                    {activeHold ? (
                      <p>Held until {formatWhen(activeHold.expiresAt, data.workspace.timezone)}. Payment remains pending.</p>
                    ) : candidates.length === 0 ? (
                      <p>No current capacity slot fits the required service + buffer time.</p>
                    ) : (
                      <div className={styles.slotChoices}>
                        {candidates.slice(0, 4).map((slot) => (
                          <form action={holdSlot} key={slot.id}>
                            <input type="hidden" name="quoteId" value={quote.id} />
                            <input type="hidden" name="slotId" value={slot.id} />
                            <StaffSubmitButton className="app-button-secondary" pendingLabel="Holding slot…">Hold {formatWhen(slot.startAt, data.workspace.timezone)}</StaffSubmitButton>
                          </form>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <section className={styles.unscheduledCard} aria-labelledby="unscheduled-heading">
        <div className={styles.scheduleCardHeader}>
          <div><p className={styles.scheduleCardEyebrow}>Intake follow-through</p><h3 id="unscheduled-heading">Unscheduled work</h3><p>Open requests that do not yet have a visit.</p></div>
          <a href={buildStaffModuleHref(workspaceSlug, "requests")}>Open requests →</a>
        </div>
        {unscheduled.length === 0 ? (
          <div className={styles.scheduleEmpty}><strong>No unscheduled work</strong><p>Every open request is already connected to a visit.</p></div>
        ) : (
          <div className={styles.unscheduledGrid}>
            {unscheduled.slice(0, 12).map((request) => {
              const customer = request.customerId ? customerById.get(request.customerId) : undefined;
              return (
                <a href={`/app/${encodeURIComponent(workspaceSlug)}/requests?request=${encodeURIComponent(request.id)}`} key={request.id}>
                  <span><strong>{request.serviceLabel}</strong><small>{customer?.displayName ?? "Visitor enquiry"} · Requested {formatWhen(request.requestedStartAt, data.workspace.timezone)}</small></span>
                  <StatusBadge tone={statusBadgeTone(request.status)}>{request.status.replaceAll("_", " ")}</StatusBadge>
                </a>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}

function JobsView({
  data,
  workspaceSlug,
  selectedJobId,
  selectedJobQueue,
  searchQuery,
}: {
  data: OperationalStaffSnapshot;
  workspaceSlug: string;
  selectedJobId?: string;
  selectedJobQueue?: string;
  searchQuery?: string;
}) {
  const jobQueue = normalizeJobsQueue(selectedJobQueue);
  const jobSearch = normalizeJobsSearch(searchQuery);
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
    actionRedirect(workspaceSlug, "jobs", result, jobsActionFeedbackPrefix(jobQueue, visitId, jobSearch));
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
    actionRedirect(workspaceSlug, "jobs", result, jobsActionFeedbackPrefix(jobQueue, visitId, jobSearch));
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
    actionRedirect(workspaceSlug, "jobs", result, jobsActionFeedbackPrefix(jobQueue, visitId, jobSearch));
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
    return <EmptyState title="No jobs yet" detail="Paid and scheduled visits will appear here." action={{ label: "Open schedule", href: buildStaffModuleHref(workspaceSlug, "schedule") }} />;
  }

  const orderedVisits = [...data.visits].sort((left, right) => {
    const leftClosed = ["COMPLETED", "CANCELLED"].includes(left.status) ? 1 : 0;
    const rightClosed = ["COMPLETED", "CANCELLED"].includes(right.status) ? 1 : 0;
    return leftClosed - rightClosed || Date.parse(left.startAt) - Date.parse(right.startAt);
  });
  const activeVisits = orderedVisits.filter((visit) => !["COMPLETED", "CANCELLED"].includes(visit.status));
  const requestById = indexStaffById(data.requests);
  const customerById = indexStaffById(data.customers);
  const crewById = indexStaffById(data.crews);
  const queue = normalizeJobsQueue(selectedJobQueue);
  const statusVisits = filterJobsQueue(orderedVisits, queue);
  const visibleVisits = filterJobsSearch(statusVisits, jobSearch, (visit) => {
    const request = requestById.get(visit.requestId);
    const customer = customerById.get(request?.customerId ?? "");
    const crew = crewById.get(visit.crewId ?? "");
    return [request?.serviceLabel, customer?.displayName, crew?.name, visit.status, visit.startAt];
  });
  if (!visibleVisits.length) {
    return (
      <section className={styles.jobsWorkspace} aria-label="Field jobs workspace">
        <JobQueueFilters queue={queue} visits={orderedVisits} search={jobSearch} />
      <JobQueueSearch queue={queue} search={jobSearch} visible={visibleVisits.length} total={statusVisits.length} />
        <EmptyState title={jobSearch ? "No matching jobs" : "No jobs in this queue"} detail={jobSearch ? "Try a different customer, service or crew, or clear your search." : "Choose another status to see work in progress or completed jobs."} />
      </section>
    );
  }
  const selectedVisit = visibleVisits.find((visit) => visit.id === selectedJobId) ?? visibleVisits[0];
  const selectedRequest = requestById.get(selectedVisit.requestId);
  const selectedCustomer = customerById.get(selectedRequest?.customerId ?? "");
  const selectedProperty = data.properties.find((property) => property.id === selectedRequest?.propertyId);
  const selectedCrew = selectedVisit.crewId ? crewById.get(selectedVisit.crewId) : undefined;
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
  const progressByVisit = indexJobProgress(data.visitEvidence, data.visitChecklistItems);

  return (
    <section className={styles.jobsWorkspace} aria-label="Field jobs workspace">
      <header className={styles.jobsToolbar}>
        <div>
          <p className={styles.jobsEyebrow}>Work queue</p>
          <h2>Field operations queue</h2>
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

      <JobQueueFilters queue={queue} visits={orderedVisits} search={jobSearch} />
      <JobQueueSearch queue={queue} search={jobSearch} visible={visibleVisits.length} total={statusVisits.length} />
      <div className={styles.jobsSplit}>
        <aside className={styles.jobsQueue} aria-label="Job list">
          {visibleVisits.map((visit) => {
            const request = requestById.get(visit.requestId);
            const customer = customerById.get(request?.customerId ?? "");
            const crew = visit.crewId ? crewById.get(visit.crewId) : undefined;
            const progress = progressByVisit.get(visit.id);
            const selected = visit.id === selectedVisit.id;
            return (
              <a
                className={`${styles.jobsQueueItem} ${selected ? styles.jobsQueueSelected : ""}`.trim()}
                href={jobsQueueHref(queue, visit.id, jobSearch)}
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
                <span className={styles.jobsQueueProgress}>{progress?.evidence ?? 0} evidence · {progress?.completed ?? 0}/{progress?.checklist ?? 0} checklist</span>
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
                <StaffSubmitButton className="app-button-secondary" pendingLabel="Saving note…">Save note</StaffSubmitButton>
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
                <StaffSubmitButton className="app-button-secondary" pendingLabel="Updating checklist…">Mark complete</StaffSubmitButton>
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
  selectedInvoiceQueue,
  searchQuery,
}: {
  data: OperationalStaffSnapshot;
  workspaceSlug: string;
  selectedInvoiceId?: string;
  selectedInvoiceQueue?: string;
  searchQuery?: string;
}) {
  const queue = normalizeInvoiceQueue(selectedInvoiceQueue);
  const search = normalizeDirectoryQuery(searchQuery);
  async function manualPayment(formData: FormData) {
    "use server";
    const invoiceId = String(formData.get("invoiceId") ?? "");
    const amountMinor = parseManualPaymentAmountMinor(String(formData.get("amount") ?? ""));
    if (amountMinor === undefined) {
      actionRedirect(workspaceSlug, "invoices", { ok: false, message: "Enter a positive payment amount with no more than two decimal places." }, invoiceFeedbackPrefix(queue, search, invoiceId));
    }
    const methodRaw = String(formData.get("method") ?? "OTHER");
    const method = methodRaw === "CASH" || methodRaw === "BANK_TRANSFER" ? methodRaw : "OTHER";
    const result = await applyOperationalManualPayment(workspaceSlug, invoiceId, amountMinor, method, String(formData.get("reference") ?? ""));
    actionRedirect(workspaceSlug, "invoices", result, invoiceFeedbackPrefix(queue, search, invoiceId));
  }

  const customerInvoices = data.invoices.filter((invoice) => Boolean(invoice.quoteId));
  if (customerInvoices.length === 0) {
    return <EmptyState title="No customer invoices yet" detail="Quote-backed customer invoices will appear here after billable visits are created. Commercial accounts remain available in the adjacent workspace." action={{ label: "Review jobs", href: buildStaffModuleHref(workspaceSlug, "jobs") }} />;
  }

  const orderedInvoices = orderCustomerCollectionInvoices(customerInvoices);
  const counts = invoiceQueueCounts(orderedInvoices);
  const quoteById = new Map(data.quotes.map((quote) => [quote.id, quote]));
  const requestById = new Map(data.requests.map((request) => [request.id, request]));
  const customerById = new Map(data.customers.map((customer) => [customer.id, customer]));
  const visibleInvoices = filterDirectoryRows(filterInvoiceQueue(orderedInvoices, queue), search, (invoice) => {
    const quote = invoice.quoteId ? quoteById.get(invoice.quoteId) : undefined;
    const request = quote ? requestById.get(quote.requestId) : undefined;
    return [invoice.status, invoice.currency, request?.serviceLabel, request?.customerId ? customerById.get(request.customerId)?.displayName : undefined];
  });
  if (!visibleInvoices.length) {
    return (
      <section aria-label="Invoice collection workspace">
        <InvoiceCollectionFilters queue={queue} search={search} counts={counts} visible={0} />
        <EmptyState title={search ? "No matching invoices" : "No invoices in this status"} detail={search ? "Try another customer, service or invoice status, or clear the search." : "Choose another collection status to see existing invoices."} />
      </section>
    );
  }
  const selectedInvoice = visibleInvoices.find((invoice) => invoice.id === selectedInvoiceId) ?? visibleInvoices[0];
  const selectedInvoiceQuote = quoteById.get(selectedInvoice.quoteId ?? "");
  const selectedInvoiceRequest = requestById.get(selectedInvoiceQuote?.requestId ?? "");
  const selectedInvoiceCustomer = customerById.get(selectedInvoiceRequest?.customerId ?? "");
  const selectedInvoiceProperty = data.properties.find((property) => property.id === selectedInvoiceRequest?.propertyId);
  const selectedInvoiceCanRecordPayment = isCollectibleInvoice(selectedInvoice);
  const openInvoices = orderedInvoices.filter(isCollectibleInvoice);
  const paidInvoices = orderedInvoices.filter((invoice) => invoice.status === "PAID").length;

  return (
    <section className={styles.financeWorkspace} aria-label="Invoice collection workspace">
      <header className={styles.financeToolbar}>
        <div>
          <p className={styles.financeEyebrow}>Customer finance</p>
          <h2>Collections &amp; invoices</h2>
          <p>{openInvoices.length} open balance{openInvoices.length === 1 ? "" : "s"} · {paidInvoices} paid · Ordered by status and invoice currency</p>
        </div>
        <a className="app-button-secondary" href={buildStaffModuleHref(workspaceSlug, "reports")}>Open reports</a>
      </header>

      <InvoiceCollectionFilters queue={queue} search={search} counts={counts} visible={visibleInvoices.length} />
      <div className={styles.financeSplit}>
        <aside className={styles.financeQueue} aria-label="Invoice list">
          {visibleInvoices.map((invoice) => {
            const quote = quoteById.get(invoice.quoteId ?? "");
            const request = requestById.get(quote?.requestId ?? "");
            const customer = customerById.get(request?.customerId ?? "");
            const selected = invoice.id === selectedInvoice.id;
            return (
              <a
                className={`${styles.financeQueueItem} ${selected ? styles.financeQueueSelected : ""}`.trim()}
                href={invoiceQueueHref(queue, search, invoice.id)}
                aria-current={selected ? "page" : undefined}
                key={invoice.id}
              >
                <span className={styles.financeQueueTop}>
                  <strong>{customer?.displayName ?? "Customer"}</strong>
                  <StatusBadge tone={statusBadgeTone(invoice.status)}>{invoice.status.replaceAll("_", " ")}</StatusBadge>
                </span>
                <span className={styles.financeQueueService}>{request?.serviceLabel ?? "Service invoice"}</span>
                <span className={styles.financeQueueMoney}>
                  <span>{formatMinorMoney(invoice.balanceMinor, invoice.currency)} {invoice.status === "VOID" ? "void" : invoice.status === "PAID" ? "paid" : invoice.status === "DRAFT" ? "draft · not due" : isCollectibleInvoice(invoice) ? "due" : "balance · review"}</span>
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
              <span>{selectedInvoice.status === "DRAFT" ? "Draft balance" : "Outstanding balance"}</span>
              <strong>{formatMinorMoney(selectedInvoice.balanceMinor, selectedInvoice.currency)}</strong>
              <small>{selectedInvoice.status === "PAID" ? "Paid in full"
                : selectedInvoice.status === "VOID" ? "Invoice void"
                : selectedInvoice.status === "DRAFT" ? "Not due until the invoice is issued"
                : isCollectibleInvoice(selectedInvoice) ? "Current amount still to collect"
                : "Status requires review before payment recording"}</small>
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
                  <StaffSubmitButton className="app-button-primary" pendingLabel="Recording payment…">Record payment</StaffSubmitButton>
                  <p>Use this only for money already received outside the online checkout flow. It does not simulate online settlement.</p>
                </form>
              ) : (
                <div className={styles.financeClosedState}>
                  <span aria-hidden="true">{selectedInvoice.status === "PAID" ? "✓" : "—"}</span>
                  <div>
                    <strong>{selectedInvoice.status === "VOID" ? "Invoice void"
                      : selectedInvoice.status === "DRAFT" ? "Draft awaiting issue"
                      : selectedInvoice.status === "PAID" ? "Paid in full"
                      : "No collectible balance"}</strong>
                    <p>{selectedInvoice.status === "VOID" ? "Payments cannot be recorded on a void invoice."
                      : selectedInvoice.status === "DRAFT" ? "This draft is not yet due; issue the invoice through the authorized workflow before recording a collection."
                      : selectedInvoice.status === "PAID" ? "The authoritative invoice status is paid."
                      : "This invoice is not currently eligible for payment recording. Review its status before taking action."}</p>
                  </div>
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
  selectedQualityQueue,
  qualitySearchQuery,
}: {
  data: OperationalStaffSnapshot;
  workspaceSlug: string;
  selectedQualityCaseId?: string;
  selectedQualityQueue?: string;
  qualitySearchQuery?: string;
}) {
  const queue = normalizeQualityQueue(selectedQualityQueue);
  const search = normalizeQualitySearch(qualitySearchQuery);
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
    actionRedirect(workspaceSlug, "quality", result, qualityFeedbackPrefix(queue, search, qualityCaseId));
  }

  if (data.qualityCases.length === 0) {
    return <EmptyState title="No quality cases" detail="Customer feedback that requires operational review will appear here." action={{ label: "Review completed jobs", href: buildStaffModuleHref(workspaceSlug, "jobs") }} />;
  }

  const orderedCases = prioritizeQualityFollowUp(data.qualityCases, data.loadedAt);
  const visitById = new Map(data.visits.map(visit => [visit.id, visit]));
  const requestById = new Map(data.requests.map(request => [request.id, request]));
  const customerById = new Map(data.customers.map(customer => [customer.id, customer]));
  const lookupCase = (qualityCase: typeof orderedCases[number]) => {
    const caseVisit = visitById.get(qualityCase.visitId);
    const caseRequest = caseVisit ? requestById.get(caseVisit.requestId) : undefined;
    const caseCustomer = caseRequest?.customerId ? customerById.get(caseRequest.customerId) : undefined;
    return { caseRequest, caseCustomer };
  };
  const filteredCases = filterQualityQueue(orderedCases, queue, search, qualityCase => {
    const { caseRequest, caseCustomer } = lookupCase(qualityCase);
    return [qualityCase.summary, caseCustomer?.displayName, caseRequest?.serviceLabel, qualityCase.state, qualityCase.feedbackScore?.toString()];
  }, data.loadedAt);
  const counts = qualityQueueCount(orderedCases, data.loadedAt);
  if (!filteredCases.length) {
    return (
      <section className={styles.qualityWorkspace} aria-label="Quality review workspace">
        <QualityQueueFilters queue={queue} search={search} counts={counts} visible={0} />
        <EmptyState
          title={search ? "No matching quality cases" : "No cases in this queue"}
          detail={search ? "Try another customer, service or issue description." : "Choose another status or clear the filter to see existing cases."}
        />
      </section>
    );
  }
  const selected = filteredCases.find(qualityCase => qualityCase.id === selectedQualityCaseId) ?? filteredCases[0];
  const visit = visitById.get(selected.visitId);
  const request = visit ? data.requests.find((item) => item.id === visit.requestId) : undefined;
  const customer = request?.customerId ? data.customers.find((item) => item.id === request.customerId) : undefined;
  const property = request?.propertyId ? data.properties.find((item) => item.id === request.propertyId) : undefined;
  const crew = visit?.crewId ? data.crews.find((item) => item.id === visit.crewId) : undefined;
  const evidence = data.visitEvidence.filter((item) => item.visitId === selected.visitId);
  const openCount = counts.open;
  const reviewCount = counts.review;
  const resolvedCount = counts.resolved;

  return (
    <section className={styles.qualityWorkspace} aria-label="Quality review workspace">
      <header className={styles.qualityToolbar}>
        <div>
          <p className={styles.qualityEyebrow}>Issue management</p>
          <h2>Quality review queue</h2>
          <p>{openCount} open · {reviewCount} in review · {counts.overdue} overdue · {resolvedCount} resolved</p>
        </div>
        <a className="app-button-secondary" href={buildStaffModuleHref(workspaceSlug, "jobs")}>Open jobs</a>
      </header>

      <QualityQueueFilters queue={queue} search={search} counts={counts} visible={filteredCases.length} />

      <div className={styles.qualitySplit}>
        <aside className={styles.qualityQueue} aria-label="Quality case list">
          {filteredCases.map((qualityCase) => {
            const { caseRequest, caseCustomer } = lookupCase(qualityCase);
            const selectedCase = qualityCase.id === selected.id;
            return (
              <a
                className={`${styles.qualityQueueItem} ${selectedCase ? styles.qualityQueueSelected : ""}`.trim()}
                href={qualityQueueHref(queue, search, qualityCase.id)}
                aria-current={selectedCase ? "page" : undefined}
                key={qualityCase.id}
              >
                <span className={styles.qualityQueueTop}>
                  <strong>{qualityCase.summary}</strong>
                  {isOverdueQualityCase(qualityCase, data.loadedAt)
                    ? <StatusBadge tone="danger">Overdue</StatusBadge>
                    : <StatusBadge tone={statusBadgeTone(qualityCase.state)}>{qualityCase.state.replaceAll("_", " ")}</StatusBadge>}
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
              {isOverdueQualityCase(selected, data.loadedAt) ? <StatusBadge tone="danger">Deadline passed</StatusBadge> : null}
              {selected.state === "OPEN" ? (
                <form action={qualityAction} className={styles.qualityInlineActions}>
                  <input type="hidden" name="qualityCaseId" value={selected.id} />
                  <StaffSubmitButton className="app-button-secondary" name="action" value="ASSIGN" pendingLabel="Assigning case…">Assign to me</StaffSubmitButton>
                  <StaffSubmitButton className="app-button-primary" name="action" value="START_REVIEW" pendingLabel="Starting review…">Start review</StaffSubmitButton>
                </form>
              ) : selected.state === "RESOLVED" && selected.reviewRequestState === "ELIGIBLE" ? (
                <form action={qualityAction}>
                  <input type="hidden" name="qualityCaseId" value={selected.id} />
                  <StaffSubmitButton className="app-button-primary" name="action" value="REQUEST_REVIEW" pendingLabel="Requesting review…">Request customer review</StaffSubmitButton>
                </form>
              ) : null}
            </div>
          </header>

          <section className={styles.qualityMetrics} aria-label="Quality case summary">
            <div><span>Feedback</span><strong>{selected.feedbackScore !== undefined ? `${selected.feedbackScore}/5` : "—"}</strong></div>
            <div><span>Owner</span><strong>{selected.ownerUserId ? "Assigned" : "Unassigned"}</strong></div>
            <div><span>Deadline</span><strong>{formatWhen(selected.dueAt, data.workspace.timezone)}</strong>
              {isOverdueQualityCase(selected, data.loadedAt) ? <small>Overdue as of snapshot</small> : null}</div>
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
                <StaffSubmitButton className="app-button-primary" name="action" value="RESOLVE" pendingLabel="Resolving case…">Resolve case</StaffSubmitButton>
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

const workflowEventTypes = [
  "REQUEST_CREATED",
  "QUOTE_ACCEPTED",
  "VISIT_COMPLETED",
  "INVOICE_PAID",
  "ATTENTION_OPENED",
] as const;

type OperationalWorkflowEventType = typeof workflowEventTypes[number];

const workflowFieldsByEvent: Record<OperationalWorkflowEventType, readonly string[]> = {
  REQUEST_CREATED: ["request.serviceCode", "request.leadSource", "request.branchCode"],
  QUOTE_ACCEPTED: ["quote.currency", "quote.branchCode", "request.serviceCode"],
  VISIT_COMPLETED: ["visit.branchCode", "request.serviceCode", "visit.hasIncident"],
  INVOICE_PAID: ["invoice.currency", "invoice.branchCode", "request.serviceCode"],
  ATTENTION_OPENED: ["attention.type", "attention.severity", "attention.branchCode"],
};

function workflowSyntheticValue(field: string, raw: string): string | boolean {
  if (field === "visit.hasIncident") return raw.trim().toLowerCase() === "true";
  return raw.trim();
}

function WorkflowPreviewFields({ eventType }: { eventType: OperationalWorkflowEventType }) {
  return (
    <div className={styles.workflowPreviewFields}>
      {workflowFieldsByEvent[eventType].map((field) => (
        <label key={field}>
          <span>{field}</span>
          {field === "visit.hasIncident" ? (
            <select className="app-input" name={field} defaultValue="false">
              <option value="false">false</option>
              <option value="true">true</option>
            </select>
          ) : (
            <input className="app-input" name={field} maxLength={160} placeholder="Synthetic value" />
          )}
        </label>
      ))}
    </div>
  );
}

function WorkflowBuilderPanel({
  data,
  workspaceSlug,
  automationTemplate,
}: {
  data: OperationalStaffSnapshot;
  workspaceSlug: string;
  automationTemplate?: string;
}) {
  const rules = data.workflowRules ?? [];
  const versions = data.workflowRuleVersions ?? [];
  const executions = data.workflowExecutions ?? [];
  const actionExecutions = data.workflowActionExecutions ?? [];
  const branchScope = data.branchScope;
  const editorBranches = branchScope?.mode === "BRANCH"
    ? (branchScope.branches ?? []).filter((branch) => branch.id === branchScope.selectedBranchId)
    : branchScope?.branches ?? [];
  // Workflow authoring RPCs are service_role-only in migration 0055.
  // QA_SESSION_RLS must not display a control which cannot safely persist.
  const workflowBackendWritable = operationalDatabaseMode() === "SERVICE_ROLE";
  const ownerCanEdit = data.actor.role === "OWNER" && editorBranches.length > 0 && workflowBackendWritable;
  const playbook = getAutomationPlaybook(automationTemplate);

  async function runSavedOperationalEventAction(formData: FormData) {
    "use server";
    const selected = String(formData.get("savedEvent") ?? "");
    const parts = selected.split("|");
    if (parts.length !== 2 || !["QUOTE_ACCEPTED", "VISIT_COMPLETED", "INVOICE_PAID", "ATTENTION_OPENED"].includes(parts[0])) {
      actionRedirect(workspaceSlug, "automations", {ok:false,message:"Choose a saved, eligible milestone event."});
    }
    const outcome = await runOwnerSavedOperationalAutomation(
      workspaceSlug, parts[0] as OwnerOperationalEventType, parts[1],
    );
    const result: OperationalActionResult = outcome.ok
      ? {ok:true,message:`Persisted ${outcome.value.eventType} rule check: ${outcome.value.matchedExecutions} matched; ${outcome.value.completedAttentionActions} internal actions verified; ${outcome.value.reusedRuleExecutions} replayed. External delivery still requires separate owner approval.`}
      : {ok:false,message:outcome.message};
    actionRedirect(workspaceSlug,"automations",result);
  }

  const approvedQuoteEvents = data.quotes.filter(q => q.status === "ACCEPTED").slice(0,50);
  const completedVisitEvents = data.visits.filter(v => v.status === "COMPLETED").slice(0,50);
  const paidInvoiceEvents = data.invoices.filter(i => i.status === "PAID").slice(0,50);
  const requestExceptionEvents = data.attentionItems
    .filter(item => item.status === "OPEN" && item.resourceType.toLowerCase() === "request").slice(0,50);
  const savedEligibleEventCount = approvedQuoteEvents.length + completedVisitEvents.length +
    paidInvoiceEvents.length + requestExceptionEvents.length;


  async function saveDraftAction(formData: FormData) {
    "use server";
    const rawEvent = String(formData.get("eventType") ?? "");
    if (!workflowEventTypes.includes(rawEvent as OperationalWorkflowEventType)) {
      actionRedirect(workspaceSlug, "automations", { ok: false, message: "Unsupported workflow event." });
    }
    const eventType = rawEvent as OperationalWorkflowEventType;
    const target = String(formData.get("ruleTarget") ?? "NEW");
    const [ruleId, expectedVersionText] = target === "NEW" ? ["", ""] : target.split("|");
    const conditions: Array<{ field: string; operator: "EQ" | "NEQ" | "IN"; value: unknown }> = [];
    for (let index = 1; index <= 3; index += 1) {
      const field = String(formData.get(`condition${index}Field`) ?? "").trim();
      if (!field) continue;
      const operatorRaw = String(formData.get(`condition${index}Operator`) ?? "EQ");
      const operator = operatorRaw === "NEQ" || operatorRaw === "IN" ? operatorRaw : "EQ";
      const rawValue = String(formData.get(`condition${index}Value`) ?? "").trim();
      const value = operator === "IN"
        ? rawValue.split(",").map((item) => workflowSyntheticValue(field, item)).filter((item) => item !== "")
        : workflowSyntheticValue(field, rawValue);
      conditions.push({ field, operator, value });
    }

    const actions: Array<Record<string, unknown>> = [];
    for (let index = 1; index <= 3; index += 1) {
      const type = String(formData.get(`action${index}Type`) ?? "NONE");
      if (type === "NONE") continue;
      const detail = String(formData.get(`action${index}Detail`) ?? "").trim();
      if (type === "CREATE_ATTENTION") {
        const severityRaw = String(formData.get(`action${index}Severity`) ?? "WARNING");
        const severity = severityRaw === "INFO" || severityRaw === "CRITICAL" ? severityRaw : "WARNING";
        actions.push({ type, severity, summaryKey: detail.toUpperCase() });
      } else if (type === "SEND_EMAIL_TEMPLATE" || type === "SEND_WHATSAPP_TEMPLATE") {
        actions.push({ type, templateKey: detail, recipient: "CUSTOMER_PRIMARY" });
      }
    }

    const result = await saveOperationalWorkflowDraft(workspaceSlug, {
      branchId: String(formData.get("branchId") ?? ""),
      ruleId: ruleId || undefined,
      expectedRuleVersion: expectedVersionText ? Number(expectedVersionText) : undefined,
      code: String(formData.get("code") ?? ""),
      name: String(formData.get("name") ?? ""),
      eventType,
      conditions,
      actions,
      maxActionsPerEvent: Math.max(1, actions.length),
    });
    actionRedirect(workspaceSlug, "automations", result);
  }

  async function previewAction(formData: FormData) {
    "use server";
    const rawEvent = String(formData.get("eventType") ?? "");
    if (!workflowEventTypes.includes(rawEvent as OperationalWorkflowEventType)) {
      actionRedirect(workspaceSlug, "automations", { ok: false, message: "Unsupported preview event." });
    }
    const eventType = rawEvent as OperationalWorkflowEventType;
    const snapshot: Record<string, unknown> = {};
    for (const field of workflowFieldsByEvent[eventType]) {
      const raw = String(formData.get(field) ?? "");
      if (field === "visit.hasIncident" || raw.trim()) snapshot[field] = workflowSyntheticValue(field, raw);
    }
    const result = await previewOperationalWorkflowVersion(workspaceSlug, {
      versionId: String(formData.get("versionId") ?? ""),
      branchId: String(formData.get("branchId") ?? ""),
      eventSnapshot: snapshot,
    });
    actionRedirect(workspaceSlug, "automations", result);
  }

  async function publishAction(formData: FormData) {
    "use server";
    const result = await publishOperationalWorkflowVersion(workspaceSlug, {
      versionId: String(formData.get("versionId") ?? ""),
      branchId: String(formData.get("branchId") ?? ""),
    });
    actionRedirect(workspaceSlug, "automations", result);
  }

  async function rollbackAction(formData: FormData) {
    "use server";
    const result = await rollbackOperationalWorkflowRule(workspaceSlug, {
      ruleId: String(formData.get("ruleId") ?? ""),
      branchId: String(formData.get("branchId") ?? ""),
      targetVersionNumber: Number(formData.get("targetVersionNumber") ?? 0),
    });
    actionRedirect(workspaceSlug, "automations", result);
  }

  async function approveAction(formData: FormData) {
    "use server";
    const result = await approveOperationalWorkflowExternalAction(
      workspaceSlug,
      String(formData.get("actionExecutionId") ?? ""),
    );
    actionRedirect(workspaceSlug, "automations", result);
  }

  async function replayAction(formData: FormData) {
    "use server";
    const result = await replayOperationalWorkflowAction(
      workspaceSlug,
      String(formData.get("actionExecutionId") ?? ""),
    );
    actionRedirect(workspaceSlug, "automations", result);
  }

  async function runInternalAction(formData: FormData) {
    "use server";
    const result = await executeOperationalWorkflowAttentionAction(
      workspaceSlug,
      String(formData.get("actionExecutionId") ?? ""),
    );
    actionRedirect(workspaceSlug, "automations", result);
  }

  const latestExecutions = executions.slice(0, 20);

  return (
    <section className={styles.workflowBuilder} aria-label="Configurable workflow builder">
      <header className={styles.workflowBuilderHeader}>
        <div>
          <p className={styles.recoveryEyebrow}>Controlled automation</p>
          <h2>Workflow builder</h2>
          <p>Draft, preview and publish branch-scoped rules from a fixed event → condition → action catalogue.</p>
        </div>
        <div className={styles.workflowSafetyChips}>
          <StatusBadge tone="info">No code / SQL / URLs</StatusBadge>
          <StatusBadge tone="warning">External sends need owner approval</StatusBadge>
          <StatusBadge tone="neutral">Max 5 actions · recursion depth 2</StatusBadge>
        </div>
      </header>

      {data.actor.role === "OWNER" ? (
        <section className={styles.workflowEditorCard} aria-label="Run saved milestone through published automations">
          <h3>Process a saved business milestone</h3>
          <p>Use a real accepted quote, completed visit, paid invoice, or open request-linked exception as a trusted, deduplicated workflow source.
            Only internal attention actions execute here. Customer messages, charges and scheduling are not automatic.</p>
          {!workflowBackendWritable ? (
            <p role="status">Protected workflow execution is not configured in this QA-session environment.</p>
          ) : savedEligibleEventCount === 0 ? (
            <p role="status">No eligible persisted milestones yet. Save and complete a real fictional QA journey first.</p>
          ) : (
            <form action={runSavedOperationalEventAction}>
              <label>
                <span>Saved milestone</span>
                <select className="app-input" name="savedEvent" required defaultValue="">
                  <option value="" disabled>Choose a saved milestone</option>
                  {approvedQuoteEvents.length > 0 ? <optgroup label="Accepted quotes">
                    {approvedQuoteEvents.map(quote =>
                      <option key={quote.id} value={"QUOTE_ACCEPTED|" + quote.id}>Accepted quote · {quote.id.slice(0,8)}</option>)}
                  </optgroup> : null}
                  {completedVisitEvents.length > 0 ? <optgroup label="Completed visits">
                    {completedVisitEvents.map(visit =>
                      <option key={visit.id} value={"VISIT_COMPLETED|" + visit.id}>Completed visit · {visit.id.slice(0,8)}</option>)}
                  </optgroup> : null}
                  {paidInvoiceEvents.length > 0 ? <optgroup label="Paid invoices">
                    {paidInvoiceEvents.map(invoice =>
                      <option key={invoice.id} value={"INVOICE_PAID|" + invoice.id}>Paid invoice · {invoice.id.slice(0,8)}</option>)}
                  </optgroup> : null}
                  {requestExceptionEvents.length > 0 ? <optgroup label="Open request exceptions">
                    {requestExceptionEvents.map(item =>
                      <option key={item.id} value={"ATTENTION_OPENED|" + item.id}>Open exception · {item.type} · {item.id.slice(0,8)}</option>)}
                  </optgroup> : null}
                </select>
              </label>
              <StaffSubmitButton className="app-button-secondary" pendingLabel="Verifying persisted event…">
                Evaluate published rules and verify internal actions
              </StaffSubmitButton>
            </form>
          )}
        </section>
      ) : null}

      <section aria-label="Cleaning automation starter playbooks">
        <p>27 owner-reviewed internal task recipes across intake, quoting, field work, payments and exceptions. Choose a starter, customize its condition, preview it, then publish intentionally.</p>
        {automationPlaybookCategories.map(category => (
          <details key={category} open={category === (playbook?.category ?? "Intake")}>
            <summary><strong>{category}</strong> · {automationPlaybooks.filter(item => item.category === category).length} recipes</summary>
            <nav className={styles.automationPlaybookGrid} aria-label={category + " automation recipes"}>
              {automationPlaybooks.filter(item => item.category === category).map(item => (
                <a key={item.id}
                   className={item.id === playbook?.id ? styles.automationPlaybookSelected : styles.automationPlaybookCard}
                   href={"?template=" + encodeURIComponent(item.id)}
                   aria-current={item.id === playbook?.id ? "true" : undefined}>
                  <strong>{item.name}</strong>
                  <span>{item.description}</span>
                  <small>{item.id === playbook?.id ? "Loaded into draft form" : "Load draft starter"} ↗</small>
                </a>
              ))}
            </nav>
          </details>
        ))}
      </section>
      <p className={styles.automationPlaybookDisclaimer}>
        These starters only prefill a draft. Saving, synthetic preview and owner publication remain separate required steps.
        Only internal attention actions are included; no provider delivery occurs by selecting a starter.
      </p>

      {data.workflowAvailable === false ? (
        <FeedbackBanner
          title="Workflow builder is not available in this environment"
          description="The existing recovery queue remains available. No rule is being simulated or silently executed."
          tone="info"
        />
      ) : (
        <>
          {ownerCanEdit ? (
            <section className={styles.workflowEditorCard}>
              <div className={styles.workflowSectionHeader}>
                <div>
                  <p className={styles.recoverySectionEyebrow}>Rule draft</p>
                  <h3>Create the next immutable draft</h3>
                  <p>Existing rules can receive another draft version; published versions are never edited in place.</p>
                </div>
              </div>
              <form action={saveDraftAction} className={styles.workflowDraftForm}>
                <div className={styles.workflowFormGrid}>
                  <label>
                    <span>Rule</span>
                    <select className="app-input" name="ruleTarget" defaultValue="NEW">
                      <option value="NEW">New rule</option>
                      {rules.map((rule) => (
                        <option key={rule.id} value={rule.id + "|" + rule.version}>
                          {rule.code} · {rule.name} · current v{rule.version}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Branch</span>
                    <select className="app-input" name="branchId" defaultValue={editorBranches[0]?.id} required>
                      {editorBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code} · {branch.name}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Code</span>
                    <input className="app-input" name="code" maxLength={64} placeholder="PAID_JOB_FOLLOWUP" defaultValue={playbook?.code} required />
                  </label>
                  <label>
                    <span>Name</span>
                    <input className="app-input" name="name" maxLength={120} placeholder="Paid job follow-up" defaultValue={playbook?.name} required />
                  </label>
                  <label>
                    <span>Event</span>
                    <select className="app-input" name="eventType" defaultValue={playbook?.eventType ?? "INVOICE_PAID"}>
                      {workflowEventTypes.map((eventType) => <option key={eventType} value={eventType}>{eventType.replaceAll("_", " ")}</option>)}
                    </select>
                  </label>
                </div>

                <div className={styles.workflowBuilderColumns}>
                  <section>
                    <h4>Conditions <small>All conditions must match</small></h4>
                    {[1, 2, 3].map((index) => (
                      <div className={styles.workflowConditionRow} key={index}>
                        <select className="app-input" name={`condition${index}Field`} defaultValue={index === 1 ? playbook?.condition?.field ?? "" : ""}>
                          <option value="">No condition</option>
                          <optgroup label="Request created">
                            <option value="request.serviceCode">request.serviceCode</option>
                            <option value="request.leadSource">request.leadSource</option>
                            <option value="request.branchCode">request.branchCode</option>
                          </optgroup>
                          <optgroup label="Quote accepted">
                            <option value="quote.currency">quote.currency</option>
                            <option value="quote.branchCode">quote.branchCode</option>
                          </optgroup>
                          <optgroup label="Visit completed">
                            <option value="visit.branchCode">visit.branchCode</option>
                            <option value="visit.hasIncident">visit.hasIncident</option>
                          </optgroup>
                          <optgroup label="Invoice paid">
                            <option value="invoice.currency">invoice.currency</option>
                            <option value="invoice.branchCode">invoice.branchCode</option>
                          </optgroup>
                          <optgroup label="Attention opened">
                            <option value="attention.type">attention.type</option>
                            <option value="attention.severity">attention.severity</option>
                            <option value="attention.branchCode">attention.branchCode</option>
                          </optgroup>
                        </select>
                        <select className="app-input" name={`condition${index}Operator`} defaultValue={index === 1 ? playbook?.condition?.operator ?? "EQ" : "EQ"}>
                          <option value="EQ">equals</option>
                          <option value="NEQ">does not equal</option>
                          <option value="IN">is one of</option>
                        </select>
                        <input className="app-input" name={`condition${index}Value`} maxLength={160} placeholder="Value; comma-separate IN values" defaultValue={index === 1 && playbook?.condition ? String(playbook.condition.value) : undefined} />
                      </div>
                    ))}
                  </section>

                  <section>
                    <h4>Actions <small>Fixed catalogue only</small></h4>
                    {[1, 2, 3].map((index) => (
                      <div className={styles.workflowActionRow} key={index}>
                        <select className="app-input" name={`action${index}Type`} defaultValue={index === 1 ? "CREATE_ATTENTION" : "NONE"}>
                          <option value="NONE">No action</option>
                          <option value="CREATE_ATTENTION">Create attention item</option>
                          <option value="SEND_EMAIL_TEMPLATE">Send approved Email template</option>
                          <option value="SEND_WHATSAPP_TEMPLATE">Send approved WhatsApp template</option>
                        </select>
                        <select className="app-input" name={`action${index}Severity`} defaultValue={index === 1 ? playbook?.severity ?? "WARNING" : "WARNING"}>
                          <option value="INFO">Info</option>
                          <option value="WARNING">Warning</option>
                          <option value="CRITICAL">Critical</option>
                        </select>
                        <input className="app-input" name={`action${index}Detail`} maxLength={120} placeholder="Summary key or template key" defaultValue={index === 1 ? playbook?.actionDetail : undefined} required={index === 1} />
                      </div>
                    ))}
                  </section>
                </div>

                <div className={styles.workflowFormFooter}>
                  <p>External template actions are never auto-approved. A later action record must be approved by an owner before delivery can be queued.</p>
                  <StaffSubmitButton className="app-button-primary" pendingLabel="Saving draft…">Save draft version</StaffSubmitButton>
                </div>
              </form>
            </section>
          ) : (
            <FeedbackBanner
              title={data.actor.role === "OWNER" && !workflowBackendWritable ? "Workflow authoring backend not connected" : data.actor.role === "OWNER" ? "Select a branch to edit rules" : "Workflow rules are owner-managed"}
              description={data.actor.role === "OWNER" && !workflowBackendWritable
                ? "This QA-session preview can read workflow history but cannot call the server-restricted rule authoring RPCs. A separately configured authorized service backend is required. No rule has been published."
                : data.actor.role === "OWNER"
                ? "HQ can review all branches, but rule authoring requires one explicit branch scope."
                : "Dispatchers can inspect decisions for their assigned branch but cannot draft, publish, approve external sends or replay failed actions."}
              tone="info"
            />
          )}

          <div className={styles.workflowRulesGrid}>
            {rules.map((rule) => {
              const ruleVersions = versions.filter((version) => version.ruleId === rule.id)
                .sort((left, right) => right.versionNumber - left.versionNumber);
              const draft = ruleVersions.find((version) => version.state === "DRAFT");
              const published = ruleVersions.find((version) => version.state === "PUBLISHED");
              const historical = ruleVersions.filter((version) => version.state === "RETIRED");
              const branch = branchScope?.branches.find((item) => item.id === rule.branchId);
              return (
                <article className={styles.workflowRuleCard} key={rule.id}>
                  <div className={styles.workflowRuleHeader}>
                    <div>
                      <span>{branch?.code ?? "BRANCH"} · {rule.code}</span>
                      <h3>{rule.name}</h3>
                    </div>
                    <StatusBadge tone={rule.status === "ACTIVE" ? "success" : rule.status === "PAUSED" ? "warning" : "neutral"}>{rule.status.toLowerCase()}</StatusBadge>
                  </div>

                  {published ? (
                    <div className={styles.workflowVersionSummary}>
                      <strong>Published v{published.versionNumber}</strong>
                      <span>{published.eventType.replaceAll("_", " ").toLowerCase()} · {published.conditions.length} conditions · {published.actions.length} actions</span>
                    </div>
                  ) : <p className={styles.workflowMuted}>No published version yet.</p>}

                  {draft ? (
                    <section className={styles.workflowDraftPreview}>
                      <div className={styles.workflowVersionSummary}>
                        <strong>Draft v{draft.versionNumber}</strong>
                        <span>{draft.eventType.replaceAll("_", " ").toLowerCase()} · synthetic preview required before publish</span>
                      </div>
                      {ownerCanEdit && editorBranches.some((item) => item.id === draft.branchId) ? (
                        <>
                          <form action={previewAction} className={styles.workflowPreviewForm}>
                            <input type="hidden" name="versionId" value={draft.id} />
                            <input type="hidden" name="branchId" value={draft.branchId} />
                            <input type="hidden" name="eventType" value={draft.eventType} />
                            <WorkflowPreviewFields eventType={draft.eventType} />
                            <StaffSubmitButton className="app-button-secondary" pendingLabel="Running preview…">Run synthetic preview</StaffSubmitButton>
                          </form>
                          <form action={publishAction}>
                            <input type="hidden" name="versionId" value={draft.id} />
                            <input type="hidden" name="branchId" value={draft.branchId} />
                            <StaffSubmitButton className="app-button-primary" pendingLabel="Publishing…">Publish tested draft</StaffSubmitButton>
                          </form>
                        </>
                      ) : null}
                    </section>
                  ) : null}

                  {historical.length > 0 && ownerCanEdit ? (
                    <details className={styles.workflowHistory}>
                      <summary>Rollback targets</summary>
                      <div>
                        {historical.slice(0, 5).map((version) => (
                          <form action={rollbackAction} key={version.id}>
                            <input type="hidden" name="ruleId" value={rule.id} />
                            <input type="hidden" name="branchId" value={rule.branchId} />
                            <input type="hidden" name="targetVersionNumber" value={version.versionNumber} />
                            <StaffSubmitButton className="app-button-secondary" pendingLabel="Publishing version…">Republish v{version.versionNumber} as a new version</StaffSubmitButton>
                          </form>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </article>
              );
            })}
            {rules.length === 0 ? (
              <div className={styles.recoveryClear}>
                <span aria-hidden="true">◇</span>
                <div><strong>No workflow rules yet</strong><p>Create a draft and preview it before publishing. Existing business workflows remain unchanged.</p></div>
              </div>
            ) : null}
          </div>

          <section className={styles.workflowDecisionLog}>
            <div className={styles.workflowSectionHeader}>
              <div>
                <p className={styles.recoverySectionEyebrow}>Decision log</p>
                <h3>Recent workflow decisions</h3>
                <p>Preview and live executions are separate; action attempts remain individually auditable.</p>
              </div>
              <StatusBadge tone="neutral">{latestExecutions.length} shown</StatusBadge>
            </div>

            <div className={styles.workflowExecutionList}>
              {latestExecutions.map((execution) => {
                const rule = rules.find((item) => item.id === execution.ruleId);
                const executionActions = actionExecutions
                  .filter((action) => action.executionId === execution.id)
                  .sort((left, right) => left.actionIndex - right.actionIndex || left.attemptNumber - right.attemptNumber);
                return (
                  <article key={execution.id}>
                    <div className={styles.workflowExecutionHeader}>
                      <div>
                        <strong>{rule?.name ?? "Workflow rule"}</strong>
                        <span>{execution.mode.toLowerCase()} · {execution.eventType.replaceAll("_", " ").toLowerCase()} · depth {execution.recursionDepth}</span>
                      </div>
                      <StatusBadge tone={execution.state === "COMPLETED" ? "success" : execution.state === "PARTIAL_FAILED" ? "danger" : execution.state === "ACTIONS_PENDING" ? "warning" : "neutral"}>
                        {execution.state.replaceAll("_", " ").toLowerCase()}
                      </StatusBadge>
                    </div>
                    <div className={styles.workflowExecutionMeta}>
                      <span>{execution.matched ? "Conditions matched" : "Conditions did not match"}</span>
                      <span>{formatWhen(execution.createdAt, data.workspace.timezone)}</span>
                    </div>
                    {executionActions.length > 0 ? (
                      <div className={styles.workflowActionAttempts}>
                        {executionActions.map((action) => (
                          <div key={action.id}>
                            <span><strong>{action.actionType.replaceAll("_", " ").toLowerCase()}</strong><small>action {action.actionIndex + 1} · attempt {action.attemptNumber}</small></span>
                            <StatusBadge tone={action.state === "SUCCEEDED" ? "success" : action.state === "FAILED" ? "danger" : action.state === "APPROVAL_REQUIRED" ? "warning" : "neutral"}>
                              {action.state.replaceAll("_", " ").toLowerCase()}
                            </StatusBadge>
                            {action.errorCode ? <code>{action.errorCode}</code> : null}
                            <div className={styles.workflowActionControls}>
                              {action.state === "PENDING" && action.actionType === "CREATE_ATTENTION" ? (
                                <form action={runInternalAction}><input type="hidden" name="actionExecutionId" value={action.id} /><StaffSubmitButton className="app-button-secondary" pendingLabel="Running internal action…">Run internal action</StaffSubmitButton></form>
                              ) : null}
                              {action.state === "APPROVAL_REQUIRED" && data.actor.role === "OWNER" ? (
                                <form action={approveAction}><input type="hidden" name="actionExecutionId" value={action.id} /><StaffSubmitButton className="app-button-primary" pendingLabel="Submitting approval…">Approve external send</StaffSubmitButton></form>
                              ) : null}
                              {action.state === "FAILED" && data.actor.role === "OWNER" ? (
                                <form action={replayAction}><input type="hidden" name="actionExecutionId" value={action.id} /><StaffSubmitButton className="app-button-secondary" pendingLabel="Replaying action…">Replay this action only</StaffSubmitButton></form>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
              {latestExecutions.length === 0 ? (
                <div className={styles.recoveryClear}><span aria-hidden="true">◎</span><div><strong>No workflow decisions yet</strong><p>Run a synthetic preview to create the first decision record without any live side effect.</p></div></div>
              ) : null}
            </div>
          </section>
        </>
      )}
    </section>
  );
}

function AutomationsView({ data, workspaceSlug, automationTemplate }: { data: OperationalStaffSnapshot; workspaceSlug: string; automationTemplate?: string }) {
  const openItems = data.attentionItems.filter((item) => item.status !== "RESOLVED");
  if (openItems.length === 0) {
    return (
      <>
        {data.actor.role === "OWNER" ? <OwnerAutomationActivationChecklist data={data} workspaceSlug={workspaceSlug} /> : null}
        <AiOperationsStatus
          workspaceSlug={workspaceSlug}
          publishedRuleCount={(data.workflowRuleVersions ?? []).filter(version => version.state === "PUBLISHED").length}
          allowOwnerModelTest={data.actor.role === "OWNER"}
        />
        {data.actor.role === "OWNER" ? <OwnerQuoteAcceptedAutomationControl workspaceSlug={workspaceSlug} snapshot={data} /> : null}
        <WorkflowEvidenceStrip executions={data.workflowExecutions ?? []} actions={data.workflowActionExecutions ?? []} />
      <WorkflowBuilderPanel data={data} workspaceSlug={workspaceSlug} automationTemplate={automationTemplate} />
        <section className={styles.recoveryWorkspace} aria-label="Operational recovery workspace">
        <header className={styles.recoveryHeader}>
          <div><p className={styles.recoveryEyebrow}>Human recovery</p><h2>Recovery queue</h2><p>Operational exceptions that need a person before workflow can safely continue.</p></div>
        </header>
        <div className={styles.recoveryClear}><span aria-hidden="true">✓</span><div><strong>No recovery work</strong><p>There are no open attention items requiring human intervention.</p></div></div>
        </section>
      </>
    );
  }

  const severityWeight = { CRITICAL: 0, WARNING: 1, INFO: 2 } as const;
  const sorted = [...openItems].sort((left, right) => {
    const severity = severityWeight[left.severity] - severityWeight[right.severity];
    if (severity !== 0) return severity;
    const leftDue = left.dueAt ? Date.parse(left.dueAt) : Number.MAX_SAFE_INTEGER;
    const rightDue = right.dueAt ? Date.parse(right.dueAt) : Number.MAX_SAFE_INTEGER;
    return leftDue - rightDue;
  });
  const critical = openItems.filter((item) => item.severity === "CRITICAL").length;
  const warning = openItems.filter((item) => item.severity === "WARNING").length;
  const unassigned = openItems.filter((item) => !item.ownerUserId).length;
  const now = Date.parse(data.loadedAt);
  const overdue = openItems.filter((item) => item.dueAt && Date.parse(item.dueAt) < now).length;

  return (
    <>
      {data.actor.role === "OWNER" ? <OwnerAutomationActivationChecklist data={data} workspaceSlug={workspaceSlug} /> : null}
      <AiOperationsStatus
          workspaceSlug={workspaceSlug}
          publishedRuleCount={(data.workflowRuleVersions ?? []).filter(version => version.state === "PUBLISHED").length}
          allowOwnerModelTest={data.actor.role === "OWNER"}
        />
      {data.actor.role === "OWNER" ? <OwnerQuoteAcceptedAutomationControl workspaceSlug={workspaceSlug} snapshot={data} /> : null}
      <WorkflowEvidenceStrip executions={data.workflowExecutions ?? []} actions={data.workflowActionExecutions ?? []} />
      <WorkflowBuilderPanel data={data} workspaceSlug={workspaceSlug} automationTemplate={automationTemplate} />
      <section className={styles.recoveryWorkspace} aria-label="Operational recovery workspace">
      <header className={styles.recoveryHeader}>
        <div>
          <p className={styles.recoveryEyebrow}>Human recovery</p>
          <h2>Recovery queue</h2>
          <p>Operational exceptions, failed handoffs and review items that require explicit human action.</p>
        </div>
        <a className="app-button-secondary" href={buildStaffModuleHref(workspaceSlug, "overview")}>Back to overview</a>
      </header>

      <section className={styles.recoveryMetrics} aria-label="Recovery queue summary">
        <div className={critical ? styles.recoveryCriticalMetric : undefined}><span>Critical</span><strong>{critical}</strong><small>Highest priority</small></div>
        <div className={warning ? styles.recoveryWarningMetric : undefined}><span>Warnings</span><strong>{warning}</strong><small>Needs attention</small></div>
        <div className={overdue ? styles.recoveryWarningMetric : undefined}><span>Overdue</span><strong>{overdue}</strong><small>Past due time</small></div>
        <div><span>Unassigned</span><strong>{unassigned}</strong><small>No owner yet</small></div>
      </section>

      <div className={styles.recoveryLayout}>
        <section className={styles.recoveryQueue} aria-labelledby="recovery-queue-heading">
          <div className={styles.recoverySectionHeader}>
            <div><p className={styles.recoverySectionEyebrow}>Priority queue</p><h3 id="recovery-queue-heading">Needs intervention</h3><p>Highest severity and nearest deadline first.</p></div>
            <StatusBadge tone={critical ? "danger" : warning ? "warning" : "info"}>{openItems.length} open</StatusBadge>
          </div>
          <div className={styles.recoveryList}>
            {sorted.map((item) => {
              const href = attentionResourceHref(workspaceSlug, item);
              const pastDue = Boolean(item.dueAt && Date.parse(item.dueAt) < now);
              return (
                <article className={styles.recoveryItem} key={item.id}>
                  <span className={`${styles.recoverySeverity} ${styles[`recoverySeverity_${item.severity.toLowerCase()}`]}`} aria-hidden="true" />
                  <div className={styles.recoveryItemBody}>
                    <div className={styles.recoveryItemTop}>
                      <span>
                        <strong>{item.summary}</strong>
                        <small>{item.type.replaceAll("_", " ").toLowerCase()}</small>
                      </span>
                      <StatusBadge tone={item.severity === "CRITICAL" ? "danger" : item.severity === "WARNING" ? "warning" : "info"}>{item.severity.toLowerCase()}</StatusBadge>
                    </div>
                    <div className={styles.recoveryMeta}>
                      <span><b>Resource</b>{item.resourceType.replaceAll("_", " ").toLowerCase()}</span>
                      <span><b>Owner</b>{item.ownerUserId ? "Assigned" : "Unassigned"}</span>
                      <span className={pastDue ? styles.recoveryPastDue : undefined}><b>Due</b>{item.dueAt ? formatWhen(item.dueAt, data.workspace.timezone) : "No deadline"}</span>
                    </div>
                    <div className={styles.recoveryActionRow}>
                      {href ? <a className="app-button-primary" href={href}>Open related record</a> : <span className={styles.recoveryReferenceOnly}>Reference only · no supported product action</span>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className={styles.recoveryPolicy} aria-label="Recovery policy">
          <div className={styles.recoveryPolicyHeader}><p className={styles.recoverySectionEyebrow}>Safety boundary</p><h3>Recovery remains human-owned</h3></div>
          <p>This queue surfaces persisted operational attention. ServiceDesk does not invent a generic recovery mutation where the domain has no accepted command.</p>
          <div className={styles.recoveryPolicySteps}>
            <div><span>1</span><p><strong>Open the related record</strong><small>Review the persisted customer, job, invoice or quality state.</small></p></div>
            <div><span>2</span><p><strong>Use the domain action</strong><small>Resolve the issue from the product surface that owns that state.</small></p></div>
            <div><span>3</span><p><strong>Keep audit truth intact</strong><small>No hidden “retry everything” action is introduced here.</small></p></div>
          </div>
        </aside>
      </div>
      </section>
    </>
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
          <p className={styles.adminEyebrow}>Performance summary</p>
          <h2>Business performance</h2>
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

      {data.branchComparison ? (
        <section className={styles.branchComparisonPanel} aria-label="HQ branch comparison">
          <div className={styles.adminCardHeader}>
            <div>
              <p className={styles.adminSectionEyebrow}>HQ comparison</p>
              <h3>Branch performance</h3>
              <p>{data.branchComparison.fromDate} – {data.branchComparison.toDate}</p>
            </div>
            <StatusBadge tone="info">{data.branchComparison.rows.length} branches</StatusBadge>
          </div>
          <div className={styles.branchComparisonRows}>
            {data.branchComparison.rows.map((row) => (
              <article key={row.branchId}>
                <div className={styles.branchComparisonIdentity}>
                  <strong>{row.name}</strong>
                  <span>{row.code} · {row.timezone} · {row.currency}</span>
                </div>
                <dl>
                  <div><dt>Requests</dt><dd>{row.requestCount}</dd></div>
                  <div><dt>Visits</dt><dd>{row.scheduledVisitCount}</dd></div>
                  <div><dt>Paid jobs</dt><dd>{row.paidInvoiceCount}</dd></div>
                  <div><dt>Collected</dt><dd>{formatMinorMoney(row.collectedMinor, row.currency)}</dd></div>
                </dl>
                {row.currencyMismatchCount > 0 ? (
                  <StatusBadge tone="warning">{row.currencyMismatchCount} currency mismatch</StatusBadge>
                ) : (
                  <StatusBadge tone="success">Native currency clean</StatusBadge>
                )}
              </article>
            ))}
          </div>
          <div className={styles.attributionDisclosure}>
            <span aria-hidden="true">i</span>
            <p>{data.branchComparison.disclosure}</p>
          </div>
        </section>
      ) : null}

      <section className={styles.attributionPanel} aria-label="Referral attribution">
        <div className={styles.adminCardHeader}>
          <div>
            <p className={styles.adminSectionEyebrow}>Growth attribution</p>
            <h3>Referral → paid job</h3>
          </div>
          <StatusBadge tone={data.referralAttribution ? "info" : "neutral"}>
            {data.referralAttribution ? data.referralAttribution.rows.length + " codes" : "Unavailable"}
          </StatusBadge>
        </div>

        {!data.referralAttribution ? (
          <div className={styles.settingsEmpty}>
            <strong>Referral attribution is not available in this environment</strong>
            <p>The core business report remains available above. No referral conversion claim is being inferred.</p>
          </div>
        ) : data.referralAttribution.rows.length === 0 ? (
          <div className={styles.settingsEmpty}>
            <strong>No referral events in this period</strong>
            <p>Stored referral touches and paid-job conversion events will appear here when recorded.</p>
          </div>
        ) : (
          <div className={styles.attributionRows}>
            {data.referralAttribution.rows.map((row) => (
              <article key={row.referralCodeId}>
                <div>
                  <strong>{row.label}</strong>
                  <span>{row.code} · {row.active ? "active" : "inactive"}</span>
                </div>
                <dl>
                  <div><dt>Touches</dt><dd>{row.touchCount}</dd></div>
                  <div><dt>Paid jobs</dt><dd>{row.paidJobCount}</dd></div>
                  <div><dt>First touch</dt><dd>{formatWhen(row.firstTouchAt, data.workspace.timezone)}</dd></div>
                  <div><dt>Last touch</dt><dd>{formatWhen(row.lastTouchAt, data.workspace.timezone)}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        )}

        <div className={styles.attributionDisclosure}>
          <span aria-hidden="true">i</span>
          <p>
            {data.referralAttribution?.disclosure
              ?? "Attribution is directional, not perfect. ServiceDesk does not claim that a recorded touch caused a paid job."}
          </p>
        </div>
      </section>
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
          <h2>Subscription &amp; usage</h2>
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

  async function firstRunCleaningPricingAction(formData: FormData) {
    "use server";
    const setup = await setupAuthorizedCleaningPricing(workspaceSlug, formData);
    const result: OperationalActionResult = setup.ok
      ? { ok: true, message: "Real cleaning services, owner-entered rates and branch pricing are saved and verified. No customer messages were sent." }
      : { ok: false, message: setup.message };
    actionRedirect(workspaceSlug, "settings", result, "section=services&");
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
    const action =
      raw === "PAUSE" || raw === "RESUME" || raw === "SKIP_NEXT"
        ? raw
        : undefined;
    if (!action) {
      actionRedirect(workspaceSlug, "settings", {
        ok: false,
        message: "Unsupported recurring-service action.",
      });
    }
    const result = await applyOperationalRecurrenceAction(
      workspaceSlug,
      String(formData.get("ruleId") ?? ""),
      action,
    );
    actionRedirect(workspaceSlug, "settings", result);
  }

  async function branchAction(formData: FormData) {
    "use server";
    const result = await upsertOperationalBranch(workspaceSlug, {
      code: String(formData.get("code") ?? ""),
      name: String(formData.get("name") ?? ""),
      timezone: String(formData.get("timezone") ?? ""),
      currency: String(formData.get("currency") ?? ""),
      active: String(formData.get("active") ?? "") === "on",
    });
    actionRedirect(workspaceSlug, "settings", result, "section=branches&");
  }

  async function branchMembershipAction(formData: FormData) {
    "use server";
    const rawStatus = String(formData.get("status") ?? "");
    const status = rawStatus === "REVOKED" ? "REVOKED" : "ACTIVE";
    const result = await setOperationalBranchMembership(workspaceSlug, {
      branchId: String(formData.get("branchId") ?? ""),
      userId: String(formData.get("userId") ?? ""),
      status,
    });
    actionRedirect(workspaceSlug, "settings", result, "section=branches&");
  }

  async function referralCodeAction(formData: FormData) {
    "use server";
    const result = await upsertOperationalReferralCode(workspaceSlug, {
      code: String(formData.get("code") ?? ""),
      label: String(formData.get("label") ?? ""),
      active: String(formData.get("active") ?? "") === "on",
    });
    actionRedirect(workspaceSlug, "settings", result, "section=growth&");
  }

  async function retentionCampaignAction(formData: FormData) {
    "use server";
    const rawChannel = String(formData.get("channel") ?? "");
    const rawPurpose = String(formData.get("purpose") ?? "");
    const rawStatus = String(formData.get("status") ?? "");
    if ((rawChannel !== "EMAIL" && rawChannel !== "WHATSAPP")
        || !["FOLLOW_UP", "REVIEW_REQUEST", "REFERRAL_NUDGE"].includes(rawPurpose)
        || !["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"].includes(rawStatus)) {
      actionRedirect(workspaceSlug, "settings", { ok: false, message: "Campaign settings are invalid." }, "section=growth&");
    }
    const result = await upsertOperationalRetentionCampaign(workspaceSlug, {
      name: String(formData.get("name") ?? ""),
      channel: rawChannel as "EMAIL" | "WHATSAPP",
      purpose: rawPurpose as "FOLLOW_UP" | "REVIEW_REQUEST" | "REFERRAL_NUDGE",
      status: rawStatus as "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED",
      templateKey: String(formData.get("templateKey") ?? "") || undefined,
      subject: String(formData.get("subject") ?? "") || undefined,
      bodyText: String(formData.get("bodyText") ?? ""),
      bodyHtml: String(formData.get("bodyHtml") ?? "") || undefined,
      dailyCap: Number(formData.get("dailyCap") ?? 100),
      perCustomerCap: Number(formData.get("perCustomerCap") ?? 1),
      quietHoursStart: String(formData.get("quietHoursStart") ?? "") || undefined,
      quietHoursEnd: String(formData.get("quietHoursEnd") ?? "") || undefined,
    });
    actionRedirect(workspaceSlug, "settings", result, "section=growth&");
  }

  async function serviceCatalogDelegationAction(formData: FormData) {
    "use server";
    const rawStatus = String(formData.get("status") ?? "");
    const status = rawStatus === "REVOKED" ? "REVOKED" : "ACTIVE";
    const result = await setOperationalServiceCatalogDelegation(workspaceSlug, {
      userId: String(formData.get("userId") ?? ""),
      status,
    });
    actionRedirect(workspaceSlug, "settings", result, "section=governance&");
  }

  async function supportAccessGrantAction(formData: FormData) {
    "use server";
    const rawScope = String(formData.get("scope") ?? "");
    const scope = rawScope === "READ_AUDIT_METADATA" ? "READ_AUDIT_METADATA" : "READ_DIAGNOSTICS";
    const result = await grantOperationalTenantSupportAccess(workspaceSlug, {
      supportSubjectHash: String(formData.get("supportSubjectHash") ?? ""),
      scope,
      reason: String(formData.get("reason") ?? ""),
      durationHours: Number(formData.get("durationHours") ?? 1),
    });
    actionRedirect(workspaceSlug, "settings", result, "section=governance&");
  }

  async function supportAccessRevokeAction(formData: FormData) {
    "use server";
    const result = await revokeOperationalTenantSupportAccess(
      workspaceSlug,
      String(formData.get("grantId") ?? ""),
    );
    actionRedirect(workspaceSlug, "settings", result, "section=governance&");
  }

  const activeServices = data.serviceCatalog.filter((service) => service.active).length;
  const serviceCatalogGrant = (data.governanceCapabilities ?? []).find((grant) =>
    grant.userId === data.actor.userId
    && grant.capability === "SERVICE_CATALOG_MANAGE"
    && grant.status === "ACTIVE");
  const canManageServiceCatalog = data.canManageServiceCatalog === true;
  const activeSupportGrants = (data.supportAccessGrants ?? []).filter((grant) =>
    !grant.revokedAt && Date.parse(grant.expiresAt) > Date.parse(data.loadedAt));
  const activeMembers = snapshot.members.filter((member) => member.active).length;
  const pendingInvitations = snapshot.invitations.filter((invite) => invite.state === "PENDING").length;
  // Internal payment sandbox is test infrastructure, not an externally
  // configured payment gateway. Keep it outside provider-readiness counts.
  const externalIntegrations = data.integrations.filter((integration) => integration.provider !== "PAYMENT");
  const configuredIntegrations = externalIntegrations.filter(
    (integration) => integration.configurationState === "CONFIGURED",
  ).length;
  const releaseReadiness = buildOperationalReleaseReadiness(data.integrations);

  return (
    <section className={styles.settingsWorkspace} aria-label="Workspace settings console">
      <header className={styles.adminPageHeader}>
        <div>
          <p className={styles.adminEyebrow}>Workspace settings console</p>
          <h2>Workspace administration</h2>
          <p>{data.workspace.name} · {data.actor.role.toLowerCase()} access</p>
        </div>
      </header>

      <section className={styles.settingsSummary} aria-label="Workspace configuration summary">
        <div>
          <span>Active services</span>
          <strong>{activeServices}</strong>
        </div>
        <div>
          <span>Active team</span>
          <strong>{activeMembers}</strong>
        </div>
        <div>
          <span>Pending invitations</span>
          <strong>{pendingInvitations}</strong>
        </div>
        <div>
          <span>Configured external integrations</span>
          <strong>{configuredIntegrations}/{externalIntegrations.length}</strong>
        </div>
        <div>
          <span>Release blockers</span>
          <strong>{releaseReadiness.blockingCount}</strong>
        </div>
      </section>

      <div className={styles.settingsLayout}>
        <nav className={styles.settingsNav} aria-label="Settings sections">
          <a href="#services">Services</a>
          <a href="#team">Team & access</a>
          <a href="#branches">Branches</a>
          <a href="#recurrence">Recurring services</a>
          <a href="#growth">Growth & retention</a>
          <a href="#governance">Governance</a>
          <a href="#release-readiness">Release readiness</a>
          <a href="#integrations">Integrations</a>
        </nav>

        <div className={styles.settingsContent}>
          <section className={styles.settingsCard} id="services">
            <div className={styles.settingsSectionHeader}>
              <div>
                <p className={styles.adminSectionEyebrow}>Services</p>
                <h3>Service catalog</h3>
                <p>
                  {canManageServiceCatalog
                    ? "Manage customer-facing service names, availability and manual-review requirements."
                    : "Services currently available to this workspace. Changes require Owner access or an active delegated service-catalog capability."}
                </p>
              </div>
              <StatusBadge tone="neutral">{activeServices} active</StatusBadge>
            </div>

            {data.actor.role === "OWNER" && data.ownerPricingBookProof?.state === "UNAVAILABLE" ? (
              <p role="status">Branch pricing could not be verified. Refresh before changing rates; no setup action is available.</p>
            ) : null}
            {data.actor.role === "OWNER" &&
              availableFirstRunUsdBranches(data.branchScope, data.ownerPricingBookProof).length > 0 ? (
              <OwnerCleaningPricingSetupForm scope={data.branchScope}
                proof={data.ownerPricingBookProof} action={firstRunCleaningPricingAction} />
            ) : null}
            {data.actor.role === "OWNER" && data.ownerPricingBookProof?.state === "VERIFIED" &&
              availableFirstRunUsdBranches(data.branchScope, data.ownerPricingBookProof).length === 0 ? (
              <p role="status">No unconfigured USD branches were found. Existing branch prices are not overwritten by first-run setup.</p>
            ) : null}

            {data.serviceCatalog.length === 0 ? (
              <div className={styles.settingsEmpty}>
                <strong>No services configured</strong>
                <p>Add services during workspace setup before taking new enquiries.</p>
              </div>
            ) : (
              <div className={styles.serviceSettingsList}>
                {data.serviceCatalog.map((service) =>
                  canManageServiceCatalog ? (
                    <form action={serviceCatalogAction} className={styles.serviceSettingRow} key={service.id}>
                      <input type="hidden" name="serviceId" value={service.id} />
                      <input type="hidden" name="expectedUpdatedAt" value={service.updatedAt} />

                      <div className={styles.serviceSettingName}>
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
                        <small>{service.code} · Updated {formatWhen(service.updatedAt, data.workspace.timezone)}</small>
                      </div>

                      <label className={styles.settingToggle}>
                        <input name="active" type="checkbox" defaultChecked={service.active} />
                        <span>
                          <strong>Available</strong>
                          <small>Show for new enquiries.</small>
                        </span>
                      </label>

                      <label className={styles.settingToggle}>
                        <input name="requiresReview" type="checkbox" defaultChecked={service.requiresReview} />
                        <span>
                          <strong>Manual review</strong>
                          <small>Require staff review before confirmation.</small>
                        </span>
                      </label>

                      <StaffSubmitButton className="app-button-primary" pendingLabel="Saving settings…">Save</StaffSubmitButton>
                    </form>
                  ) : (
                    <article className={styles.serviceSettingRow} key={service.id}>
                      <div className={styles.serviceSettingName}>
                        <strong>{service.name}</strong>
                        <small>{service.code}{service.requiresReview ? " · Manual review required" : ""}</small>
                      </div>
                      <StatusBadge tone={service.active ? "success" : "neutral"}>
                        {service.active ? "Available" : "Unavailable"}
                      </StatusBadge>
                    </article>
                  ),
                )}
              </div>
            )}
          </section>

          <section className={styles.settingsCard} id="team">
            <div className={styles.settingsSectionHeader}>
              <div>
                <p className={styles.adminSectionEyebrow}>Access</p>
                <h3>Team & invitations</h3>
                <p>Workspace memberships and invitation state without exposing private credentials.</p>
              </div>
              <StatusBadge tone={pendingInvitations ? "warning" : "neutral"}>
                {pendingInvitations} pending
              </StatusBadge>
            </div>

            <div className={styles.teamColumns}>
              <div>
                <h4>Members</h4>
                <div className={styles.settingsRows}>
                  {snapshot.members.map((member, index) => (
                    <article key={member.userId}>
                      <span className={styles.memberAvatar} aria-hidden="true">{member.role.slice(0, 1)}</span>
                      <span>
                        <strong>{member.role.toLowerCase()}</strong>
                        <small>Workspace member {index + 1}</small>
                      </span>
                      <StatusBadge tone={member.active ? "success" : "neutral"}>
                        {member.active ? "Active" : "Inactive"}
                      </StatusBadge>
                    </article>
                  ))}
                </div>
              </div>

              <div>
                <h4>Invitations</h4>
                {data.actor.role === "OWNER" ? (
                  <TeamInvitationManager
                    workspaceSlug={workspaceSlug}
                    timeZone={data.workspace.timezone}
                    invitations={snapshot.invitations}
                  />
                ) : snapshot.invitations.length === 0 ? (
                  <div className={styles.settingsEmpty}>
                    <strong>No invitations</strong>
                    <p>No team invitations are recorded.</p>
                  </div>
                ) : (
                  <div className={styles.settingsRows}>
                    {snapshot.invitations.map((invite) => (
                      <article key={invite.id}>
                        <span className={styles.memberAvatar} aria-hidden="true">+</span>
                        <span>
                          <strong>{invite.email ?? invite.role.toLowerCase()}</strong>
                          <small>{invite.role.toLowerCase()} · Created {formatWhen(invite.createdAt, data.workspace.timezone)}</small>
                        </span>
                        <StatusBadge tone={invite.state === "PENDING" ? "warning" : invite.state === "ACCEPTED" ? "success" : "neutral"}>
                          {invite.state.toLowerCase()}
                        </StatusBadge>
                      </article>
                    ))}
                  </div>
                )}
                <p className={styles.adminHelp}>Private credentials and invitation tokens are never displayed; invitation token hashes remain server-only.</p>
              </div>
            </div>
          </section>

          <section className={styles.settingsCard} id="branches">
            <div className={styles.settingsSectionHeader}>
              <div>
                <p className={styles.adminSectionEyebrow}>Multi-branch</p>
                <h3>Branches & staff scope</h3>
                <p>Branches are scoped inside this workspace. Owners see every branch; dispatchers and crew require explicit branch assignments.</p>
              </div>
              <StatusBadge tone={data.branchScope?.mode === "LEGACY" ? "neutral" : "info"}>
                {data.branchScope?.mode === "LEGACY" ? "Not migrated" : (data.branchScope?.branches.length ?? 0) + " active"}
              </StatusBadge>
            </div>

            {data.branchScope?.mode === "LEGACY" ? (
              <div className={styles.settingsEmpty}>
                <strong>Branch controls are not available in this environment</strong>
                <p>Existing single-workspace operations continue unchanged until the multi-branch migration is applied.</p>
              </div>
            ) : (
              <div className={styles.branchAdminGrid}>
                <section>
                  <h4>Active branches</h4>
                  <div className={styles.branchAdminRows}>
                    {(data.branchScope?.branches ?? []).map((branch) => (
                      <article key={branch.id}>
                        <div>
                          <strong>{branch.name}</strong>
                          <span>{branch.code} · {branch.timezone} · {branch.currency}</span>
                        </div>
                        <StatusBadge tone={branch.isDefault ? "success" : "neutral"}>
                          {branch.isDefault ? "Default" : "Active"}
                        </StatusBadge>
                      </article>
                    ))}
                  </div>
                </section>

                {data.actor.role === "OWNER" ? (
                  <section>
                    <h4>Add branch</h4>
                    <form action={branchAction} className={styles.growthForm}>
                      <div className={styles.growthFormRow}>
                        <label><span>Code</span><input className="app-input" name="code" placeholder="NORTH" maxLength={40} required /></label>
                        <label><span>Name</span><input className="app-input" name="name" placeholder="North Branch" maxLength={120} required /></label>
                      </div>
                      <div className={styles.growthFormRow}>
                        <label><span>IANA timezone</span><input className="app-input" name="timezone" placeholder="America/New_York" required /></label>
                        <label><span>Currency</span><input className="app-input" name="currency" placeholder="USD" minLength={3} maxLength={3} required /></label>
                      </div>
                      <label className={styles.settingToggle}>
                        <input name="active" type="checkbox" defaultChecked />
                        <span><strong>Active</strong><small>Allow operational records and staff assignments.</small></span>
                      </label>
                      <StaffSubmitButton className="app-button-primary" pendingLabel="Creating branch…">Create branch</StaffSubmitButton>
                    </form>
                  </section>
                ) : null}

                {data.actor.role === "OWNER" ? (
                  <section className={styles.branchAssignments}>
                    <div>
                      <h4>Dispatcher & crew assignments</h4>
                      <p className={styles.adminHelp}>Owners are always company-wide and do not need branch assignments.</p>
                    </div>
                    {snapshot.members.filter((member) => member.active && member.role !== "OWNER").length === 0 ? (
                      <div className={styles.settingsEmpty}><strong>No assignable staff</strong><p>Add an active dispatcher or crew member first.</p></div>
                    ) : (
                      <div className={styles.branchAssignmentRows}>
                        {snapshot.members
                          .filter((member) => member.active && member.role !== "OWNER")
                          .flatMap((member) => (data.branchScope?.branches ?? []).map((branch) => {
                            const assignment = (data.branchAssignments ?? []).find((item) =>
                              item.userId === member.userId && item.branchId === branch.id && item.status === "ACTIVE");
                            return (
                              <form action={branchMembershipAction} key={member.userId + ":" + branch.id}>
                                <input name="userId" type="hidden" value={member.userId} />
                                <input name="branchId" type="hidden" value={branch.id} />
                                <span><strong>{member.role.toLowerCase()}</strong><small>{branch.name} · staff {member.userId.slice(0, 8)}</small></span>
                                <StatusBadge tone={assignment ? "success" : "neutral"}>{assignment ? "Assigned" : "No access"}</StatusBadge>
                                <StaffSubmitButton
                                  className="app-button-secondary"
                                  name="status"
                                  value={assignment ? "REVOKED" : "ACTIVE"}
                                 pendingLabel="Updating membership…">
                                  {assignment ? "Revoke" : "Grant"}
                                </StaffSubmitButton>
                              </form>
                            );
                          }))}
                      </div>
                    )}
                  </section>
                ) : (
                  <div className={styles.integrationProofNote}>
                    <span aria-hidden="true">i</span>
                    <p>Your branch options come from explicit owner-managed assignments. You cannot switch into HQ/all-branch scope.</p>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className={styles.settingsCard} id="recurrence">
            <div className={styles.settingsSectionHeader}>
              <div>
                <p className={styles.adminSectionEyebrow}>Repeat work</p>
                <h3>Recurring services</h3>
                <p>Pause, resume or skip the next occurrence using the existing recurring-service command.</p>
              </div>
              <StatusBadge tone="neutral">{data.recurrenceRules.length} rules</StatusBadge>
            </div>

            {data.recurrenceRules.length === 0 ? (
              <div className={styles.settingsEmpty}>
                <strong>No recurring services</strong>
                <p>Recurring service rules will appear here when they are configured.</p>
              </div>
            ) : (
              <div className={styles.recurrenceSettingsList}>
                {data.recurrenceRules.map((rule) => (
                  <article className={styles.recurrenceSettingRow} key={rule.id}>
                    <div>
                      <strong>{rule.frequency.replaceAll("_", " ").toLowerCase()}</strong>
                      <small>{rule.nextOccurrenceOn ? "Next " + rule.nextOccurrenceOn : "No next occurrence"}</small>
                    </div>
                    <StatusBadge tone={rule.status === "ACTIVE" ? "success" : "neutral"}>
                      {rule.status.replaceAll("_", " ").toLowerCase()}
                    </StatusBadge>
                    <form action={recurrenceAction}>
                      <input type="hidden" name="ruleId" value={rule.id} />
                      {rule.status === "ACTIVE" ? (
                        <div className={styles.settingActions}>
                          <button className="app-button-secondary" name="action" value="PAUSE">Pause</button>
                          <button className="app-button-secondary" name="action" value="SKIP_NEXT">Skip next</button>
                        </div>
                      ) : rule.status === "PAUSED" ? (
                        <button className="app-button-secondary" name="action" value="RESUME">Resume</button>
                      ) : (
                        <span>Completed</span>
                      )}
                    </form>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className={styles.settingsCard} id="growth">
            <div className={styles.settingsSectionHeader}>
              <div>
                <p className={styles.adminSectionEyebrow}>Growth & retention</p>
                <h3>Referral and campaign governance</h3>
                <p>Manage stored referral codes and opt-in retention campaign policy. Creating or editing a campaign never queues a customer message.</p>
              </div>
              <StatusBadge tone={data.retentionAvailable ? "info" : "neutral"}>
                {data.retentionAvailable ? (data.retentionCampaigns ?? []).filter((item) => item.status === "ACTIVE").length + " active campaigns" : "Unavailable"}
              </StatusBadge>
            </div>

            {!data.retentionAvailable ? (
              <div className={styles.settingsEmpty}>
                <strong>Retention governance is not available in this environment</strong>
                <p>Existing operations remain available. No campaign send is being implied or queued.</p>
              </div>
            ) : (
              <>
              <div className={styles.growthSettingsGrid}>
                <section className={styles.growthSettingsPane}>
                  <div>
                    <p className={styles.adminSectionEyebrow}>Referral attribution</p>
                    <h4>Referral codes</h4>
                    <p className={styles.adminHelp}>Codes create stored touch evidence. Reports show directional first/last-touch attribution, not guaranteed causality.</p>
                  </div>

                  {data.actor.role === "OWNER" ? (
                    <form action={referralCodeAction} className={styles.growthForm}>
                      <label>
                        <span>Code</span>
                        <input className="app-input" name="code" placeholder="NEIGHBOR10" maxLength={40} required />
                      </label>
                      <label>
                        <span>Label</span>
                        <input className="app-input" name="label" placeholder="Neighbor referral" maxLength={120} required />
                      </label>
                      <label className={styles.settingToggle}>
                        <input name="active" type="checkbox" defaultChecked />
                        <span><strong>Active</strong><small>Accept new touches for this code.</small></span>
                      </label>
                      <StaffSubmitButton className="app-button-primary" pendingLabel="Saving referral code…">Save referral code</StaffSubmitButton>
                    </form>
                  ) : null}

                  <div className={styles.growthRows}>
                    {(data.referralAttribution?.rows ?? []).map((row) => (
                      <article key={row.referralCodeId}>
                        <span><strong>{row.label}</strong><small>{row.code}</small></span>
                        <span><b>{row.touchCount}</b> touches · <b>{row.paidJobCount}</b> paid jobs</span>
                        <StatusBadge tone={row.active ? "success" : "neutral"}>{row.active ? "Active" : "Inactive"}</StatusBadge>
                      </article>
                    ))}
                    {(data.referralAttribution?.rows ?? []).length === 0 ? (
                      <div className={styles.settingsEmpty}><strong>No referral codes</strong><p>Create a code to begin storing referral touches.</p></div>
                    ) : null}
                  </div>
                </section>

                <section className={styles.growthSettingsPane}>
                  <div>
                    <p className={styles.adminSectionEyebrow}>Retention policy</p>
                    <h4>Campaigns</h4>
                    <p className={styles.adminHelp}>Dispatch rechecks latest opt-in, staff suppression, verified contact, quiet hours and caps after queueing and immediately before provider execution.</p>
                  </div>

                  {data.actor.role === "OWNER" ? (
                    <form action={retentionCampaignAction} className={styles.growthForm}>
                      <label><span>Name</span><input className="app-input" name="name" placeholder="30-day follow-up" maxLength={120} required /></label>
                      <div className={styles.growthFormRow}>
                        <label>
                          <span>Channel</span>
                          <select className="app-input" name="channel" defaultValue="WHATSAPP">
                            <option value="WHATSAPP">WhatsApp</option>
                            <option value="EMAIL">Email</option>
                          </select>
                        </label>
                        <label>
                          <span>Purpose</span>
                          <select className="app-input" name="purpose" defaultValue="FOLLOW_UP">
                            <option value="FOLLOW_UP">Follow-up</option>
                            <option value="REVIEW_REQUEST">Review request</option>
                            <option value="REFERRAL_NUDGE">Referral nudge</option>
                          </select>
                        </label>
                        <label>
                          <span>Status</span>
                          <select className="app-input" name="status" defaultValue="DRAFT">
                            <option value="DRAFT">Draft</option>
                            <option value="ACTIVE">Active</option>
                            <option value="PAUSED">Paused</option>
                          </select>
                        </label>
                      </div>
                      <label><span>Template key (optional)</span><input className="app-input" name="templateKey" maxLength={120} /></label>
                      <label><span>Email subject (required for Email)</span><input className="app-input" name="subject" maxLength={200} /></label>
                      <label><span>Message text</span><textarea className="app-textarea" name="bodyText" maxLength={4000} required /></label>
                      <label><span>Email HTML (required for Email)</span><textarea className="app-textarea" name="bodyHtml" maxLength={12000} /></label>
                      <div className={styles.growthFormRow}>
                        <label><span>Daily cap</span><input className="app-input" name="dailyCap" type="number" min={1} max={10000} defaultValue={100} required /></label>
                        <label><span>Per-customer cap</span><input className="app-input" name="perCustomerCap" type="number" min={1} max={100} defaultValue={1} required /></label>
                      </div>
                      <div className={styles.growthFormRow}>
                        <label><span>Quiet from</span><input className="app-input" name="quietHoursStart" type="time" /></label>
                        <label><span>Quiet until</span><input className="app-input" name="quietHoursEnd" type="time" /></label>
                      </div>
                      <StaffSubmitButton className="app-button-primary" pendingLabel="Saving campaign…">Save campaign policy</StaffSubmitButton>
                    </form>
                  ) : null}

                  <div className={styles.growthRows}>
                    {(data.retentionCampaigns ?? []).map((campaign) => (
                      <article key={campaign.id}>
                        <span><strong>{campaign.name}</strong><small>{campaign.channel.toLowerCase()} · {campaign.purpose.replaceAll("_", " ").toLowerCase()}</small></span>
                        <span><b>{campaign.dailyCap}</b>/day · <b>{campaign.perCustomerCap}</b>/customer</span>
                        <StatusBadge tone={campaign.status === "ACTIVE" ? "success" : campaign.status === "PAUSED" ? "warning" : "neutral"}>
                          {campaign.status.toLowerCase()}
                        </StatusBadge>
                      </article>
                    ))}
                    {(data.retentionCampaigns ?? []).length === 0 ? (
                      <div className={styles.settingsEmpty}><strong>No campaigns</strong><p>Create a draft policy before any retention message can be queued.</p></div>
                    ) : null}
                  </div>
                </section>
              </div>

              <div className={styles.integrationProofNote}>
                <span aria-hidden="true">i</span>
                <p><strong>Saved policy is not a send.</strong> No customer message is queued from this screen. Provider delivery remains separately configured and evidenced.</p>
              </div>
              </>
            )}
          </section>

          <section className={styles.settingsCard} id="governance">
            <div className={styles.settingsSectionHeader}>
              <div>
                <p className={styles.adminSectionEyebrow}>Enterprise governance</p>
                <h3>Vertical packs, delegated operations & support access</h3>
                <p>Governance extends the existing tenant boundary. It does not create a second supported vertical, bypass branch scope, or expose unrestricted support access.</p>
              </div>
              <StatusBadge tone={data.governanceAvailable && data.verticalPackAvailable ? "info" : "neutral"}>
                {data.governanceAvailable && data.verticalPackAvailable ? "Governed" : "Unavailable"}
              </StatusBadge>
            </div>

            {!data.verticalPackAvailable ? (
              <div className={styles.settingsEmpty}>
                <strong>Vertical-pack governance is not available in this environment</strong>
                <p>Existing cleaning operations continue unchanged until the 2D.3 governance migration is applied.</p>
              </div>
            ) : (
              <div className={styles.governanceGrid}>
                <section className={styles.governancePane}>
                  <div>
                    <p className={styles.adminSectionEyebrow}>Vertical packs</p>
                    <h4>Supported operating model</h4>
                    <p className={styles.adminHelp}>Pack versions isolate service/intake/checklist/pricing policy from the shared contract, payment and tenant core.</p>
                  </div>

                  <div className={styles.governanceRows}>
                    {(data.verticalPacks ?? []).map((pack) => (
                      <article key={pack.packCode}>
                        <span>
                          <strong>{pack.packCode === "CLEANING" ? "Cleaning operations" : pack.packCode.replaceAll("_", " ").toLowerCase()}</strong>
                          <small>v{pack.versionNumber} · {pack.durationAdapterKey} · {pack.pricingAdapterKey}</small>
                        </span>
                        <StatusBadge tone={pack.status === "ENABLED" ? "success" : "neutral"}>
                          {pack.status.toLowerCase()}
                        </StatusBadge>
                      </article>
                    ))}
                  </div>

                  <FeedbackBanner
                    title="Second vertical rollout is buyer-evidence blocked"
                    description="The roadmap requires two real buyers sharing the same operating model before another vertical is released. Cleaning is the only enabled pack here; no property-maintenance or detailing support is being claimed."
                    tone="warning"
                  />
                </section>

                <section className={styles.governancePane}>
                  <div>
                    <p className={styles.adminSectionEyebrow}>Delegated operations</p>
                    <h4>Service-catalog management</h4>
                    <p className={styles.adminHelp}>An Owner may delegate only service-catalog management to an active dispatcher who is already assigned to every active branch. The catalog is workspace-wide; delegation does not grant Owner access or bypass tenant scope.</p>
                  </div>

                  {data.actor.role === "OWNER" ? (
                    <div className={styles.governanceRows}>
                      {snapshot.members.filter((member) => member.active && member.role === "DISPATCHER").map((member, index) => {
                        const grant = (data.governanceCapabilities ?? []).find((item) =>
                          item.userId === member.userId
                          && item.capability === "SERVICE_CATALOG_MANAGE"
                          && item.status === "ACTIVE"
                          && (!item.expiresAt || Date.parse(item.expiresAt) > Date.parse(data.loadedAt)));
                        const activeBranchIds = new Set(
                          (data.branchAssignments ?? [])
                            .filter((assignment) => assignment.userId === member.userId && assignment.status === "ACTIVE")
                            .map((assignment) => assignment.branchId),
                        );
                        const allBranchEligible = data.branchScope?.mode === "LEGACY"
                          || (data.branchScope?.branches ?? []).every((branch) => activeBranchIds.has(branch.id));
                        return (
                          <article key={member.userId}>
                            <span>
                              <strong>Dispatcher {index + 1}</strong>
                              <small>
                                {grant
                                  ? allBranchEligible
                                    ? "Service-catalog delegation effective across all active branches"
                                    : "Grant stored · inactive until assigned to every active branch"
                                  : allBranchEligible
                                    ? "Eligible for workspace-wide catalog delegation"
                                    : "Assign every active branch before delegation"}
                              </small>
                            </span>
                            <form action={serviceCatalogDelegationAction}>
                              <input name="userId" type="hidden" value={member.userId} />
                              <StaffSubmitButton
                                className="app-button-secondary"
                                disabled={!grant && !allBranchEligible}
                                name="status"
                                value={grant ? "REVOKED" : "ACTIVE"}
                               pendingLabel="Updating delegation…">
                                {grant ? "Revoke delegation" : "Delegate catalog"}
                              </StaffSubmitButton>
                            </form>
                          </article>
                        );
                      })}
                      {snapshot.members.filter((member) => member.active && member.role === "DISPATCHER").length === 0 ? (
                        <div className={styles.settingsEmpty}><strong>No dispatchers</strong><p>Add an active dispatcher before delegating service-catalog management.</p></div>
                      ) : null}
                    </div>
                  ) : canManageServiceCatalog && serviceCatalogGrant ? (
                    <div className={styles.integrationProofNote}>
                      <span aria-hidden="true">i</span>
                      <p><strong>Delegated capability effective.</strong> You may edit the workspace-wide service catalog because you are assigned to every active branch. This does not grant Owner access, workflow publishing, audit export, support-access control, or access to another tenant.</p>
                    </div>
                  ) : serviceCatalogGrant ? (
                    <div className={styles.settingsEmpty}>
                      <strong>Delegation temporarily ineffective</strong>
                      <p>The grant is stored, but workspace-wide catalog editing stays blocked until you are assigned to every active branch.</p>
                    </div>
                  ) : (
                    <div className={styles.settingsEmpty}><strong>No delegated governance capability</strong><p>Your dispatcher account retains its normal operational and branch scope.</p></div>
                  )}
                </section>

                <section className={styles.governancePane}>
                  <div>
                    <p className={styles.adminSectionEyebrow}>Tenant support access</p>
                    <h4>Temporary support authorization</h4>
                    <p className={styles.adminHelp}>Owner-approved support authorization is limited to diagnostics or audit metadata and expires within 24 hours. It does not create a support login or session; trusted support tooling must validate the exact subject hash before any read-only access.</p>
                  </div>

                  {data.actor.role === "OWNER" && data.governanceAvailable ? (
                    <>
                      <form action={supportAccessGrantAction} className={styles.growthForm}>
                        <label>
                          <span>Support subject SHA-256</span>
                          <input className="app-input" name="supportSubjectHash" minLength={64} maxLength={64} pattern="[a-fA-F0-9]{64}" required />
                        </label>
                        <div className={styles.growthFormRow}>
                          <label>
                            <span>Read-only scope</span>
                            <select className="app-input" name="scope" defaultValue="READ_DIAGNOSTICS">
                              <option value="READ_DIAGNOSTICS">Diagnostics</option>
                              <option value="READ_AUDIT_METADATA">Audit metadata</option>
                            </select>
                          </label>
                          <label>
                            <span>Duration</span>
                            <select className="app-input" name="durationHours" defaultValue="1">
                              <option value="1">1 hour</option>
                              <option value="4">4 hours</option>
                              <option value="8">8 hours</option>
                              <option value="24">24 hours</option>
                            </select>
                          </label>
                        </div>
                        <label>
                          <span>Reason</span>
                          <input className="app-input" name="reason" minLength={4} maxLength={240} placeholder="Investigate provider delivery issue" required />
                        </label>
                        <StaffSubmitButton className="app-button-primary" pendingLabel="Authorizing…">Authorize temporary read-only scope</StaffSubmitButton>
                      </form>

                      <div className={styles.governanceRows}>
                        {(data.supportAccessGrants ?? []).map((grant) => {
                          const active = !grant.revokedAt && Date.parse(grant.expiresAt) > Date.parse(data.loadedAt);
                          return (
                            <article key={grant.id}>
                              <span>
                                <strong>{grant.scope === "READ_DIAGNOSTICS" ? "Diagnostics" : "Audit metadata"}</strong>
                                <small>subject {grant.subjectHashPrefix}… · expires {formatWhen(grant.expiresAt, data.workspace.timezone)}</small>
                              </span>
                              {active ? (
                                <form action={supportAccessRevokeAction}>
                                  <input name="grantId" type="hidden" value={grant.id} />
                                  <StaffSubmitButton className="app-button-secondary" pendingLabel="Revoking access…">Revoke</StaffSubmitButton>
                                </form>
                              ) : (
                                <StatusBadge tone="neutral">{grant.revokedAt ? "revoked" : "expired"}</StatusBadge>
                              )}
                            </article>
                          );
                        })}
                      </div>
                      <p className={styles.adminHelp}>{activeSupportGrants.length} active temporary support grant{activeSupportGrants.length === 1 ? "" : "s"}.</p>
                    </>
                  ) : (
                    <div className={styles.settingsEmpty}><strong>Owner controlled</strong><p>Temporary support access can be granted and revoked only by a workspace Owner.</p></div>
                  )}
                </section>

                <section className={styles.governancePane}>
                  <div>
                    <p className={styles.adminSectionEyebrow}>Audit export</p>
                    <h4>Metadata-only audit trail</h4>
                    <p className={styles.adminHelp}>The export is Owner-only, limited to a bounded date window, and intentionally excludes before/after payloads that may contain customer data or secrets.</p>
                  </div>
                  {data.actor.role === "OWNER" && data.governanceAvailable ? (
                    <a
                      className="app-button-secondary"
                      href={"/api/governance/audit-export?workspace=" + encodeURIComponent(workspaceSlug) + "&days=7"}
                    >
                      Download last 7 days · CSV
                    </a>
                  ) : (
                    <StatusBadge tone="neutral">Owner only</StatusBadge>
                  )}
                  <div className={styles.integrationProofNote}>
                    <span aria-hidden="true">i</span>
                    <p><strong>Metadata only.</strong> Exported rows include action/resource/time identifiers; audit before/after payloads are deliberately excluded.</p>
                  </div>
                </section>
              </div>
            )}
          </section>

          <section className={styles.settingsCard} id="release-readiness">
            <div className={styles.settingsSectionHeader}>
              <div>
                <p className={styles.adminSectionEyebrow}>Release control</p>
                <h3>V2 release readiness</h3>
                <p>Evidence states are intentionally conservative. Source code, configuration and authored tests never promote browser, provider, migration or buyer evidence by themselves.</p>
              </div>
              <StatusBadge tone={releaseReadiness.productionReleaseReady ? "success" : "warning"}>
                {releaseReadiness.productionReleaseReady ? "Release ready" : releaseReadiness.blockingCount + " blocking"}
              </StatusBadge>
            </div>

            <div className={styles.releaseReadinessGrid}>
              {releaseReadiness.gates.map((gate) => {
                const tone = gate.state === "PROVIDER_VERIFIED" || gate.state === "OPERATIONS_VERIFIED" || gate.state === "CONTRACT_TESTED"
                  ? "success" as const
                  : gate.state === "BUYER_EVIDENCE_BLOCKED"
                    ? "info" as const
                    : "warning" as const;
                return (
                  <article className={styles.releaseReadinessRow} key={gate.id}>
                    <div>
                      <strong>{gate.label}</strong>
                      <p>{gate.note}</p>
                    </div>
                    <div className={styles.releaseReadinessStatus}>
                      <StatusBadge tone={tone}>{gate.state.replaceAll("_", " ").toLowerCase()}</StatusBadge>
                      <span>{gate.blocking ? "release-blocking" : "roadmap / non-blocking"}</span>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className={styles.integrationProofNote}>
              <span aria-hidden="true">i</span>
              <p>
                Current build: <strong>{releaseReadiness.buildSha?.slice(0, 12) ?? "unbound"}</strong>. Receipt values remain server-only.
                Payment stays sandbox/demo only. The second vertical stays buyer-evidence blocked until two real buyers share the same model.
              </p>
            </div>
          </section>

          <section className={styles.settingsCard} id="integrations">
            <div className={styles.settingsSectionHeader}>
              <div>
                <p className={styles.adminSectionEyebrow}>Connections</p>
                <SectionHeader
                  title="Integrations"
                  description="Connection readiness and verification status without exposing credentials."
                />
              </div>
              <StatusBadge tone="neutral">{configuredIntegrations}/{externalIntegrations.length} externally configured</StatusBadge>
            </div>

            <div className={styles.integrationGrid}>
              {data.integrations.map((integration) => {
                const readyForProof = integration.configurationState === "CONFIGURED";
                const providerVerified = integration.verificationState === "PROVIDER_VERIFIED";
                const statusLabel = integration.provider === "PAYMENT"
                  ? "Internal sandbox only"
                  : providerVerified
                    ? "Provider verified"
                    : readyForProof
                      ? "Ready for proof"
                      : integration.configurationState === "PARTIAL"
                        ? "Partial setup"
                        : "Setup required";
                const tone = integration.provider === "PAYMENT" || integration.configurationState === "PARTIAL"
                  ? "warning" as const
                  : providerVerified
                    ? "success" as const
                    : readyForProof
                      ? "info" as const
                      : "neutral" as const;

                return (
                  <article className={styles.integrationCard} key={integration.provider}>
                    <div>
                      <strong>{integration.label}</strong>
                      <StatusBadge tone={tone}>{statusLabel}</StatusBadge>
                    </div>
                    <p>{integration.message}</p>
                    <dl>
                      <div>
                        <dt>Mode</dt>
                        <dd>{integration.mode.toLowerCase()}</dd>
                      </div>
                      <div>
                        <dt>Verification</dt>
                        <dd>{integration.verificationState.replaceAll("_", " ").toLowerCase()}</dd>
                      </div>
                    </dl>
                    {integration.missingConfiguration.length > 0 ? (
                      <small>
                        Still needed: {integration.missingConfiguration
                          .slice(0, 3)
                          .map((item) => item.replaceAll("_", " ").toLowerCase())
                          .join(" · ")}
                        {integration.missingConfiguration.length > 3
                          ? ` · +${integration.missingConfiguration.length - 3} more`
                          : ""}
                      </small>
                    ) : null}
                  </article>
                );
              })}
            </div>

            <div className={styles.integrationProofNote}>
              <span aria-hidden="true">i</span>
              <p>
                <strong>Configuration is not provider verification.</strong>{" "}
                Secret values are never exposed. Non-payment connections remain unverified until controlled external receipts are available. Payments remain an internal sandbox.
              </p>
            </div>
          </section>
        </div>
      </div>
    </section>
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
  selectedQueue?: string,
  searchQuery?: string,
  selectedScheduleQueue?: string,
  selectedJobQueue?: string,
  selectedScheduleFrom?: string,
  selectedScheduleDay?: string,
  selectedQualityQueue?: string,
  qualitySearchQuery?: string,
  selectedInvoiceQueue?: string,
  automationTemplate?: string,
) {
  switch (module) {
    case "inbox":
      return (
        <InboxView
          data={data}
          workspaceSlug={workspaceSlug}
          selectedConversationId={selectedConversationId}
          selectedQueue={selectedQueue}
          searchQuery={searchQuery}
        />
      );
    case "customers":
      return <CustomersView data={data} selectedCustomerId={selectedCustomerId} searchQuery={searchQuery} />;
    case "requests":
      return <RequestsView data={data} workspaceSlug={workspaceSlug} selectedRequestId={selectedRequestId} searchQuery={searchQuery} />;
    case "quotes":
      return <QuotesView data={data} workspaceSlug={workspaceSlug} selectedQuoteId={selectedQuoteId} searchQuery={searchQuery} />;
    case "schedule":
      return <ScheduleView data={data} workspaceSlug={workspaceSlug} selectedScheduleQueue={selectedScheduleQueue} selectedScheduleFrom={selectedScheduleFrom} selectedScheduleDay={selectedScheduleDay} />;
    case "jobs":
      return <JobsView data={data} workspaceSlug={workspaceSlug} selectedJobId={selectedJobId} selectedJobQueue={selectedJobQueue} searchQuery={searchQuery} />;
    case "invoices":
      return <InvoicesView data={data} workspaceSlug={workspaceSlug} selectedInvoiceId={selectedInvoiceId} selectedInvoiceQueue={selectedInvoiceQueue} searchQuery={searchQuery} />;
    case "quality":
      return <QualityView data={data} workspaceSlug={workspaceSlug} selectedQualityCaseId={selectedQualityCaseId} selectedQualityQueue={selectedQualityQueue} qualitySearchQuery={qualitySearchQuery} />;
    case "automations":
      return <AutomationsView data={data} workspaceSlug={workspaceSlug} automationTemplate={automationTemplate} />;
    case "reports":
      return <ReportsView data={data} />;
    case "billing":
      return <BillingView data={data} />;
    case "settings":
      return <SettingsView data={data} workspaceSlug={workspaceSlug} />;
  }
}

const operationalJourney: ReadonlyArray<{ module: OperationalJourneyModule; label: string; countHint: string }> = [
  { module: "inbox", label: "Inbox", countHint: "need reply" },
  { module: "requests", label: "Requests", countHint: "need intake" },
  { module: "quotes", label: "Quotes", countHint: "ready to send" },
  { module: "schedule", label: "Dispatch", countHint: "need crew" },
  { module: "jobs", label: "Jobs", countHint: "underway" },
  { module: "invoices", label: "Invoices", countHint: "open balances" },
];

function OperationalJourneyNav({
  workspace,
  module,
  data,
}: {
  workspace: string;
  module: OperationalProductRouteProps["module"];
  data: OperationalStaffSnapshot;
}) {
  const counts = operationalJourneyCounts(data);
  return (
    <nav className={styles.workflowRail} aria-label="Service workflow shortcuts">
      <span className={styles.workflowRailLabel}>Workflow</span>
      {operationalJourney.map((item) => (
        <a
          href={buildStaffModuleHref(workspace, item.module)}
          aria-current={module === item.module ? "page" : undefined}
          aria-label={counts[item.module]
            ? item.label + ": " + counts[item.module] + " " + item.countHint
            : item.label}
          key={item.module}
        >
          {item.label}
          {counts[item.module] > 0 ? (
            <span className={styles.workflowCount} aria-hidden="true">{counts[item.module]}</span>
          ) : null}
        </a>
      ))}
    </nav>
  );
}

export async function OperationalProductRoute({
  workspaceSlug,
  module,
  selectedConversationId,
  selectedQueue,
  searchQuery,
  selectedScheduleQueue,
  selectedScheduleFrom,
  selectedScheduleDay,
  selectedCustomerId,
  selectedRequestId,
  selectedQuoteId,
  selectedQualityCaseId,
  selectedQualityQueue,
  qualitySearchQuery,
  selectedJobId,
  selectedJobQueue,
  selectedInvoiceId,
  selectedInvoiceQueue,
  automationTemplate,
  invoiceSurface,
  notice,
  error,
}: OperationalProductRouteProps) {
  const result = await loadOperationalStaffSnapshot(workspaceSlug);
  const config = staffModuleConfig[module];

  return (
    <>
      <PageHeader
        eyebrow={config.eyebrow}
        title={config.label}
        description={config.description}
      />

      {result.ok && operationalJourney.some((item) => item.module === module) ? (
        <OperationalJourneyNav workspace={workspaceSlug} module={module} data={result.value} />
      ) : null}

      <Notice notice={notice} error={error} />

      {result.ok ? (
        <>
          {module === "invoices" ? (
            <nav className={styles.invoiceSurfaceNav} aria-label="Invoice workspace views">
              <a href="?surface=customers" aria-current={invoiceSurface === "commercial" ? undefined : "page"}>
                <strong>Customer collections</strong>
                <span>Quote-backed invoices and received payments</span>
              </a>
              <a href="?surface=commercial" aria-current={invoiceSurface === "commercial" ? "page" : undefined}>
                <strong>Commercial accounts</strong>
                <span>Business contracts, tax and account billing</span>
              </a>
            </nav>
          ) : null}
          {module === "invoices" && invoiceSurface === "commercial" ? (
            <CommercialBillingWorkspace workspaceSlug={workspaceSlug} />
          ) : (
            renderModule(module, result.value, workspaceSlug, selectedConversationId, selectedCustomerId, selectedRequestId, selectedQuoteId, selectedQualityCaseId, selectedJobId, selectedInvoiceId, selectedQueue, searchQuery, selectedScheduleQueue, selectedJobQueue, selectedScheduleFrom, selectedScheduleDay, selectedQualityQueue, qualitySearchQuery, selectedInvoiceQueue, automationTemplate)
          )}
        </>
      ) : (
        <Panel>
          <FeedbackBanner
            title={result.kind === "authentication" ? "Staff sign-in required" : "Workspace unavailable"}
            description={result.kind === "authentication"
              ? "Your staff session could not be confirmed. Sign in to access authorized records."
              : "The latest workspace records could not be verified. Retry this read-only view, and check saved records before repeating any action."}
            tone={result.kind === "authentication" ? "warning" : "danger"}
            action={
              result.kind === "authentication" ? (
                <a
                  className="app-button-primary"
                  href={
                    "/auth/sign-in?next=" +
                    encodeURIComponent(
                      "/app/" +
                        encodeURIComponent(workspaceSlug) +
                        "/" +
                        module,
                    )
                  }
                >
                  Sign in
                </a>
              ) : (
                <a className="app-button-secondary" href={buildStaffModuleHref(workspaceSlug, module)}>
                  Retry view
                </a>
              )
            }
          />
        </Panel>
      )}
    </>
  );
}
