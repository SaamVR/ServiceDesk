import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type {
  ActorContext,
  ConversationDTO,
  InvoiceDTO,
  MessageDTO,
  OwnerSettingsSnapshotDTO,
  PlatformBillingSnapshotDTO,
  ReportingSnapshotDTO,
} from "@/contracts";
import { createPostgresConversationFacadeMethods } from "@/server/core/conversation-postgres";
import type { QualityCaseAction } from "@/server/core/facade";
import { createPostgresManualPaymentQualityFacadeMethods } from "@/server/core/manual-quality-postgres";
import type { SupabaseRpcClient } from "@/server/core/payment-application-postgres";
import { createPostgresReportingPlatformFacadeMethods } from "@/server/core/reporting-platform-postgres";
import { createPostgresRequestQuoteCapacityFacadeMethods } from "@/server/core/request-quote-capacity-postgres";
import { createPostgresVisitFieldRuntimeFacadeMethods } from "@/server/core/visit-field-postgres";

type Row = Record<string, unknown>;

export interface OperationalCustomer {
  id: string;
  displayName: string;
  leadSource?: string;
}

export interface OperationalProperty {
  id: string;
  customerId: string;
  label: string;
  address: string;
  serviceNotes?: string;
  accessNotes?: string;
}

export interface OperationalRequest {
  id: string;
  customerId?: string;
  propertyId?: string;
  serviceCode?: string;
  serviceLabel: string;
  status: string;
  bedrooms?: number;
  bathrooms?: number;
  requestedStartAt?: string;
  version: number;
  createdAt?: string;
}

export interface OperationalQuote {
  id: string;
  requestId: string;
  version: number;
  status: string;
  currency: string;
  totalMinor: number;
  depositMinor: number;
  balanceMinor: number;
  durationMinutes: number;
  bufferMinutes: number;
  validUntil?: string;
}

export interface OperationalVisit {
  id: string;
  workspaceId: string;
  requestId: string;
  quoteId: string;
  crewId?: string;
  status: string;
  startAt: string;
  endAt?: string;
  serviceMinutes: number;
  bufferMinutes: number;
  version: number;
}

export interface OperationalInvoice extends InvoiceDTO {
  quoteId?: string;
}

export interface OperationalAttention {
  id: string;
  type: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  status: string;
  resourceType: string;
  resourceId: string;
  ownerUserId?: string;
  dueAt?: string;
  summary: string;
}

export interface OperationalQualityCase {
  id: string;
  visitId: string;
  state: string;
  feedbackScore?: number;
  summary: string;
  ownerUserId?: string;
  dueAt?: string;
  resolutionNote?: string;
  reviewRequestState: string;
  version: number;
}

export interface OperationalRecurrence {
  id: string;
  requestId: string;
  propertyId: string;
  frequency: string;
  status: string;
  nextOccurrenceOn?: string;
}

export interface OperationalStaffSnapshot {
  workspace: { id: string; slug: string; name: string };
  actor: ActorContext;
  customers: OperationalCustomer[];
  properties: OperationalProperty[];
  requests: OperationalRequest[];
  quotes: OperationalQuote[];
  visits: OperationalVisit[];
  invoices: OperationalInvoice[];
  conversations: ConversationDTO[];
  messages: MessageDTO[];
  attentionItems: OperationalAttention[];
  qualityCases: OperationalQualityCase[];
  recurrenceRules: OperationalRecurrence[];
  crews: Array<{ id: string; name: string; active: boolean }>;
  capacitySlots: Array<{ id: string; crewId: string; startAt: string; endAt: string; capacityMinutes: number }>;
  slotHolds: Array<{ id: string; slotId: string; quoteId: string; status: string; expiresAt: string }>;
  visitEvidence: Array<{ id: string; visitId: string; kind: string; capturedAt: string; text?: string }>;
  visitChecklistItems: Array<{ id: string; visitId: string; itemKey: string; completed: boolean; note?: string; version: number }>;
  reporting?: ReportingSnapshotDTO;
  platformBilling?: PlatformBillingSnapshotDTO;
  ownerSettings?: OwnerSettingsSnapshotDTO;
}

export type OperationalRuntimeResult =
  | { ok: true; value: OperationalStaffSnapshot }
  | { ok: false; kind: "configuration" | "authentication" | "authorization" | "not_found" | "server"; message: string };

export type OperationalActionResult = { ok: true; message: string } | { ok: false; message: string };

function safeCoreFailure(
  result: { ok: false; code: string; message: string },
  fallback: string,
): OperationalActionResult {
  if (result.code === "VERSION_CONFLICT") {
    return { ok: false, message: "This record changed since you opened it. Refresh and try again." };
  }
  if (result.code === "FORBIDDEN" || result.code.includes("SCOPE_REQUIRED")) {
    return { ok: false, message: "You do not have permission to perform this action." };
  }
  if (result.code.includes("NOT_FOUND")) {
    return { ok: false, message: "This record is no longer available. Refresh the page." };
  }
  if (result.code.includes("STATE_INVALID") || result.code.includes("NOT_ACCEPTED") || result.code.includes("NOT_SENT")) {
    return { ok: false, message: "This action is no longer available for the current status. Refresh the page." };
  }
  if (result.code.includes("EVIDENCE_REQUIRED")) {
    return { ok: false, message: "Add the required before and after evidence before continuing." };
  }
  if (result.code.includes("ALREADY_HELD")) {
    return { ok: false, message: "That slot was just taken. Choose another available time." };
  }
  return { ok: false, message: fallback };
}

interface ResolvedStaffActor {
  workspace: { id: string; slug: string; name: string };
  actor: ActorContext;
  service: SupabaseClient;
  rpc: SupabaseRpcClient;
}

function textValue(row: Row, key: string): string | undefined {
  const found = row[key];
  return typeof found === "string" && found.length > 0 ? found : undefined;
}

function numberValue(row: Row, key: string, fallback = 0): number {
  const found = row[key];
  return typeof found === "number" && Number.isFinite(found) ? found : fallback;
}

function rows(data: unknown): Row[] {
  return Array.isArray(data)
    ? data.filter((item): item is Row => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function runtimeConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceRoleKey) return undefined;
  return { url, anonKey, serviceRoleKey };
}

async function resolveStaffActor(workspaceSlug: string): Promise<
  { ok: true; value: ResolvedStaffActor } | Extract<OperationalRuntimeResult, { ok: false }>
> {
  const config = runtimeConfig();
  if (!config) {
    return {
      ok: false,
      kind: "configuration",
      message:
        "This workspace is not connected to its production data service yet. Configure the server-side Supabase URL, anonymous key and service-role key before operating live records.",
    };
  }

  const cookieStore = await cookies();
  const auth = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Cookie refresh is owned by the future authentication middleware.
      },
    },
  });

  const { data: authData, error: authError } = await auth.auth.getUser();
  if (authError || !authData.user) {
    return {
      ok: false,
      kind: "authentication",
      message: "Sign in with an active staff account to open this workspace.",
    };
  }

  const service = createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const workspaceResult = await service
    .from("workspaces")
    .select("id,slug,name")
    .eq("slug", workspaceSlug)
    .maybeSingle();

  if (workspaceResult.error) {
    return { ok: false, kind: "server", message: "The workspace could not be loaded from the database." };
  }
  if (!workspaceResult.data) {
    return { ok: false, kind: "not_found", message: "This workspace does not exist." };
  }

  const workspace = workspaceResult.data as { id: string; slug: string; name: string };
  const membershipResult = await service
    .from("memberships")
    .select("role,status")
    .eq("workspace_id", workspace.id)
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (membershipResult.error) {
    return { ok: false, kind: "server", message: "Staff access could not be verified." };
  }

  const membership = membershipResult.data as { role?: string; status?: string } | null;
  if (
    !membership ||
    membership.status !== "ACTIVE" ||
    (membership.role !== "OWNER" && membership.role !== "DISPATCHER")
  ) {
    return {
      ok: false,
      kind: "authorization",
      message: "Your account does not have active owner or dispatcher access to this workspace.",
    };
  }

  const actor: ActorContext = {
    workspaceId: workspace.id,
    userId: authData.user.id,
    role: membership.role,
  };

  return {
    ok: true,
    value: {
      workspace,
      actor,
      service,
      rpc: service as unknown as SupabaseRpcClient,
    },
  };
}

function mapConversation(row: Row, workspaceId: string): ConversationDTO {
  return {
    id: String(row.id),
    workspaceId,
    requestId: textValue(row, "request_id"),
    customerId: textValue(row, "customer_id"),
    channel: String(row.channel) as ConversationDTO["channel"],
    assignedUserId: textValue(row, "assigned_user_id"),
    handoverActive: Boolean(row.handover_active),
    version: numberValue(row, "version", 1),
    lastMessageAt: textValue(row, "last_message_at"),
  };
}

function mapMessage(row: Row, workspaceId: string): MessageDTO {
  return {
    id: String(row.id),
    workspaceId,
    conversationId: String(row.conversation_id),
    direction: String(row.direction) as MessageDTO["direction"],
    senderKind: String(row.sender_kind) as MessageDTO["senderKind"],
    providerMessageId: textValue(row, "provider_message_id"),
    body: textValue(row, "body"),
    mediaReference: row.media_reference as MessageDTO["mediaReference"],
    deliveryState: row.delivery_state as MessageDTO["deliveryState"],
    createdAt: String(row.created_at),
  };
}

function mapInvoice(row: Row, workspaceId: string): OperationalInvoice {
  return {
    id: String(row.id),
    workspaceId,
    quoteId: textValue(row, "quote_id"),
    visitId: textValue(row, "visit_id"),
    status: String(row.status) as InvoiceDTO["status"],
    currency: String(row.currency) as InvoiceDTO["currency"],
    totalMinor: numberValue(row, "total_minor"),
    allocatedMinor: numberValue(row, "allocated_minor"),
    refundedMinor: numberValue(row, "refunded_minor"),
    balanceMinor: numberValue(row, "balance_minor"),
  };
}

export async function loadOperationalStaffSnapshot(workspaceSlug: string): Promise<OperationalRuntimeResult> {
  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return resolved;
  const { workspace, actor, service, rpc } = resolved.value;

  const tableReads = await Promise.all([
    service
      .from("customers")
      .select("*")
      .eq("workspace_id", workspace.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(200),
    service
      .from("properties")
      .select("*")
      .eq("workspace_id", workspace.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(300),
    service.from("service_catalog").select("*").eq("workspace_id", workspace.id).order("code", { ascending: true }).limit(100),
    service.from("requests").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(300),
    service.from("quotes").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(300),
    service.from("visits").select("*").eq("workspace_id", workspace.id).order("starts_at", { ascending: true }).limit(300),
    service.from("invoices").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(300),
    service
      .from("conversations")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("updated_at", { ascending: false })
      .limit(200),
    service.from("messages").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: true }).limit(1000),
    service
      .from("attention_items")
      .select("*")
      .eq("workspace_id", workspace.id)
      .neq("status", "RESOLVED")
      .order("created_at", { ascending: false })
      .limit(300),
    service.from("quality_cases").select("*").eq("workspace_id", workspace.id).order("updated_at", { ascending: false }).limit(300),
    service.from("recurrence_rules").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(100),
    service.from("crews").select("id,name,active").eq("workspace_id", workspace.id).order("name", { ascending: true }).limit(100),
    service.from("capacity_slots").select("*").eq("workspace_id", workspace.id).order("starts_at", { ascending: true }).limit(300),
    service.from("slot_holds").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(300),
    service.from("visit_evidence").select("*").eq("workspace_id", workspace.id).order("captured_at", { ascending: false }).limit(1000),
    service.from("visit_checklist_items").select("*").eq("workspace_id", workspace.id).order("updated_at", { ascending: false }).limit(1000),
  ]);

  const failedRead = tableReads.find((result) => result.error);
  if (failedRead?.error) {
    return { ok: false, kind: "server", message: "Operational records could not be loaded from PostgreSQL." };
  }

  const [
    customerRows,
    propertyRows,
    serviceRows,
    requestRows,
    quoteRows,
    visitRows,
    invoiceRows,
    conversationRows,
    messageRows,
    attentionRows,
    qualityRows,
    recurrenceRows,
    crewRows,
    capacityRows,
    holdRows,
    evidenceRows,
    checklistRows,
  ] = tableReads.map((result) => rows(result.data));

  const serviceById = new Map(serviceRows.map((row) => [String(row.id), row]));
  const customers: OperationalCustomer[] = customerRows.map((row) => ({
    id: String(row.id),
    displayName: textValue(row, "display_name") ?? "Unnamed customer",
    leadSource: textValue(row, "lead_source"),
  }));
  const properties: OperationalProperty[] = propertyRows.map((row) => ({
    id: String(row.id),
    customerId: String(row.customer_id),
    label: textValue(row, "label") ?? "Property",
    address: [textValue(row, "address_line1"), textValue(row, "city"), textValue(row, "postal_code")]
      .filter(Boolean)
      .join(", "),
    serviceNotes: textValue(row, "service_notes"),
    accessNotes: textValue(row, "access_notes"),
  }));
  const requests: OperationalRequest[] = requestRows.map((row) => {
    const serviceRow = row.service_id ? serviceById.get(String(row.service_id)) : undefined;
    return {
      id: String(row.id),
      customerId: textValue(row, "customer_id"),
      propertyId: textValue(row, "property_id"),
      serviceCode: serviceRow ? textValue(serviceRow, "code") : undefined,
      serviceLabel: serviceRow
        ? textValue(serviceRow, "name") ?? textValue(serviceRow, "code") ?? "Service"
        : "Service not selected",
      status: String(row.status),
      bedrooms: typeof row.bedrooms === "number" ? row.bedrooms : undefined,
      bathrooms: typeof row.bathrooms === "number" ? row.bathrooms : undefined,
      requestedStartAt: textValue(row, "requested_start_at"),
      version: numberValue(row, "version", 1),
      createdAt: textValue(row, "created_at"),
    };
  });
  const quotes: OperationalQuote[] = quoteRows.map((row) => ({
    id: String(row.id),
    requestId: String(row.request_id),
    version: numberValue(row, "version", 1),
    status: String(row.status),
    currency: String(row.currency ?? "USD"),
    totalMinor: numberValue(row, "total_minor"),
    depositMinor: numberValue(row, "deposit_minor"),
    balanceMinor: numberValue(row, "balance_minor"),
    durationMinutes: numberValue(row, "duration_minutes"),
    bufferMinutes: numberValue(row, "buffer_minutes"),
    validUntil: textValue(row, "valid_until"),
  }));
  const quoteById = new Map(quotes.map((quote) => [quote.id, quote]));
  const visits: OperationalVisit[] = visitRows.map((row) => {
    const quote = quoteById.get(String(row.quote_id));
    return {
      id: String(row.id),
      workspaceId: workspace.id,
      requestId: String(row.request_id),
      quoteId: String(row.quote_id),
      crewId: textValue(row, "crew_id"),
      status: String(
        row.status === "SCHEDULED" ? "CONFIRMED" : row.status === "NEEDS_REVIEW" ? "PENDING_REVIEW" : row.status,
      ),
      startAt: String(row.starts_at),
      endAt: textValue(row, "ends_at"),
      serviceMinutes: quote?.durationMinutes ?? 0,
      bufferMinutes: quote?.bufferMinutes ?? 0,
      version: numberValue(row, "version", 1),
    };
  });

  const reportingFacade = createPostgresReportingPlatformFacadeMethods(rpc);
  const now = new Date();
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [reportingResult, billingResult, settingsResult] = await Promise.all([
    reportingFacade.readReportingSnapshot(actor, { from, to: now.toISOString() }),
    reportingFacade.readPlatformBillingSnapshot(actor),
    reportingFacade.readOwnerSettingsSnapshot(actor),
  ]);

  return {
    ok: true,
    value: {
      workspace,
      actor,
      customers,
      properties,
      requests,
      quotes,
      visits,
      invoices: invoiceRows.map((row) => mapInvoice(row, workspace.id)),
      conversations: conversationRows.map((row) => mapConversation(row, workspace.id)),
      messages: messageRows.map((row) => mapMessage(row, workspace.id)),
      attentionItems: attentionRows.map((row) => ({
        id: String(row.id),
        type: String(row.type),
        severity: String(row.severity) as OperationalAttention["severity"],
        status: String(row.status),
        resourceType: String(row.resource_type),
        resourceId: String(row.resource_id),
        ownerUserId: textValue(row, "owner_user_id"),
        dueAt: textValue(row, "due_at"),
        summary: String(row.summary ?? "Attention required"),
      })),
      qualityCases: qualityRows.map((row) => ({
        id: String(row.id),
        visitId: String(row.visit_id),
        state: String(row.state),
        feedbackScore: typeof row.feedback_score === "number" ? row.feedback_score : undefined,
        summary: String(row.summary ?? "Quality review required"),
        ownerUserId: textValue(row, "owner_user_id"),
        dueAt: textValue(row, "due_at"),
        resolutionNote: textValue(row, "resolution_note"),
        reviewRequestState: String(row.review_request_state ?? "NOT_ELIGIBLE"),
        version: numberValue(row, "version", 1),
      })),
      recurrenceRules: recurrenceRows.map((row) => ({
        id: String(row.id),
        requestId: String(row.request_id),
        propertyId: String(row.property_id),
        frequency: String(row.frequency),
        status: String(row.status),
        nextOccurrenceOn: textValue(row, "next_occurrence_on"),
      })),
      crews: crewRows.map((row) => ({
        id: String(row.id),
        name: String(row.name ?? "Crew"),
        active: Boolean(row.active),
      })),
      capacitySlots: capacityRows.map((row) => ({
        id: String(row.id),
        crewId: String(row.crew_id),
        startAt: String(row.starts_at),
        endAt: String(row.ends_at),
        capacityMinutes: numberValue(row, "capacity_minutes"),
      })),
      slotHolds: holdRows.map((row) => ({
        id: String(row.id),
        slotId: String(row.slot_id),
        quoteId: String(row.quote_id),
        status: String(row.status),
        expiresAt: String(row.expires_at),
      })),
      visitEvidence: evidenceRows.map((row) => ({
        id: String(row.id),
        visitId: String(row.visit_id),
        kind: String(row.kind),
        capturedAt: String(row.captured_at),
        text: textValue(row, "text"),
      })),
      visitChecklistItems: checklistRows.map((row) => ({
        id: String(row.id),
        visitId: String(row.visit_id),
        itemKey: String(row.item_key),
        completed: Boolean(row.completed),
        note: textValue(row, "note"),
        version: numberValue(row, "version", 1),
      })),
      reporting: reportingResult.ok ? reportingResult.value : undefined,
      platformBilling: billingResult.ok ? billingResult.value : undefined,
      ownerSettings: settingsResult.ok ? settingsResult.value : undefined,
    },
  };
}

async function loadConversationForAction(resolved: ResolvedStaffActor, conversationId: string) {
  return resolved.service
    .from("conversations")
    .select("id,channel,version")
    .eq("workspace_id", resolved.workspace.id)
    .eq("id", conversationId)
    .maybeSingle();
}

export async function toggleInboxHandover(
  workspaceSlug: string,
  conversationId: string,
  active: boolean,
): Promise<OperationalActionResult> {
  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };
  const current = await loadConversationForAction(resolved.value, conversationId);
  if (current.error || !current.data) return { ok: false, message: "The conversation is no longer available." };
  const facade = createPostgresConversationFacadeMethods(resolved.value.rpc);
  const result = await facade.setConversationHandover(
    resolved.value.actor,
    conversationId,
    { active, assignedUserId: active ? resolved.value.actor.userId : undefined },
    {
      idempotencyKey: "handover-" + crypto.randomUUID(),
      now: new Date().toISOString(),
      expectedVersion: Number(current.data.version),
    },
  );
  return result.ok
    ? { ok: true, message: active ? "Human takeover is active." : "Human takeover was released." }
    : safeCoreFailure(result, "Could not update human takeover. Refresh and try again.");
}

export async function enqueueInboxReply(
  workspaceSlug: string,
  conversationId: string,
  body: string,
): Promise<OperationalActionResult> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, message: "Write a reply before sending." };
  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };
  const current = await loadConversationForAction(resolved.value, conversationId);
  if (current.error || !current.data) return { ok: false, message: "The conversation is no longer available." };
  const channel = String(current.data.channel);
  if (channel !== "WHATSAPP" && channel !== "EMAIL") {
    return { ok: false, message: "This conversation channel does not have an outbound reply command." };
  }
  const facade = createPostgresConversationFacadeMethods(resolved.value.rpc);
  const result = await facade.enqueueConversationReply(
    resolved.value.actor,
    conversationId,
    { body: trimmed, channel },
    {
      idempotencyKey: "reply-" + crypto.randomUUID(),
      now: new Date().toISOString(),
      expectedVersion: Number(current.data.version),
    },
  );
  return result.ok
    ? { ok: true, message: "Reply queued. Delivery state will update from provider callbacks." }
    : safeCoreFailure(result, "Could not queue the reply. Check the conversation and try again.");
}

export async function sendOperationalQuote(
  workspaceSlug: string,
  quoteId: string,
): Promise<OperationalActionResult> {
  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };
  const current = await resolved.value.service
    .from("quotes")
    .select("id,status,version")
    .eq("workspace_id", resolved.value.workspace.id)
    .eq("id", quoteId)
    .maybeSingle();
  if (current.error || !current.data) return { ok: false, message: "The quote is no longer available." };
  if (current.data.status !== "APPROVED") return { ok: false, message: "Only an approved quote can be sent." };
  const facade = createPostgresRequestQuoteCapacityFacadeMethods(resolved.value.rpc);
  const result = await facade.sendQuote(resolved.value.actor, quoteId, {
    idempotencyKey: "quote-send-" + crypto.randomUUID(),
    now: new Date().toISOString(),
    expectedVersion: Number(current.data.version),
  });
  return result.ok
    ? { ok: true, message: "Quote send command accepted. Provider delivery remains tracked separately." }
    : safeCoreFailure(result, "Could not send the quote. Refresh the quote and try again.");
}

export async function applyOperationalManualPayment(
  workspaceSlug: string,
  invoiceId: string,
  amountMinor: number,
  method: "CASH" | "BANK_TRANSFER" | "OTHER",
  reference: string,
): Promise<OperationalActionResult> {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    return { ok: false, message: "Enter a valid payment amount." };
  }
  if (!reference.trim()) return { ok: false, message: "A payment reference is required." };
  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };
  const invoice = await resolved.value.service
    .from("invoices")
    .select("id,currency,balance_minor,status")
    .eq("workspace_id", resolved.value.workspace.id)
    .eq("id", invoiceId)
    .maybeSingle();
  if (invoice.error || !invoice.data) return { ok: false, message: "The invoice is no longer available." };
  const facade = createPostgresManualPaymentQualityFacadeMethods(resolved.value.rpc);
  const result = await facade.applyManualPayment(
    resolved.value.actor,
    invoiceId,
    {
      amountMinor,
      currency: String(invoice.data.currency),
      method,
      reference: reference.trim(),
      occurredAt: new Date().toISOString(),
    },
    { idempotencyKey: "manual-payment-" + crypto.randomUUID(), now: new Date().toISOString() },
  );
  return result.ok
    ? { ok: true, message: "Manual payment recorded on the invoice." }
    : safeCoreFailure(result, "Could not record the payment. Check the invoice and try again.");
}

export async function applyOperationalQualityAction(
  workspaceSlug: string,
  qualityCaseId: string,
  action: QualityCaseAction,
  resolutionNote?: string,
): Promise<OperationalActionResult> {
  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };
  const current = await resolved.value.service
    .from("quality_cases")
    .select("id,version")
    .eq("workspace_id", resolved.value.workspace.id)
    .eq("id", qualityCaseId)
    .maybeSingle();
  if (current.error || !current.data) return { ok: false, message: "The quality case is no longer available." };
  if (action === "RESOLVE" && !resolutionNote?.trim()) {
    return { ok: false, message: "Add a resolution note before resolving the case." };
  }
  const facade = createPostgresManualPaymentQualityFacadeMethods(resolved.value.rpc);
  const result = await facade.applyQualityCaseAction(
    resolved.value.actor,
    qualityCaseId,
    action,
    {
      ownerUserId: action === "ASSIGN" ? resolved.value.actor.userId : undefined,
      resolutionNote: resolutionNote?.trim() || undefined,
    },
    {
      idempotencyKey: "quality-" + crypto.randomUUID(),
      now: new Date().toISOString(),
      expectedVersion: Number(current.data.version),
    },
  );
  return result.ok ? { ok: true, message: "Quality case updated." } : safeCoreFailure(result, "Could not update the quality case. Refresh and try again.");
}


export async function calculateOperationalQuote(
  workspaceSlug: string,
  requestId: string,
): Promise<OperationalActionResult> {
  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };
  const facade = createPostgresRequestQuoteCapacityFacadeMethods(resolved.value.rpc);
  const result = await facade.calculateQuote(resolved.value.actor, requestId);
  return result.ok
    ? { ok: true, message: "Quote calculated and saved." }
    : safeCoreFailure(result, "Could not calculate the quote. Check the request details and try again.");
}

export async function holdOperationalSlot(
  workspaceSlug: string,
  quoteId: string,
  slotId: string,
): Promise<OperationalActionResult> {
  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };
  const quote = await resolved.value.service
    .from("quotes")
    .select("id,status,version")
    .eq("workspace_id", resolved.value.workspace.id)
    .eq("id", quoteId)
    .maybeSingle();
  if (quote.error || !quote.data) return { ok: false, message: "The quote is no longer available." };
  if (quote.data.status !== "ACCEPTED") {
    return { ok: false, message: "A slot can be held only after the quote is accepted." };
  }
  const facade = createPostgresRequestQuoteCapacityFacadeMethods(resolved.value.rpc);
  const result = await facade.holdSlot(
    resolved.value.actor,
    slotId,
    quoteId,
    { idempotencyKey: "slot-hold-" + crypto.randomUUID(), now: new Date().toISOString(), expectedVersion: Number(quote.data.version) },
  );
  return result.ok
    ? { ok: true, message: "Slot held until " + result.value.expiresAt + ". Payment is still pending." }
    : safeCoreFailure(result, "Could not hold that slot. Refresh availability and try again.");
}

export async function transitionOperationalVisit(
  workspaceSlug: string,
  visitId: string,
  action: "ASSIGN" | "EN_ROUTE" | "START" | "SUBMIT_REVIEW" | "COMPLETE",
): Promise<OperationalActionResult> {
  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };
  const current = await resolved.value.service
    .from("visits")
    .select("id,version")
    .eq("workspace_id", resolved.value.workspace.id)
    .eq("id", visitId)
    .maybeSingle();
  if (current.error || !current.data) return { ok: false, message: "The visit is no longer available." };
  const facade = createPostgresVisitFieldRuntimeFacadeMethods(resolved.value.rpc);
  const result = await facade.transitionVisit(
    resolved.value.actor,
    visitId,
    action,
    {
      idempotencyKey: "visit-transition-" + crypto.randomUUID(),
      now: new Date().toISOString(),
      expectedVersion: Number(current.data.version),
    },
  );
  return result.ok
    ? { ok: true, message: "Visit moved to " + result.value.status.replaceAll("_", " ").toLowerCase() + "." }
    : safeCoreFailure(result, "Could not update the job status. Refresh the job and try again.");
}


export async function addOperationalVisitNote(
  workspaceSlug: string,
  visitId: string,
  kind: "TIME_MATERIAL_NOTE" | "INCIDENT_NOTE",
  note: string,
): Promise<OperationalActionResult> {
  const trimmed = note.trim();
  if (!trimmed) return { ok: false, message: "Add a note before saving." };
  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };
  const current = await resolved.value.service
    .from("visits")
    .select("id,version")
    .eq("workspace_id", resolved.value.workspace.id)
    .eq("id", visitId)
    .maybeSingle();
  if (current.error || !current.data) return { ok: false, message: "The visit is no longer available." };
  const facade = createPostgresVisitFieldRuntimeFacadeMethods(resolved.value.rpc);
  const result = await facade.addVisitEvidence(
    resolved.value.actor,
    visitId,
    { kind, text: trimmed, capturedAt: new Date().toISOString() },
    {
      idempotencyKey: "visit-note-" + crypto.randomUUID(),
      now: new Date().toISOString(),
      expectedVersion: Number(current.data.version),
    },
  );
  return result.ok ? { ok: true, message: kind === "INCIDENT_NOTE" ? "Incident recorded." : "Job note saved." } : safeCoreFailure(result, "Could not save the field note. Refresh and try again.");
}

export async function setOperationalChecklistItem(
  workspaceSlug: string,
  visitId: string,
  itemKey: string,
  completed: boolean,
  note?: string,
): Promise<OperationalActionResult> {
  const key = itemKey.trim();
  if (!key) return { ok: false, message: "Checklist item name is required." };
  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };
  const current = await resolved.value.service
    .from("visits")
    .select("id,version")
    .eq("workspace_id", resolved.value.workspace.id)
    .eq("id", visitId)
    .maybeSingle();
  if (current.error || !current.data) return { ok: false, message: "The visit is no longer available." };
  const facade = createPostgresVisitFieldRuntimeFacadeMethods(resolved.value.rpc);
  const result = await facade.setVisitChecklistItem(
    resolved.value.actor,
    visitId,
    { itemKey: key, completed, note: note?.trim() || undefined },
    {
      idempotencyKey: "visit-checklist-" + crypto.randomUUID(),
      now: new Date().toISOString(),
      expectedVersion: Number(current.data.version),
    },
  );
  return result.ok ? { ok: true, message: "Checklist updated." } : safeCoreFailure(result, "Could not update the checklist. Refresh and try again.");
}
