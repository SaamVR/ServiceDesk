import { createHash, randomBytes } from "node:crypto";
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
import { createPostgresRecurrenceFacadeMethods } from "@/server/core/recurrence-postgres";
import { createPostgresRequestQuoteCapacityFacadeMethods } from "@/server/core/request-quote-capacity-postgres";
import { createPostgresVisitFieldRuntimeFacadeMethods } from "@/server/core/visit-field-postgres";
import { createPostgresVoiceMissedCallCommandPort } from "@/server/core/voice-missed-call-postgres";
import { buildOperationalIntegrationHealth, type OperationalIntegrationHealth } from "./integration-health-runtime";

type Row = Record<string, unknown>;

export interface OperationalCustomer {
  id: string;
  displayName: string;
  leadSource?: string;
}

export interface OperationalCustomerContact {
  id: string;
  customerId: string;
  kind: "EMAIL" | "PHONE";
  value: string;
  isPrimary: boolean;
  isBilling: boolean;
  verifiedAt?: string;
  identityConflictCount: number;
}

export interface OperationalCommunicationConsent {
  customerId: string;
  channel: "EMAIL" | "WHATSAPP";
  status: "GRANTED" | "REVOKED" | "UNKNOWN";
  purpose: string;
  recordedAt: string;
}

export interface OperationalRetentionControl {
  customerId: string;
  channel: "EMAIL" | "WHATSAPP";
  status: "ACTIVE" | "PAUSED" | "SUPPRESSED";
  reasonCode?: string;
  untilAt?: string;
  version: number;
}

export interface OperationalRetentionCampaign {
  id: string;
  name: string;
  channel: "EMAIL" | "WHATSAPP";
  purpose: "FOLLOW_UP" | "REVIEW_REQUEST" | "REFERRAL_NUDGE";
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED";
  templateKey?: string;
  dailyCap: number;
  perCustomerCap: number;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  version: number;
  updatedAt: string;
}

export interface OperationalReferralAttributionRow {
  referralCodeId: string;
  code: string;
  label: string;
  active: boolean;
  touchCount: number;
  paidJobCount: number;
  firstTouchAt?: string;
  lastTouchAt?: string;
}

export interface OperationalReferralAttributionSummary {
  from: string;
  to: string;
  rows: OperationalReferralAttributionRow[];
  disclosure: string;
}

export interface OperationalBranchSummary {
  id: string;
  code: string;
  name: string;
  timezone: string;
  currency: string;
  active: boolean;
  isDefault: boolean;
  version: number;
}

export interface OperationalBranchAssignment {
  branchId: string;
  userId: string;
  role: "OWNER" | "DISPATCHER" | "CREW";
  active: boolean;
  version: number;
}

export interface OperationalBranchScope {
  available: boolean;
  ownerGlobalAccess: boolean;
  selectedBranchId?: string;
  branches: OperationalBranchSummary[];
  assignments: OperationalBranchAssignment[];
}

export interface OperationalBranchReportRow {
  branchId: string;
  code: string;
  name: string;
  timezone: string;
  currency: string;
  requestCount: number;
  bookedRequestCount: number;
  conversionRateBps?: number;
  collectedMinor: number;
  outstandingMinor: number;
  scheduledServiceMinutes: number;
  scheduledBufferMinutes: number;
  unresolvedQualityCount: number;
  generatedAt?: string;
}

export interface OperationalBranchComparison {
  branches: OperationalBranchReportRow[];
  mixedCurrency: boolean;
  aggregateCurrency?: string;
  aggregateCollectedMinor?: number;
  aggregateOutstandingMinor?: number;
  currencyDisclosure: string;
  generatedAt: string;
}

export interface OperationalProperty {
  id: string;
  customerId: string;
  branchId?: string;
  label: string;
  address: string;
  serviceNotes?: string;
  accessNotes?: string;
}

export interface OperationalRequest {
  id: string;
  customerId?: string;
  branchId?: string;
  propertyId?: string;
  serviceCode?: string;
  serviceLabel: string;
  status: string;
  bedrooms?: number;
  bathrooms?: number;
  requestedStartAt?: string;
  sourceChannel?: string;
  callbackRequired?: boolean;
  callbackContactRef?: string;
  callbackIntakeId?: string;
  callbackState?: "PENDING" | "RESOLVED";
  version: number;
  createdAt?: string;
}

export interface OperationalPhotoAsset {
  id: string;
  requestId: string;
  source: "CUSTOMER_UPLOAD" | "WHATSAPP_MEDIA_REFERENCE";
  contentType: "image/jpeg" | "image/png" | "image/webp";
  byteSize: number;
  consentStatus: "GRANTED" | "REVOKED";
  processingOptOut: boolean;
  retentionUntil: string;
  state: "AVAILABLE" | "RETIRED" | "DELETED";
  version: number;
  createdAt: string;
}

export interface OperationalPhotoSuggestion {
  id: string;
  requestId: string;
  photoAssetId: string;
  classifierRef: string;
  categoryCode: string;
  proposedAddOnCode?: string;
  confidenceBasisPoints: number;
  rationale?: string;
  followUpQuestions: string[];
  state: "PENDING_REVIEW" | "ACCEPTED" | "REJECTED" | "EXPIRED";
  version: number;
  generatedAt: string;
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
  branchId?: string;
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
  version: number;
}

export interface OperationalServiceCatalogItem {
  id: string;
  code: string;
  name: string;
  active: boolean;
  requiresReview: boolean;
  updatedAt: string;
}

export interface OperationalStaffSnapshot {
  loadedAt: string;
  workspace: { id: string; slug: string; name: string; timezone: string };
  actor: ActorContext;
  branchScope?: OperationalBranchScope;
  branchComparison?: OperationalBranchComparison;
  customers: OperationalCustomer[];
  customerContacts?: OperationalCustomerContact[];
  communicationConsents?: OperationalCommunicationConsent[];
  retentionControls?: OperationalRetentionControl[];
  retentionCampaigns?: OperationalRetentionCampaign[];
  retentionAvailable?: boolean;
  referralAttribution?: OperationalReferralAttributionSummary;
  properties: OperationalProperty[];
  requests: OperationalRequest[];
  quotes: OperationalQuote[];
  photoReviewAvailable?: boolean;
  photoAssets?: OperationalPhotoAsset[];
  photoSuggestions?: OperationalPhotoSuggestion[];
  visits: OperationalVisit[];
  invoices: OperationalInvoice[];
  conversations: ConversationDTO[];
  messages: MessageDTO[];
  attentionItems: OperationalAttention[];
  qualityCases: OperationalQualityCase[];
  recurrenceRules: OperationalRecurrence[];
  serviceCatalog: OperationalServiceCatalogItem[];
  integrations: OperationalIntegrationHealth[];
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

export type OperationalInvitationActionResult =
  | { ok: true; message: string; invitePath: string }
  | { ok: false; message: string };

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
  if (result.code === "SCHEDULE_CONFLICT" || result.code === "CREW_SCHEDULE_CONFLICT") {
    return { ok: false, message: "That crew now has an overlapping job. Refresh dispatch suggestions." };
  }
  if (result.code === "CREW_UNAVAILABLE" || result.code === "CREW_NOT_AVAILABLE" || result.code === "CREW_NOT_FOUND") {
    return { ok: false, message: "That crew is no longer available for this assignment." };
  }
  return { ok: false, message: fallback };
}

export interface ResolvedStaffActor {
  workspace: { id: string; slug: string; name: string; timezone: string };
  actor: ActorContext;
  service: SupabaseClient;
  rpc: SupabaseRpcClient;
  branchScope: OperationalBranchScope;
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

function branchCookieName(workspaceSlug: string): string {
  return "servicedesk_branch_" + workspaceSlug.toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 80);
}

function mapBranchScopeRow(value: unknown): OperationalBranchSummary | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row = value as Row;
  const id = textValue(row, "id");
  const code = textValue(row, "code");
  const name = textValue(row, "name");
  const timezone = textValue(row, "timezone");
  const currency = textValue(row, "currency");
  if (!id || !code || !name || !timezone || !currency) return undefined;
  return {
    id,
    code,
    name,
    timezone,
    currency,
    active: row.active === true,
    isDefault: row.isDefault === true,
    version: numberValue(row, "version", 1),
  };
}

async function resolveBranchScope(
  rpc: SupabaseRpcClient,
  workspace: { id: string; slug: string },
  actor: ActorContext,
  requestedBranchId?: string,
): Promise<OperationalBranchScope> {
  const result = await rpc.rpc<Row>("servicedesk_read_branch_access_snapshot", {
    p_input: {
      workspaceId: workspace.id,
      actorUserId: actor.userId,
      actorRole: actor.role,
    },
  });

  if (result.error || !result.data || result.data.ok !== true) {
    return { available: false, ownerGlobalAccess: actor.role === "OWNER", branches: [], assignments: [] };
  }

  const snapshot = result.data.snapshot && typeof result.data.snapshot === "object" && !Array.isArray(result.data.snapshot)
    ? result.data.snapshot as Row
    : undefined;
  const branches = snapshot && Array.isArray(snapshot.branches)
    ? snapshot.branches.map(mapBranchScopeRow).filter((value): value is OperationalBranchSummary => Boolean(value))
    : [];
  const assignments: OperationalBranchAssignment[] = snapshot && Array.isArray(snapshot.assignments)
    ? snapshot.assignments.flatMap((value) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return [];
        const row = value as Row;
        const branchId = textValue(row, "branchId");
        const userId = textValue(row, "userId");
        const role = textValue(row, "role");
        if (!branchId || !userId || (role !== "OWNER" && role !== "DISPATCHER" && role !== "CREW")) return [];
        return [{
          branchId,
          userId,
          role,
          active: row.active === true,
          version: numberValue(row, "version", 1),
        }];
      })
    : [];
  const active = branches.filter((item) => item.active);
  const requested = requestedBranchId
    ? active.find((item) => item.id === requestedBranchId)
    : undefined;
  const ownerGlobalAccess = snapshot?.ownerGlobalAccess === true;

  if (ownerGlobalAccess) {
    return {
      available: true,
      ownerGlobalAccess: true,
      selectedBranchId: requested?.id,
      branches,
      assignments,
    };
  }

  const selected = requested
    ?? active.find((item) => item.isDefault)
    ?? active[0];

  return {
    available: true,
    ownerGlobalAccess: false,
    selectedBranchId: selected?.id,
    branches,
    assignments,
  };
}

function branchContextAllows(
  scope: OperationalBranchScope,
  branchId: string | undefined,
): boolean {
  if (!scope.available) return true;
  if (!branchId) return false;
  if (scope.selectedBranchId) return branchId === scope.selectedBranchId;
  return scope.ownerGlobalAccess && scope.branches.some((branch) => branch.active && branch.id === branchId);
}

export async function resolveStaffActor(workspaceSlug: string): Promise<
  { ok: true; value: ResolvedStaffActor } | Extract<OperationalRuntimeResult, { ok: false }>
> {
  const config = runtimeConfig();
  if (!config) {
    return {
      ok: false,
      kind: "configuration",
      message:
        "Workspace data is temporarily unavailable. Check the workspace connection in Settings or try again shortly.",
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
    .select("id,slug,name,timezone")
    .eq("slug", workspaceSlug)
    .maybeSingle();

  if (workspaceResult.error) {
    return { ok: false, kind: "server", message: "The workspace could not be loaded from the database." };
  }
  if (!workspaceResult.data) {
    return { ok: false, kind: "not_found", message: "This workspace does not exist." };
  }

  const workspace = workspaceResult.data as { id: string; slug: string; name: string; timezone: string };
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

  const rpc = service as unknown as SupabaseRpcClient;
  const requestedBranchId = cookieStore.get(branchCookieName(workspaceSlug))?.value;
  const branchScope = await resolveBranchScope(rpc, workspace, actor, requestedBranchId);

  if (
    branchScope.available
    && !branchScope.ownerGlobalAccess
    && !branchScope.selectedBranchId
  ) {
    return {
      ok: false,
      kind: "authorization",
      message: "Your staff account is not assigned to an active branch.",
    };
  }

  return {
    ok: true,
    value: {
      workspace,
      actor,
      service,
      rpc,
      branchScope,
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
  const { workspace, actor, service, rpc, branchScope } = resolved.value;

  const tableReads = await Promise.all([
    service
      .from("customers")
      .select("*")
      .eq("workspace_id", workspace.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(200),
    service
      .from("customer_contacts")
      .select("id,customer_id,kind,value,is_primary,is_billing,verified_at,created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: true })
      .limit(500),
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

  const [photoAssetRead, photoSuggestionRead] = await Promise.all([
    service
      .from("request_photo_assets")
      .select("id,request_id,source,content_type,byte_size,consent_status,processing_opt_out,retention_until,state,version,created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(300),
    service
      .from("request_photo_suggestions")
      .select("id,request_id,photo_asset_id,classifier_ref,category_code,proposed_addon_code,confidence_basis_points,rationale,follow_up_questions,state,version,generated_at")
      .eq("workspace_id", workspace.id)
      .order("generated_at", { ascending: false })
      .limit(500),
  ]);
  const photoReviewAvailable = !photoAssetRead.error && !photoSuggestionRead.error;
  const photoAssetRows = photoReviewAvailable ? rows(photoAssetRead.data) : [];
  const photoSuggestionRows = photoReviewAvailable ? rows(photoSuggestionRead.data) : [];

  const [campaignRead, retentionControlRead, consentRead] = await Promise.all([
    service
      .from("retention_campaigns")
      .select("id,name,channel,purpose,status,template_key,daily_cap,per_customer_cap,quiet_hours_start,quiet_hours_end,version,updated_at")
      .eq("workspace_id", workspace.id)
      .order("updated_at", { ascending: false })
      .limit(200),
    service
      .from("customer_retention_controls")
      .select("customer_id,channel,status,reason_code,until_at,version,updated_at")
      .eq("workspace_id", workspace.id)
      .limit(1000),
    service
      .from("communication_consents")
      .select("id,customer_id,channel,purpose,status,recorded_at,created_at")
      .eq("workspace_id", workspace.id)
      .in("channel", ["EMAIL", "WHATSAPP"])
      .order("recorded_at", { ascending: false })
      .limit(2000),
  ]);
  const retentionAvailable = !campaignRead.error && !retentionControlRead.error && !consentRead.error;
  const campaignRows = retentionAvailable ? rows(campaignRead.data) : [];
  const retentionControlRows = retentionAvailable ? rows(retentionControlRead.data) : [];
  const consentRows = retentionAvailable ? rows(consentRead.data) : [];

  const failedRead = tableReads.find((result) => result.error);
  if (failedRead?.error) {
    return { ok: false, kind: "server", message: "Workspace records could not be loaded. Try again shortly, or check the workspace connection in Settings." };
  }

  const [
    customerRows,
    contactRows,
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
  const activeCustomerIds = new Set(customers.map((customer) => customer.id));
  const verifiedIdentityCustomers = new Map<string, Set<string>>();
  for (const row of contactRows) {
    const customerId = String(row.customer_id);
    if (!activeCustomerIds.has(customerId) || !textValue(row, "verified_at")) continue;
    const kind = String(row.kind);
    const rawValue = String(row.value ?? "").trim();
    if ((kind !== "EMAIL" && kind !== "PHONE") || !rawValue) continue;
    const identityKey = kind + ":" + (kind === "EMAIL" ? rawValue.toLowerCase() : rawValue);
    const customerIds = verifiedIdentityCustomers.get(identityKey) ?? new Set<string>();
    customerIds.add(customerId);
    verifiedIdentityCustomers.set(identityKey, customerIds);
  }
  const customerContacts: OperationalCustomerContact[] = contactRows
    .filter((row) =>
      activeCustomerIds.has(String(row.customer_id))
      && (row.kind === "EMAIL" || row.kind === "PHONE"))
    .map((row) => {
      const kind = String(row.kind) as OperationalCustomerContact["kind"];
      const value = String(row.value ?? "").trim();
      const identityKey = kind + ":" + (kind === "EMAIL" ? value.toLowerCase() : value);
      return {
        id: String(row.id),
        customerId: String(row.customer_id),
        kind,
        value,
        isPrimary: Boolean(row.is_primary),
        isBilling: Boolean(row.is_billing),
        verifiedAt: textValue(row, "verified_at"),
        identityConflictCount: textValue(row, "verified_at")
          ? verifiedIdentityCustomers.get(identityKey)?.size ?? 0
          : 0,
      };
    });
  const latestConsentByCustomerChannel = new Map<string, OperationalCommunicationConsent>();
  for (const row of consentRows) {
    const channel = String(row.channel);
    const status = String(row.status);
    if ((channel !== "EMAIL" && channel !== "WHATSAPP")
        || (status !== "GRANTED" && status !== "REVOKED" && status !== "UNKNOWN")) continue;
    const customerId = String(row.customer_id);
    const key = customerId + ":" + channel;
    if (latestConsentByCustomerChannel.has(key)) continue;
    latestConsentByCustomerChannel.set(key, {
      customerId,
      channel,
      status,
      purpose: String(row.purpose ?? "GENERAL"),
      recordedAt: String(row.recorded_at),
    });
  }
  const communicationConsents = [...latestConsentByCustomerChannel.values()];
  const retentionControls: OperationalRetentionControl[] = retentionControlRows
    .filter((row) => ["EMAIL", "WHATSAPP"].includes(String(row.channel)))
    .filter((row) => ["ACTIVE", "PAUSED", "SUPPRESSED"].includes(String(row.status)))
    .map((row) => ({
      customerId: String(row.customer_id),
      channel: String(row.channel) as OperationalRetentionControl["channel"],
      status: String(row.status) as OperationalRetentionControl["status"],
      reasonCode: textValue(row, "reason_code"),
      untilAt: textValue(row, "until_at"),
      version: numberValue(row, "version", 1),
    }));
  const retentionCampaigns: OperationalRetentionCampaign[] = campaignRows
    .filter((row) => ["EMAIL", "WHATSAPP"].includes(String(row.channel)))
    .filter((row) => ["FOLLOW_UP", "REVIEW_REQUEST", "REFERRAL_NUDGE"].includes(String(row.purpose)))
    .filter((row) => ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"].includes(String(row.status)))
    .map((row) => ({
      id: String(row.id),
      name: String(row.name),
      channel: String(row.channel) as OperationalRetentionCampaign["channel"],
      purpose: String(row.purpose) as OperationalRetentionCampaign["purpose"],
      status: String(row.status) as OperationalRetentionCampaign["status"],
      templateKey: textValue(row, "template_key"),
      dailyCap: numberValue(row, "daily_cap", 100),
      perCustomerCap: numberValue(row, "per_customer_cap", 1),
      quietHoursStart: textValue(row, "quiet_hours_start"),
      quietHoursEnd: textValue(row, "quiet_hours_end"),
      version: numberValue(row, "version", 1),
      updatedAt: String(row.updated_at),
    }));

  const scopedPropertyRows = propertyRows.filter((row) =>
    branchContextAllows(branchScope, textValue(row, "branch_id")));
  const scopedRequestRows = requestRows.filter((row) =>
    branchContextAllows(branchScope, textValue(row, "branch_id")));
  const scopedCrewRows = crewRows.filter((row) =>
    branchContextAllows(branchScope, textValue(row, "branch_id")));
  const scopedCapacityRows = capacityRows.filter((row) =>
    branchContextAllows(branchScope, textValue(row, "branch_id")));
  const scopedVisitRows = visitRows.filter((row) =>
    branchContextAllows(branchScope, textValue(row, "branch_id")));
  const scopedRecurrenceRows = recurrenceRows.filter((row) =>
    branchContextAllows(branchScope, textValue(row, "branch_id")));

  const properties: OperationalProperty[] = scopedPropertyRows.map((row) => ({
    id: String(row.id),
    customerId: String(row.customer_id),
    branchId: textValue(row, "branch_id"),
    label: textValue(row, "label") ?? "Property",
    address: [textValue(row, "address_line1"), textValue(row, "city"), textValue(row, "postal_code")]
      .filter(Boolean)
      .join(", "),
    serviceNotes: textValue(row, "service_notes"),
    accessNotes: textValue(row, "access_notes"),
  }));
  const requests: OperationalRequest[] = scopedRequestRows.map((row) => {
    const serviceRow = row.service_id ? serviceById.get(String(row.service_id)) : undefined;
    const structured = row.structured_fields && typeof row.structured_fields === "object" && !Array.isArray(row.structured_fields)
      ? row.structured_fields as Row
      : {};
    return {
      id: String(row.id),
      customerId: textValue(row, "customer_id"),
      branchId: textValue(row, "branch_id"),
      propertyId: textValue(row, "property_id"),
      serviceCode: serviceRow ? textValue(serviceRow, "code") : undefined,
      serviceLabel: serviceRow
        ? textValue(serviceRow, "name") ?? textValue(serviceRow, "code") ?? "Service"
        : "Service not selected",
      status: String(row.status),
      bedrooms: typeof row.bedrooms === "number" ? row.bedrooms : undefined,
      bathrooms: typeof row.bathrooms === "number" ? row.bathrooms : undefined,
      requestedStartAt: textValue(row, "requested_start_at"),
      sourceChannel: textValue(structured, "sourceChannel"),
      callbackRequired: structured.callbackRequired === true,
      callbackContactRef: textValue(structured, "callbackContactRef"),
      callbackIntakeId: textValue(structured, "voiceCallIntakeId"),
      callbackState: structured.callbackState === "RESOLVED"
        ? "RESOLVED"
        : structured.callbackRequired === true ? "PENDING" : undefined,
      version: numberValue(row, "version", 1),
      createdAt: textValue(row, "created_at"),
    };
  });
  const visibleRequestIds = new Set(requests.map((request) => request.id));
  const quotes: OperationalQuote[] = quoteRows
    .filter((row) => visibleRequestIds.has(String(row.request_id)))
    .map((row) => ({
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
  const photoAssets: OperationalPhotoAsset[] = photoAssetRows
    .filter((row) => ["CUSTOMER_UPLOAD", "WHATSAPP_MEDIA_REFERENCE"].includes(String(row.source)))
    .map((row) => ({
      id: String(row.id),
      requestId: String(row.request_id),
      source: String(row.source) as OperationalPhotoAsset["source"],
      contentType: String(row.content_type) as OperationalPhotoAsset["contentType"],
      byteSize: numberValue(row, "byte_size"),
      consentStatus: String(row.consent_status) as OperationalPhotoAsset["consentStatus"],
      processingOptOut: Boolean(row.processing_opt_out),
      retentionUntil: String(row.retention_until),
      state: String(row.state) as OperationalPhotoAsset["state"],
      version: numberValue(row, "version", 1),
      createdAt: String(row.created_at),
    }));
  const photoSuggestions: OperationalPhotoSuggestion[] = photoSuggestionRows.map((row) => ({
    id: String(row.id),
    requestId: String(row.request_id),
    photoAssetId: String(row.photo_asset_id),
    classifierRef: String(row.classifier_ref),
    categoryCode: String(row.category_code),
    proposedAddOnCode: textValue(row, "proposed_addon_code"),
    confidenceBasisPoints: numberValue(row, "confidence_basis_points"),
    rationale: textValue(row, "rationale"),
    followUpQuestions: Array.isArray(row.follow_up_questions)
      ? row.follow_up_questions.filter((item): item is string => typeof item === "string")
      : [],
    state: String(row.state) as OperationalPhotoSuggestion["state"],
    version: numberValue(row, "version", 1),
    generatedAt: String(row.generated_at),
  }));

  const quoteById = new Map(quotes.map((quote) => [quote.id, quote]));
  const visibleQuoteIds = new Set(quotes.map((quote) => quote.id));
  const visits: OperationalVisit[] = scopedVisitRows.map((row) => {
    const quote = quoteById.get(String(row.quote_id));
    return {
      id: String(row.id),
      workspaceId: workspace.id,
      branchId: textValue(row, "branch_id"),
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

  const visibleVisitIds = new Set(visits.map((visit) => visit.id));
  const scopedInvoiceRows = invoiceRows.filter((row) => visibleQuoteIds.has(String(row.quote_id)));
  const visibleInvoiceIds = new Set(scopedInvoiceRows.map((row) => String(row.id)));
  const scopedConversationRows = conversationRows.filter((row) => {
    const requestId = textValue(row, "request_id");
    return requestId
      ? visibleRequestIds.has(requestId)
      : !branchScope.available || (branchScope.ownerGlobalAccess && !branchScope.selectedBranchId);
  });
  const visibleConversationIds = new Set(scopedConversationRows.map((row) => String(row.id)));
  const scopedQualityRows = qualityRows.filter((row) => visibleVisitIds.has(String(row.visit_id)));
  const visibleQualityIds = new Set(scopedQualityRows.map((row) => String(row.id)));
  const scopedAttentionRows = attentionRows.filter((row) => {
    if (!branchScope.available || (branchScope.ownerGlobalAccess && !branchScope.selectedBranchId)) return true;
    const resourceType = String(row.resource_type ?? "").toLowerCase();
    const resourceId = String(row.resource_id ?? "");
    if (resourceType.includes("request")) return visibleRequestIds.has(resourceId);
    if (resourceType.includes("quote")) return visibleQuoteIds.has(resourceId);
    if (resourceType.includes("invoice")) return visibleInvoiceIds.has(resourceId);
    if (resourceType.includes("visit") || resourceType.includes("job")) return visibleVisitIds.has(resourceId);
    if (resourceType.includes("conversation")) return visibleConversationIds.has(resourceId);
    if (resourceType.includes("quality")) return visibleQualityIds.has(resourceId);
    return false;
  });

  const reportingFacade = createPostgresReportingPlatformFacadeMethods(rpc);
  const now = new Date();
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const branchReportingPromise = branchScope.available && branchScope.selectedBranchId
    ? rpc.rpc<Row>("servicedesk_read_branch_reporting_snapshot", {
        p_input: {
          workspaceId: workspace.id,
          actorUserId: actor.userId,
          actorRole: actor.role,
          branchId: branchScope.selectedBranchId,
          from,
          to: now.toISOString(),
        },
      })
    : Promise.resolve({ data: null, error: null });

  const branchComparisonPromise = branchScope.available && actor.role === "OWNER"
    ? rpc.rpc<Row>("servicedesk_read_branch_comparison_snapshot", {
        p_input: {
          workspaceId: workspace.id,
          actorUserId: actor.userId,
          actorRole: actor.role,
          from,
          to: now.toISOString(),
        },
      })
    : Promise.resolve({ data: null, error: null });

  const [reportingResult, billingResult, settingsResult, attributionRead, branchReportingRead, branchComparisonRead] = await Promise.all([
    branchScope.available && branchScope.selectedBranchId
      ? Promise.resolve({ ok: false as const, code: "BRANCH_REPORTING_ACTIVE", message: "Branch reporting is loaded separately." })
      : reportingFacade.readReportingSnapshot(actor, { from, to: now.toISOString() }),
    reportingFacade.readPlatformBillingSnapshot(actor),
    reportingFacade.readOwnerSettingsSnapshot(actor),
    rpc.rpc<Row>("servicedesk_read_referral_attribution_summary", {
      p_input: {
        workspaceId: workspace.id,
        actorUserId: actor.userId,
        actorRole: actor.role,
        from,
        to: now.toISOString(),
      },
    }),
    branchReportingPromise,
    branchComparisonPromise,
  ]);

  let reporting = reportingResult.ok ? reportingResult.value : undefined;
  if (branchReportingRead.data?.ok === true && branchReportingRead.data.snapshot && typeof branchReportingRead.data.snapshot === "object") {
    const row = branchReportingRead.data.snapshot as Row;
    reporting = {
      workspaceId: workspace.id,
      from: textValue(row, "from"),
      to: textValue(row, "to"),
      requestCount: numberValue(row, "requestCount"),
      bookedRequestCount: numberValue(row, "bookedRequestCount"),
      conversionRateBps: typeof row.conversionRateBps === "number" ? row.conversionRateBps : undefined,
      collectedMinor: numberValue(row, "collectedMinor"),
      outstandingMinor: numberValue(row, "outstandingMinor"),
      currency: textValue(row, "currency") as ReportingSnapshotDTO["currency"],
      scheduledServiceMinutes: numberValue(row, "scheduledServiceMinutes"),
      scheduledBufferMinutes: numberValue(row, "scheduledBufferMinutes"),
      openAttentionCount: scopedAttentionRows.length,
      unresolvedQualityCount: numberValue(row, "unresolvedQualityCount"),
      generatedAt: textValue(row, "generatedAt") ?? now.toISOString(),
    };
  }

  let branchComparison: OperationalBranchComparison | undefined;
  if (branchComparisonRead.data?.ok === true && branchComparisonRead.data.snapshot && typeof branchComparisonRead.data.snapshot === "object") {
    const snapshot = branchComparisonRead.data.snapshot as Row;
    const branchRows = Array.isArray(snapshot.branches)
      ? snapshot.branches.filter((value): value is Row => Boolean(value) && typeof value === "object" && !Array.isArray(value))
      : [];
    branchComparison = {
      branches: branchRows.map((row) => ({
        branchId: String(row.branchId),
        code: String(row.code),
        name: String(row.name),
        timezone: String(row.timezone),
        currency: String(row.currency),
        requestCount: numberValue(row, "requestCount"),
        bookedRequestCount: numberValue(row, "bookedRequestCount"),
        conversionRateBps: typeof row.conversionRateBps === "number" ? row.conversionRateBps : undefined,
        collectedMinor: numberValue(row, "collectedMinor"),
        outstandingMinor: numberValue(row, "outstandingMinor"),
        scheduledServiceMinutes: numberValue(row, "scheduledServiceMinutes"),
        scheduledBufferMinutes: numberValue(row, "scheduledBufferMinutes"),
        unresolvedQualityCount: numberValue(row, "unresolvedQualityCount"),
      })),
      mixedCurrency: snapshot.mixedCurrency === true,
      aggregateCurrency: textValue(snapshot, "aggregateCurrency"),
      aggregateCollectedMinor: typeof snapshot.aggregateCollectedMinor === "number" ? snapshot.aggregateCollectedMinor : undefined,
      aggregateOutstandingMinor: typeof snapshot.aggregateOutstandingMinor === "number" ? snapshot.aggregateOutstandingMinor : undefined,
      currencyDisclosure: String(snapshot.currencyDisclosure ?? "Branch currencies remain explicit."),
      generatedAt: String(snapshot.generatedAt ?? now.toISOString()),
    };
  }
  let referralAttribution: OperationalReferralAttributionSummary | undefined;
  if (!attributionRead.error && attributionRead.data?.ok === true) {
    const attributionRows = Array.isArray(attributionRead.data.rows)
      ? attributionRead.data.rows.filter((value): value is Row => Boolean(value) && typeof value === "object" && !Array.isArray(value))
      : [];
    referralAttribution = {
      from: String(attributionRead.data.from),
      to: String(attributionRead.data.to),
      disclosure: String(attributionRead.data.disclosure ?? "Attribution is directional, not perfect."),
      rows: attributionRows.map((row) => ({
        referralCodeId: String(row.referralCodeId),
        code: String(row.code),
        label: String(row.label),
        active: row.active === true,
        touchCount: numberValue(row, "touchCount"),
        paidJobCount: numberValue(row, "paidJobCount"),
        firstTouchAt: textValue(row, "firstTouchAt"),
        lastTouchAt: textValue(row, "lastTouchAt"),
      })),
    };
  }

  return {
    ok: true,
    value: {
      loadedAt: now.toISOString(),
      workspace,
      actor,
      branchScope,
      branchComparison,
      customers: branchScope.available && !branchScope.ownerGlobalAccess || branchScope.selectedBranchId
        ? customers.filter((customer) => {
            const hasProperty = properties.some((property) => property.customerId === customer.id);
            const hasRequest = requests.some((request) => request.customerId === customer.id);
            return hasProperty || hasRequest;
          })
        : customers,
      customerContacts: branchScope.available && (!branchScope.ownerGlobalAccess || branchScope.selectedBranchId)
        ? customerContacts.filter((contact) =>
            properties.some((property) => property.customerId === contact.customerId)
            || requests.some((request) => request.customerId === contact.customerId))
        : customerContacts,
      communicationConsents: branchScope.available && (!branchScope.ownerGlobalAccess || branchScope.selectedBranchId)
        ? communicationConsents.filter((consent) =>
            properties.some((property) => property.customerId === consent.customerId)
            || requests.some((request) => request.customerId === consent.customerId))
        : communicationConsents,
      retentionControls: branchScope.available && (!branchScope.ownerGlobalAccess || branchScope.selectedBranchId)
        ? retentionControls.filter((control) =>
            properties.some((property) => property.customerId === control.customerId)
            || requests.some((request) => request.customerId === control.customerId))
        : retentionControls,
      retentionCampaigns,
      retentionAvailable,
      referralAttribution,
      properties,
      requests,
      quotes,
      photoReviewAvailable,
      photoAssets: photoAssets.filter((asset) => visibleRequestIds.has(asset.requestId)),
      photoSuggestions: photoSuggestions.filter((suggestion) => visibleRequestIds.has(suggestion.requestId)),
      visits,
      invoices: scopedInvoiceRows.map((row) => mapInvoice(row, workspace.id)),
      conversations: scopedConversationRows.map((row) => mapConversation(row, workspace.id)),
      messages: messageRows
        .filter((row) => visibleConversationIds.has(String(row.conversation_id)))
        .map((row) => mapMessage(row, workspace.id)),
      attentionItems: scopedAttentionRows.map((row) => ({
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
      qualityCases: scopedQualityRows.map((row) => ({
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
      recurrenceRules: scopedRecurrenceRows.map((row) => ({
        id: String(row.id),
        requestId: String(row.request_id),
        propertyId: String(row.property_id),
        frequency: String(row.frequency),
        status: String(row.status),
        nextOccurrenceOn: textValue(row, "next_occurrence_on"),
        version: numberValue(row, "version", 1),
      })),
      serviceCatalog: serviceRows.map((row) => ({
        id: String(row.id),
        code: String(row.code),
        name: String(row.name),
        active: Boolean(row.active),
        requiresReview: Boolean(row.requires_review),
        updatedAt: String(row.updated_at),
      })),
      integrations: buildOperationalIntegrationHealth(),
      crews: scopedCrewRows.map((row) => ({
        id: String(row.id),
        name: String(row.name ?? "Crew"),
        active: Boolean(row.active),
      })),
      capacitySlots: scopedCapacityRows.map((row) => ({
        id: String(row.id),
        crewId: String(row.crew_id),
        startAt: String(row.starts_at),
        endAt: String(row.ends_at),
        capacityMinutes: numberValue(row, "capacity_minutes"),
      })),
      slotHolds: holdRows
        .filter((row) => visibleQuoteIds.has(String(row.quote_id)))
        .map((row) => ({
        id: String(row.id),
        slotId: String(row.slot_id),
        quoteId: String(row.quote_id),
        status: String(row.status),
        expiresAt: String(row.expires_at),
      })),
      visitEvidence: evidenceRows
        .filter((row) => visits.some((visit) => visit.id === String(row.visit_id)))
        .map((row) => ({
        id: String(row.id),
        visitId: String(row.visit_id),
        kind: String(row.kind),
        capturedAt: String(row.captured_at),
        text: textValue(row, "text"),
      })),
      visitChecklistItems: checklistRows
        .filter((row) => visits.some((visit) => visit.id === String(row.visit_id)))
        .map((row) => ({
        id: String(row.id),
        visitId: String(row.visit_id),
        itemKey: String(row.item_key),
        completed: Boolean(row.completed),
        note: textValue(row, "note"),
        version: numberValue(row, "version", 1),
      })),
      reporting,
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
  if (!(await ensureOperationalConversationBranch(resolved.value, conversationId))) return { ok: false, message: "This conversation is outside the active branch context." };
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
  if (!(await ensureOperationalConversationBranch(resolved.value, conversationId))) return { ok: false, message: "This conversation is outside the active branch context." };
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
  if (!(await ensureOperationalQuoteBranch(resolved.value, quoteId))) return { ok: false, message: "This quote is outside the active branch context." };
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
  if (!(await ensureOperationalInvoiceBranch(resolved.value, invoiceId))) return { ok: false, message: "This invoice is outside the active branch context." };
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
  if (!(await ensureOperationalQualityBranch(resolved.value, qualityCaseId))) return { ok: false, message: "This quality case is outside the active branch context." };
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
  if (!(await ensureOperationalBranchResource(resolved.value, "requests", requestId))) return { ok: false, message: "This request is outside the active branch context." };
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
  if (!(await ensureOperationalQuoteBranch(resolved.value, quoteId)) || !(await ensureOperationalSlotBranch(resolved.value, slotId))) return { ok: false, message: "This quote or slot is outside the active branch context." };
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

export async function assignOperationalCrew(
  workspaceSlug: string,
  visitId: string,
  crewId: string,
  expectedVersion: number,
): Promise<OperationalActionResult> {
  if (!visitId || !crewId || !Number.isInteger(expectedVersion) || expectedVersion < 0) {
    return { ok: false, message: "This crew assignment is no longer valid. Refresh the schedule." };
  }
  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };
  if (!(await ensureOperationalBranchResource(resolved.value, "visits", visitId)) || !(await ensureOperationalBranchResource(resolved.value, "crews", crewId))) return { ok: false, message: "This job or crew is outside the active branch context." };
  const facade = createPostgresVisitFieldRuntimeFacadeMethods(resolved.value.rpc);
  const result = await facade.assignCrew(
    resolved.value.actor,
    visitId,
    { crewId },
    {
      idempotencyKey: "crew-assignment-" + crypto.randomUUID(),
      now: new Date().toISOString(),
      expectedVersion,
    },
  );
  return result.ok
    ? { ok: true, message: "Crew assigned." }
    : safeCoreFailure(result, "Could not assign that crew. Refresh dispatch suggestions and try again.");
}

export async function transitionOperationalVisit(
  workspaceSlug: string,
  visitId: string,
  action: "ASSIGN" | "EN_ROUTE" | "START" | "SUBMIT_REVIEW" | "COMPLETE",
): Promise<OperationalActionResult> {
  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };
  if (!(await ensureOperationalBranchResource(resolved.value, "visits", visitId))) return { ok: false, message: "This job is outside the active branch context." };
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
  if (!(await ensureOperationalBranchResource(resolved.value, "visits", visitId))) return { ok: false, message: "This job is outside the active branch context." };
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
  if (!(await ensureOperationalBranchResource(resolved.value, "visits", visitId))) return { ok: false, message: "This job is outside the active branch context." };
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


export async function applyOperationalRecurrenceAction(
  workspaceSlug: string,
  ruleId: string,
  action: "PAUSE" | "RESUME" | "SKIP_NEXT",
): Promise<OperationalActionResult> {
  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };
  if (!(await ensureOperationalBranchResource(resolved.value, "recurrence_rules", ruleId))) return { ok: false, message: "This recurring service is outside the active branch context." };
  const current = await resolved.value.service
    .from("recurrence_rules")
    .select("id,version,status")
    .eq("workspace_id", resolved.value.workspace.id)
    .eq("id", ruleId)
    .maybeSingle();
  if (current.error || !current.data) return { ok: false, message: "The recurring service rule is no longer available." };
  const facade = createPostgresRecurrenceFacadeMethods(resolved.value.rpc);
  const result = await facade.applyRecurrenceRuleAction(
    resolved.value.actor,
    ruleId,
    action,
    {
      idempotencyKey: "recurrence-" + crypto.randomUUID(),
      now: new Date().toISOString(),
      expectedVersion: Number(current.data.version),
    },
  );
  return result.ok
    ? { ok: true, message: action === "PAUSE" ? "Recurring service paused." : action === "RESUME" ? "Recurring service resumed." : "Next occurrence skipped." }
    : safeCoreFailure(result, "Could not update the recurring service. Refresh and try again.");
}

export async function updateOperationalServiceCatalogItem(
  workspaceSlug: string,
  input: {
    serviceId: string;
    name: string;
    active: boolean;
    requiresReview: boolean;
    expectedUpdatedAt: string;
  },
): Promise<OperationalActionResult> {
  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };
  if (resolved.value.actor.role !== "OWNER") {
    return { ok: false, message: "Only workspace owners can change the service catalog." };
  }

  const serviceId = input.serviceId.trim();
  const name = input.name.trim();
  if (!serviceId || !name || name.length > 120 || !input.expectedUpdatedAt) {
    return { ok: false, message: "Check the service details and try again." };
  }

  const idempotencyKey = [
    "service-catalog",
    serviceId,
    input.expectedUpdatedAt,
    name,
    input.active ? "active" : "inactive",
    input.requiresReview ? "review" : "direct",
  ].join(":");

  const { data, error } = await resolved.value.rpc.rpc<Row>("servicedesk_update_service_catalog_item", {
    p_input: {
      workspaceId: resolved.value.workspace.id,
      actorUserId: resolved.value.actor.userId,
      actorRole: resolved.value.actor.role,
      serviceId,
      name,
      active: input.active,
      requiresReview: input.requiresReview,
      expectedUpdatedAt: input.expectedUpdatedAt,
      idempotencyKey,
      now: new Date().toISOString(),
    },
  });

  if (error) {
    return { ok: false, message: "The service could not be saved. Try again." };
  }
  if (!data || data.ok !== true) {
    const code = typeof data?.code === "string" ? data.code : "";
    if (code === "SERVICE_VERSION_CONFLICT") {
      return { ok: false, message: "This service changed since the page loaded. Refresh and try again." };
    }
    if (code === "OWNER_SCOPE_REQUIRED") {
      return { ok: false, message: "Only workspace owners can change the service catalog." };
    }
    if (code === "SERVICE_NOT_FOUND") {
      return { ok: false, message: "This service is no longer available. Refresh the page." };
    }
    return { ok: false, message: "The service could not be saved. Check the details and try again." };
  }

  return { ok: true, message: "Service catalog updated." };
}

export async function createOperationalTeamInvitation(
  workspaceSlug: string,
  input: { email: string; role: "OWNER" | "DISPATCHER" | "CREW" },
): Promise<OperationalInvitationActionResult> {
  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };
  if (resolved.value.actor.role !== "OWNER") {
    return { ok: false, message: "Only workspace owners can invite team members." };
  }

  const email = input.email.trim().toLowerCase();
  if (!email || email.length > 254 || !email.includes("@")) {
    return { ok: false, message: "Enter a valid email address." };
  }
  if (!["OWNER", "DISPATCHER", "CREW"].includes(input.role)) {
    return { ok: false, message: "Choose a valid workspace role." };
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { data, error } = await resolved.value.rpc.rpc<Row>("servicedesk_create_team_invitation", {
    p_input: {
      workspaceId: resolved.value.workspace.id,
      actorUserId: resolved.value.actor.userId,
      actorRole: resolved.value.actor.role,
      email,
      role: input.role,
      tokenHash,
      now: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    },
  });

  if (error) {
    return { ok: false, message: "The invitation could not be created. Try again." };
  }
  if (!data || data.ok !== true) {
    const code = typeof data?.code === "string" ? data.code : "";
    if (code === "MEMBER_ALREADY_ACTIVE") {
      return { ok: false, message: "That email already belongs to an active workspace member." };
    }
    if (code === "OWNER_SCOPE_REQUIRED") {
      return { ok: false, message: "Only workspace owners can invite team members." };
    }
    if (code === "INVITATION_EMAIL_INVALID") {
      return { ok: false, message: "Enter a valid email address." };
    }
    return { ok: false, message: "The invitation could not be created. Check the details and try again." };
  }

  return {
    ok: true,
    message: "Invitation created. Share the secure link with the invited team member.",
    invitePath: "/auth/invitations/" + encodeURIComponent(token),
  };
}

export async function revokeOperationalTeamInvitation(
  workspaceSlug: string,
  invitationId: string,
): Promise<OperationalActionResult> {
  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };
  if (resolved.value.actor.role !== "OWNER") {
    return { ok: false, message: "Only workspace owners can revoke team invitations." };
  }

  const id = invitationId.trim();
  if (!id) return { ok: false, message: "The invitation is no longer available." };

  const { data, error } = await resolved.value.rpc.rpc<Row>("servicedesk_revoke_team_invitation", {
    p_input: {
      workspaceId: resolved.value.workspace.id,
      actorUserId: resolved.value.actor.userId,
      actorRole: resolved.value.actor.role,
      invitationId: id,
      now: new Date().toISOString(),
    },
  });

  if (error) return { ok: false, message: "The invitation could not be revoked. Try again." };
  if (!data || data.ok !== true) {
    const code = typeof data?.code === "string" ? data.code : "";
    if (code === "INVITATION_ALREADY_ACCEPTED") {
      return { ok: false, message: "This invitation has already been accepted." };
    }
    if (code === "INVITATION_NOT_FOUND") {
      return { ok: false, message: "This invitation is no longer available." };
    }
    if (code === "OWNER_SCOPE_REQUIRED") {
      return { ok: false, message: "Only workspace owners can revoke team invitations." };
    }
    return { ok: false, message: "The invitation could not be revoked. Refresh and try again." };
  }

  return { ok: true, message: "Invitation revoked." };
}

export async function setOperationalVoiceCallbackState(
  workspaceSlug: string,
  intakeId: string,
  state: "PENDING" | "RESOLVED",
): Promise<OperationalActionResult> {
  const id = intakeId.trim();
  if (!id || !["PENDING", "RESOLVED"].includes(state)) {
    return { ok: false, message: "The callback task is no longer available." };
  }

  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };
  if (!(await ensureOperationalVoiceIntakeBranch(resolved.value, id))) return { ok: false, message: "This callback task is outside the active branch context." };

  const result = await createPostgresVoiceMissedCallCommandPort(resolved.value.rpc)
    .setVoiceCallbackState(resolved.value.actor, {
      intakeId: id,
      state,
      now: new Date().toISOString(),
    });

  if (!result.ok) {
    if (result.code === "VOICE_CALLBACK_NOT_FOUND" || result.code === "VOICE_CALLBACK_REQUEST_NOT_LINKED") {
      return { ok: false, message: "The callback task is no longer available. Refresh the request." };
    }
    if (result.code === "FORBIDDEN") {
      return { ok: false, message: "You do not have permission to update this callback task." };
    }
    return { ok: false, message: "The callback task could not be updated. Refresh and try again." };
  }

  return {
    ok: true,
    message: state === "RESOLVED" ? "Callback marked complete." : "Callback reopened.",
  };
}

export async function resolveOperationalConversationIdentity(
  workspaceSlug: string,
  conversationId: string,
  expectedVersion: number,
): Promise<OperationalActionResult> {
  const id = conversationId.trim();
  if (!id || !Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return { ok: false, message: "The conversation identity state is no longer valid. Refresh and try again." };
  }

  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };
  if (!(await ensureOperationalConversationBranch(resolved.value, id))) return { ok: false, message: "This conversation is outside the active branch context." };

  const { data, error } = await resolved.value.rpc.rpc<Row>(
    "servicedesk_resolve_conversation_verified_identity",
    {
      p_input: {
        workspaceId: resolved.value.workspace.id,
        actorUserId: resolved.value.actor.userId,
        actorRole: resolved.value.actor.role,
        conversationId: id,
        expectedVersion,
        now: new Date().toISOString(),
      },
    },
  );

  if (error) {
    return { ok: false, message: "Verified identity could not be rechecked. Try again." };
  }
  if (!data || data.ok !== true) {
    const code = typeof data?.code === "string" ? data.code : "";
    if (code === "VERSION_CONFLICT") {
      return { ok: false, message: "This conversation changed since the page loaded. Refresh and try again." };
    }
    if (code === "IDENTITY_VERIFIED_MATCH_NOT_FOUND") {
      return { ok: false, message: "No verified customer contact matches this sender yet." };
    }
    if (code === "IDENTITY_VERIFIED_MATCH_AMBIGUOUS") {
      return { ok: false, message: "More than one verified customer matches this sender. Resolve the duplicate contact records first." };
    }
    if (code === "IDENTITY_REQUEST_CUSTOMER_CONFLICT") {
      return { ok: false, message: "The linked request belongs to a different customer. Resolve that conflict before linking this conversation." };
    }
    if (code === "IDENTITY_SENDER_REF_NOT_FOUND") {
      return { ok: false, message: "This conversation has no persisted inbound sender identity to verify." };
    }
    if (code === "FORBIDDEN") {
      return { ok: false, message: "You do not have permission to resolve conversation identity." };
    }
    return { ok: false, message: "Verified identity could not be resolved. Review the customer contact data and try again." };
  }

  return {
    ok: true,
    message: data.duplicate === true
      ? "Conversation identity was already linked."
      : "Verified customer identity linked. Human takeover remains active for review.",
  };
}

export async function reviewOperationalPhotoSuggestion(
  workspaceSlug: string,
  suggestionId: string,
  decision: "ACCEPTED" | "REJECTED",
  expectedVersion: number,
): Promise<OperationalActionResult> {
  if (!suggestionId.trim() || !Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return { ok: false, message: "The photo suggestion state is no longer valid. Refresh and try again." };
  }
  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };
  if (!(await ensureOperationalPhotoSuggestionBranch(resolved.value, suggestionId))) return { ok: false, message: "This photo suggestion is outside the active branch context." };

  const { data, error } = await resolved.value.rpc.rpc<Row>(
    "servicedesk_review_request_photo_suggestion",
    {
      p_input: {
        workspaceId: resolved.value.workspace.id,
        actorUserId: resolved.value.actor.userId,
        actorRole: resolved.value.actor.role,
        suggestionId,
        expectedVersion,
        decision,
        now: new Date().toISOString(),
      },
    },
  );
  if (error) return { ok: false, message: "Photo suggestion review could not be saved. Try again." };
  if (!data || data.ok !== true) {
    const code = typeof data?.code === "string" ? data.code : "";
    if (code === "VERSION_CONFLICT") {
      return { ok: false, message: "This photo suggestion changed since the page loaded. Refresh and try again." };
    }
    if (code === "PHOTO_PROCESSING_NOT_ALLOWED") {
      return { ok: false, message: "This photo is no longer eligible for processing because consent, opt-out, retention, or access state changed." };
    }
    if (code === "PHOTO_REVIEW_STATE_INVALID") {
      return { ok: false, message: "This photo suggestion has already been reviewed or expired." };
    }
    return { ok: false, message: "Photo suggestion review was rejected. Refresh the request and try again." };
  }
  const quoteRevisionRequired = data.quoteRevisionRequired === true;
  return {
    ok: true,
    message: decision === "REJECTED"
      ? "Photo suggestion rejected. No request or quote value was changed."
      : quoteRevisionRequired
        ? "Suggestion accepted for review. The accepted quote is unchanged; create an explicit quote revision before any price change."
        : "Suggestion accepted for review. No request or quote price was changed automatically.",
  };
}

export async function upsertOperationalReferralCode(
  workspaceSlug: string,
  input: { code: string; label: string; active: boolean; startsAt?: string; endsAt?: string },
): Promise<OperationalActionResult> {
  const code = input.code.trim().toUpperCase();
  const label = input.label.trim();
  if (!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(code) || !label || label.length > 120) {
    return { ok: false, message: "Referral code or label is invalid." };
  }
  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };
  if (resolved.value.actor.role !== "OWNER") {
    return { ok: false, message: "Only an owner can manage referral codes." };
  }

  const { data, error } = await resolved.value.rpc.rpc<Row>("servicedesk_upsert_referral_code", {
    p_input: {
      workspaceId: resolved.value.workspace.id,
      actorUserId: resolved.value.actor.userId,
      actorRole: resolved.value.actor.role,
      code,
      label,
      active: input.active,
      startsAt: input.startsAt || undefined,
      endsAt: input.endsAt || undefined,
      now: new Date().toISOString(),
    },
  });
  if (error || !data || data.ok !== true) {
    return { ok: false, message: "Referral code could not be saved. Check the code and date range." };
  }
  return { ok: true, message: "Referral code saved. Attribution remains directional rather than proof of causality." };
}

export async function upsertOperationalRetentionCampaign(
  workspaceSlug: string,
  input: {
    campaignId?: string;
    expectedVersion?: number;
    name: string;
    channel: "EMAIL" | "WHATSAPP";
    purpose: "FOLLOW_UP" | "REVIEW_REQUEST" | "REFERRAL_NUDGE";
    status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED";
    templateKey?: string;
    subject?: string;
    bodyText: string;
    bodyHtml?: string;
    dailyCap: number;
    perCustomerCap: number;
    quietHoursStart?: string;
    quietHoursEnd?: string;
  },
): Promise<OperationalActionResult> {
  if (!input.name.trim() || !input.bodyText.trim()
      || !Number.isInteger(input.dailyCap) || input.dailyCap < 1 || input.dailyCap > 10000
      || !Number.isInteger(input.perCustomerCap) || input.perCustomerCap < 1 || input.perCustomerCap > 100) {
    return { ok: false, message: "Campaign name, message and send caps are required." };
  }
  if (input.channel === "EMAIL" && (!input.subject?.trim() || !input.bodyHtml?.trim())) {
    return { ok: false, message: "Email campaigns require a subject and HTML body." };
  }
  if (Boolean(input.quietHoursStart) !== Boolean(input.quietHoursEnd)) {
    return { ok: false, message: "Quiet hours require both a start and end time." };
  }

  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };
  if (resolved.value.actor.role !== "OWNER") {
    return { ok: false, message: "Only an owner can manage retention campaigns." };
  }

  const { data, error } = await resolved.value.rpc.rpc<Row>("servicedesk_upsert_retention_campaign", {
    p_input: {
      workspaceId: resolved.value.workspace.id,
      actorUserId: resolved.value.actor.userId,
      actorRole: resolved.value.actor.role,
      campaignId: input.campaignId || undefined,
      expectedVersion: input.expectedVersion,
      name: input.name.trim(),
      channel: input.channel,
      purpose: input.purpose,
      status: input.status,
      templateKey: input.templateKey?.trim() || undefined,
      subject: input.subject?.trim() || undefined,
      bodyText: input.bodyText.trim(),
      bodyHtml: input.bodyHtml?.trim() || undefined,
      dailyCap: input.dailyCap,
      perCustomerCap: input.perCustomerCap,
      quietHoursStart: input.quietHoursStart || undefined,
      quietHoursEnd: input.quietHoursEnd || undefined,
      now: new Date().toISOString(),
    },
  });
  if (error) return { ok: false, message: "Retention campaign could not be saved." };
  if (!data || data.ok !== true) {
    const code = typeof data?.code === "string" ? data.code : "";
    if (code === "VERSION_CONFLICT") {
      return { ok: false, message: "This campaign changed since the page loaded. Refresh and try again." };
    }
    return { ok: false, message: "Retention campaign was rejected by the policy boundary." };
  }
  return {
    ok: true,
    message: input.status === "ACTIVE"
      ? "Campaign activated. Every queued message will still recheck consent, suppression, quiet hours and caps at dispatch time."
      : "Campaign saved. No customer message was queued.",
  };
}

export async function createOperationalBranch(
  workspaceSlug: string,
  input: { code: string; name: string; timezone: string; currency: string },
): Promise<OperationalActionResult> {
  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();
  const timezone = input.timezone.trim();
  const currency = input.currency.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(code) || !name || !timezone || !/^[A-Z]{3}$/.test(currency)) {
    return { ok: false, message: "Check the branch code, name, timezone and currency." };
  }

  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };
  if (resolved.value.actor.role !== "OWNER") {
    return { ok: false, message: "Only workspace owners can create branches." };
  }

  const { data, error } = await resolved.value.rpc.rpc<Row>("servicedesk_create_workspace_branch", {
    p_input: {
      workspaceId: resolved.value.workspace.id,
      actorUserId: resolved.value.actor.userId,
      actorRole: resolved.value.actor.role,
      code,
      name,
      timezone,
      currency,
      now: new Date().toISOString(),
    },
  });
  if (error || !data || data.ok !== true) {
    const code = typeof data?.code === "string" ? data.code : "";
    return { ok: false, message: code === "BRANCH_TIMEZONE_INVALID" ? "Use a valid IANA timezone." : "The branch could not be created." };
  }
  return { ok: true, message: "Branch created. Assign dispatchers or crew before using it operationally." };
}

export async function updateOperationalBranch(
  workspaceSlug: string,
  input: {
    branchId: string;
    name: string;
    timezone: string;
    currency: string;
    active: boolean;
    expectedVersion: number;
  },
): Promise<OperationalActionResult> {
  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };
  if (resolved.value.actor.role !== "OWNER") {
    return { ok: false, message: "Only workspace owners can update branches." };
  }
  if (!input.branchId || !input.name.trim() || !input.timezone.trim()
      || !/^[A-Z]{3}$/.test(input.currency.trim().toUpperCase())
      || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
    return { ok: false, message: "The branch settings are invalid." };
  }

  const { data, error } = await resolved.value.rpc.rpc<Row>("servicedesk_update_workspace_branch", {
    p_input: {
      workspaceId: resolved.value.workspace.id,
      actorUserId: resolved.value.actor.userId,
      actorRole: resolved.value.actor.role,
      branchId: input.branchId,
      name: input.name.trim(),
      timezone: input.timezone.trim(),
      currency: input.currency.trim().toUpperCase(),
      active: input.active,
      expectedVersion: input.expectedVersion,
      now: new Date().toISOString(),
    },
  });
  if (error || !data || data.ok !== true) {
    const code = typeof data?.code === "string" ? data.code : "";
    if (code === "VERSION_CONFLICT") return { ok: false, message: "This branch changed since the page loaded. Refresh and try again." };
    if (code === "DEFAULT_BRANCH_CANNOT_DEACTIVATE") return { ok: false, message: "The default branch cannot be deactivated." };
    if (code === "BRANCH_TIMEZONE_INVALID") return { ok: false, message: "Use a valid IANA timezone." };
    return { ok: false, message: "The branch could not be updated." };
  }
  return { ok: true, message: "Branch settings updated." };
}

export async function setOperationalBranchAssignment(
  workspaceSlug: string,
  input: { branchId: string; targetUserId: string; active: boolean },
): Promise<OperationalActionResult> {
  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };
  if (resolved.value.actor.role !== "OWNER") {
    return { ok: false, message: "Only workspace owners can manage branch assignments." };
  }
  if (!input.branchId || !input.targetUserId) {
    return { ok: false, message: "Choose a branch and team member." };
  }

  const { data, error } = await resolved.value.rpc.rpc<Row>("servicedesk_set_branch_membership", {
    p_input: {
      workspaceId: resolved.value.workspace.id,
      actorUserId: resolved.value.actor.userId,
      actorRole: resolved.value.actor.role,
      branchId: input.branchId,
      targetUserId: input.targetUserId,
      active: input.active,
      now: new Date().toISOString(),
    },
  });
  if (error || !data || data.ok !== true) {
    return { ok: false, message: "Branch assignment could not be changed." };
  }
  if (data.ownerGlobalAccess === true) {
    return { ok: true, message: "Workspace owners already have company-wide branch access." };
  }
  return { ok: true, message: input.active ? "Team member assigned to branch." : "Team member branch access revoked." };
}

export async function selectOperationalBranch(
  workspaceSlug: string,
  branchId?: string,
): Promise<OperationalActionResult> {
  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };
  const { branchScope } = resolved.value;
  if (!branchScope.available) {
    return { ok: false, message: "Branch management is not available in this environment yet." };
  }

  const cookieStore = await cookies();
  const cookieName = branchCookieName(workspaceSlug);
  if (!branchId) {
    if (!branchScope.ownerGlobalAccess) {
      return { ok: false, message: "Only workspace owners can use the all-branches view." };
    }
    cookieStore.delete(cookieName);
    return { ok: true, message: "Showing all authorized branches." };
  }

  const branch = branchScope.branches.find((item) => item.id === branchId && item.active);
  if (!branch) {
    return { ok: false, message: "That branch is not available to your account." };
  }

  cookieStore.set(cookieName, branch.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/app/" + encodeURIComponent(workspaceSlug),
    maxAge: 60 * 60 * 24 * 30,
  });
  return { ok: true, message: "Branch context changed to " + branch.name + "." };
}

async function ensureOperationalBranchResource(
  resolved: ResolvedStaffActor,
  table: "requests" | "visits" | "crews" | "recurrence_rules" | "properties" | "capacity_slots",
  resourceId: string,
): Promise<boolean> {
  if (!resolved.branchScope.available) return true;
  const result = await resolved.service
    .from(table)
    .select("id,branch_id")
    .eq("workspace_id", resolved.workspace.id)
    .eq("id", resourceId)
    .maybeSingle();
  if (result.error || !result.data) return false;
  return branchContextAllows(resolved.branchScope, String(result.data.branch_id ?? ""));
}

async function ensureOperationalQuoteBranch(
  resolved: ResolvedStaffActor,
  quoteId: string,
): Promise<boolean> {
  if (!resolved.branchScope.available) return true;
  const quote = await resolved.service
    .from("quotes")
    .select("id,request_id")
    .eq("workspace_id", resolved.workspace.id)
    .eq("id", quoteId)
    .maybeSingle();
  if (quote.error || !quote.data) return false;
  return ensureOperationalBranchResource(resolved, "requests", String(quote.data.request_id));
}

async function ensureOperationalInvoiceBranch(
  resolved: ResolvedStaffActor,
  invoiceId: string,
): Promise<boolean> {
  if (!resolved.branchScope.available) return true;
  const invoice = await resolved.service
    .from("invoices")
    .select("id,quote_id")
    .eq("workspace_id", resolved.workspace.id)
    .eq("id", invoiceId)
    .maybeSingle();
  if (invoice.error || !invoice.data) return false;
  return ensureOperationalQuoteBranch(resolved, String(invoice.data.quote_id));
}

async function ensureOperationalSlotBranch(
  resolved: ResolvedStaffActor,
  slotId: string,
): Promise<boolean> {
  return ensureOperationalBranchResource(resolved, "capacity_slots", slotId);
}

async function ensureOperationalConversationBranch(
  resolved: ResolvedStaffActor,
  conversationId: string,
): Promise<boolean> {
  if (!resolved.branchScope.available) return true;
  const conversation = await resolved.service
    .from("conversations")
    .select("id,request_id")
    .eq("workspace_id", resolved.workspace.id)
    .eq("id", conversationId)
    .maybeSingle();
  if (conversation.error || !conversation.data) return false;
  const requestId = conversation.data.request_id ? String(conversation.data.request_id) : undefined;
  if (!requestId) {
    return resolved.branchScope.ownerGlobalAccess && !resolved.branchScope.selectedBranchId;
  }
  return ensureOperationalBranchResource(resolved, "requests", requestId);
}

async function ensureOperationalQualityBranch(
  resolved: ResolvedStaffActor,
  qualityCaseId: string,
): Promise<boolean> {
  if (!resolved.branchScope.available) return true;
  const quality = await resolved.service
    .from("quality_cases")
    .select("id,visit_id")
    .eq("workspace_id", resolved.workspace.id)
    .eq("id", qualityCaseId)
    .maybeSingle();
  if (quality.error || !quality.data) return false;
  return ensureOperationalBranchResource(resolved, "visits", String(quality.data.visit_id));
}

async function ensureOperationalPhotoSuggestionBranch(
  resolved: ResolvedStaffActor,
  suggestionId: string,
): Promise<boolean> {
  if (!resolved.branchScope.available) return true;
  const suggestion = await resolved.service
    .from("request_photo_suggestions")
    .select("id,request_id")
    .eq("workspace_id", resolved.workspace.id)
    .eq("id", suggestionId)
    .maybeSingle();
  if (suggestion.error || !suggestion.data) return false;
  return ensureOperationalBranchResource(resolved, "requests", String(suggestion.data.request_id));
}

async function ensureOperationalCustomerBranch(
  resolved: ResolvedStaffActor,
  customerId: string,
): Promise<boolean> {
  if (!resolved.branchScope.available) return true;
  if (resolved.branchScope.ownerGlobalAccess && !resolved.branchScope.selectedBranchId) return true;
  const branchId = resolved.branchScope.selectedBranchId;
  if (!branchId) return false;
  const [property, request] = await Promise.all([
    resolved.service
      .from("properties")
      .select("id")
      .eq("workspace_id", resolved.workspace.id)
      .eq("customer_id", customerId)
      .eq("branch_id", branchId)
      .limit(1),
    resolved.service
      .from("requests")
      .select("id")
      .eq("workspace_id", resolved.workspace.id)
      .eq("customer_id", customerId)
      .eq("branch_id", branchId)
      .limit(1),
  ]);
  if (property.error || request.error) return false;
  return (property.data?.length ?? 0) > 0 || (request.data?.length ?? 0) > 0;
}

async function ensureOperationalVoiceIntakeBranch(
  resolved: ResolvedStaffActor,
  intakeId: string,
): Promise<boolean> {
  if (!resolved.branchScope.available) return true;
  if (resolved.branchScope.ownerGlobalAccess && !resolved.branchScope.selectedBranchId) return true;
  const requests = await resolved.service
    .from("requests")
    .select("id,branch_id,structured_fields")
    .eq("workspace_id", resolved.workspace.id)
    .limit(500);
  if (requests.error || !requests.data) return false;
  const match = requests.data.find((row) => {
    const structured = row.structured_fields && typeof row.structured_fields === "object" && !Array.isArray(row.structured_fields)
      ? row.structured_fields as Row
      : {};
    return textValue(structured, "voiceCallIntakeId") === intakeId;
  });
  return Boolean(match && branchContextAllows(resolved.branchScope, String(match.branch_id ?? "")));
}

export async function setOperationalCustomerRetentionControl(
  workspaceSlug: string,
  input: {
    customerId: string;
    channel: "EMAIL" | "WHATSAPP";
    status: "ACTIVE" | "PAUSED" | "SUPPRESSED";
    reasonCode?: string;
    untilAt?: string;
  },
): Promise<OperationalActionResult> {
  if (!input.customerId.trim()) return { ok: false, message: "Customer is required." };
  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };
  if (!(await ensureOperationalCustomerBranch(resolved.value, input.customerId))) return { ok: false, message: "This customer is outside the active branch context." };

  const { data, error } = await resolved.value.rpc.rpc<Row>("servicedesk_set_customer_retention_control", {
    p_input: {
      workspaceId: resolved.value.workspace.id,
      actorUserId: resolved.value.actor.userId,
      actorRole: resolved.value.actor.role,
      customerId: input.customerId,
      channel: input.channel,
      status: input.status,
      reasonCode: input.reasonCode?.trim().toUpperCase() || undefined,
      untilAt: input.untilAt || undefined,
      now: new Date().toISOString(),
    },
  });
  if (error || !data || data.ok !== true) {
    return { ok: false, message: "Customer retention status could not be updated." };
  }

  return {
    ok: true,
    message: input.status === "ACTIVE"
      ? "Internal retention suppression cleared. A current customer opt-in is still required before any campaign can send."
      : input.status === "PAUSED"
        ? "Retention messages paused for this channel. Existing queued messages will be suppressed at dispatch time."
        : "Retention messages suppressed for this channel. Existing queued messages will be suppressed at dispatch time.",
  };
}

