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

export interface OperationalProperty {
  id: string;
  branchId?: string;
  customerId: string;
  label: string;
  address: string;
  serviceNotes?: string;
  accessNotes?: string;
}

export interface OperationalRequest {
  id: string;
  branchId?: string;
  customerId?: string;
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
  branchId?: string;
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

export interface OperationalBranch {
  id: string;
  code: string;
  name: string;
  timezone: string;
  currency: string;
  isDefault: boolean;
}

export interface OperationalBranchScope {
  mode: "LEGACY" | "ALL" | "BRANCH";
  branches: OperationalBranch[];
  selectedBranchId?: string;
}

export interface OperationalBranchAssignment {
  branchId: string;
  userId: string;
  status: "ACTIVE" | "REVOKED";
  version: number;
}

export interface OperationalBranchComparisonRow {
  branchId: string;
  code: string;
  name: string;
  timezone: string;
  currency: string;
  requestCount: number;
  scheduledVisitCount: number;
  paidInvoiceCount: number;
  collectedMinor: number;
  currencyMismatchCount: number;
}

export interface OperationalBranchComparison {
  fromDate: string;
  toDate: string;
  rows: OperationalBranchComparisonRow[];
  disclosure: string;
}

export interface OperationalStaffSnapshot {
  loadedAt: string;
  workspace: { id: string; slug: string; name: string; timezone: string };
  actor: ActorContext;
  branchScope?: OperationalBranchScope;
  branchAssignments?: OperationalBranchAssignment[];
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
  crews: Array<{ id: string; branchId?: string; name: string; active: boolean }>;
  capacitySlots: Array<{ id: string; branchId?: string; crewId: string; startAt: string; endAt: string; capacityMinutes: number }>;
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
  workspace: { id: string; slug: string; name: string; timezone: string; currency: string };
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

function branchCookieName(workspaceId: string) {
  return `servicedesk_branch_${workspaceId}`;
}

function mapBranch(row: Row): OperationalBranch {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    timezone: String(row.timezone),
    currency: String(row.currency),
    isDefault: row.is_default === true,
  };
}

async function resolveOperationalBranchScope(input: {
  service: SupabaseClient;
  workspaceId: string;
  userId: string;
  role: "OWNER" | "DISPATCHER";
  cookieValue?: string;
}): Promise<
  | { ok: true; value: OperationalBranchScope }
  | { ok: false; kind: "authorization" | "server"; message: string }
> {
  const branchRead = await input.service
    .from("workspace_branches")
    .select("id,code,name,timezone,currency,is_default,active")
    .eq("workspace_id", input.workspaceId)
    .eq("active", true)
    .order("is_default", { ascending: false })
    .order("code", { ascending: true });

  if (branchRead.error?.code === "42P01") {
    return { ok: true, value: { mode: "LEGACY", branches: [] } };
  }
  if (branchRead.error) {
    return { ok: false, kind: "server", message: "Branch access could not be loaded." };
  }

  const allBranches = rows(branchRead.data).map(mapBranch);
  if (allBranches.length === 0) {
    return { ok: false, kind: "server", message: "This workspace has no active branch." };
  }

  if (input.role === "OWNER") {
    const requested = input.cookieValue?.trim();
    if (requested && requested !== "ALL" && allBranches.some((branch) => branch.id === requested)) {
      return { ok: true, value: { mode: "BRANCH", branches: allBranches, selectedBranchId: requested } };
    }
    return { ok: true, value: { mode: "ALL", branches: allBranches } };
  }

  const membershipRead = await input.service
    .from("branch_memberships")
    .select("branch_id,status")
    .eq("workspace_id", input.workspaceId)
    .eq("user_id", input.userId)
    .eq("status", "ACTIVE");

  if (membershipRead.error) {
    return { ok: false, kind: "server", message: "Branch assignment could not be verified." };
  }
  const allowed = new Set(rows(membershipRead.data).map((row) => String(row.branch_id)));
  const branches = allBranches.filter((branch) => allowed.has(branch.id));
  if (branches.length === 0) {
    return { ok: false, kind: "authorization", message: "Your dispatcher account has no active branch assignment." };
  }

  const requested = input.cookieValue?.trim();
  const selected = requested && branches.some((branch) => branch.id === requested)
    ? requested
    : branches.find((branch) => branch.isDefault)?.id ?? branches[0].id;

  return { ok: true, value: { mode: "BRANCH", branches, selectedBranchId: selected } };
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
        // Cookie refresh is owned by middleware.
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
    .select("id,slug,name,timezone,currency")
    .eq("slug", workspaceSlug)
    .maybeSingle();

  if (workspaceResult.error) {
    return { ok: false, kind: "server", message: "The workspace could not be loaded from the database." };
  }
  if (!workspaceResult.data) {
    return { ok: false, kind: "not_found", message: "This workspace does not exist." };
  }

  const workspace = workspaceResult.data as {
    id: string;
    slug: string;
    name: string;
    timezone: string;
    currency: string;
  };
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
  const branchScope = await resolveOperationalBranchScope({
    service,
    workspaceId: workspace.id,
    userId: authData.user.id,
    role: membership.role,
    cookieValue: cookieStore.get(branchCookieName(workspace.id))?.value,
  });
  if (!branchScope.ok) return branchScope;

  return {
    ok: true,
    value: {
      workspace,
      actor,
      service,
      rpc: service as unknown as SupabaseRpcClient,
      branchScope: branchScope.value,
    },
  };
}

export async function loadOperationalBranchScope(workspaceSlug: string): Promise<
  { ok: true; value: { actor: ActorContext; branchScope: OperationalBranchScope } }
  | { ok: false; kind: "configuration" | "authentication" | "authorization" | "not_found" | "server"; message: string }
> {
  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return resolved;
  return {
    ok: true,
    value: {
      actor: resolved.value.actor,
      branchScope: resolved.value.branchScope,
    },
  };
}

export async function setOperationalBranchScope(
  workspaceSlug: string,
  requestedScope: string,
): Promise<OperationalActionResult> {
  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };
  const { actor, workspace, branchScope } = resolved.value;
  if (branchScope.mode === "LEGACY") {
    return { ok: false, message: "Branch controls are not available in this environment yet." };
  }

  const requested = requestedScope.trim();
  if (requested === "ALL") {
    if (actor.role !== "OWNER") {
      return { ok: false, message: "Only an owner can open the company-wide branch view." };
    }
  } else if (!branchScope.branches.some((branch) => branch.id === requested)) {
    return { ok: false, message: "You do not have access to that branch." };
  }

  const cookieStore = await cookies();
  cookieStore.set(branchCookieName(workspace.id), requested, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/app/",
  });
  return { ok: true, message: requested === "ALL" ? "Company-wide view selected." : "Branch view selected." };
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

  let branchAssignments: OperationalBranchAssignment[] = [];
  if (branchScope.mode !== "LEGACY" && actor.role === "OWNER") {
    const assignmentRead = await service
      .from("branch_memberships")
      .select("branch_id,user_id,status,version")
      .eq("workspace_id", workspace.id)
      .order("branch_id", { ascending: true });
    if (!assignmentRead.error) {
      branchAssignments = rows(assignmentRead.data)
        .filter((row) => row.status === "ACTIVE" || row.status === "REVOKED")
        .map((row) => ({
          branchId: String(row.branch_id),
          userId: String(row.user_id),
          status: String(row.status) as OperationalBranchAssignment["status"],
          version: numberValue(row, "version", 1),
        }));
    }
  }

  const failedRead = tableReads.find((result) => result.error);
  if (failedRead?.error) {
    return { ok: false, kind: "server", message: "Workspace records could not be loaded. Try again shortly, or check the workspace connection in Settings." };
  }

  const [
    rawCustomerRows,
    rawContactRows,
    rawPropertyRows,
    serviceRows,
    rawRequestRows,
    rawQuoteRows,
    rawVisitRows,
    rawInvoiceRows,
    rawConversationRows,
    rawMessageRows,
    rawAttentionRows,
    rawQualityRows,
    rawRecurrenceRows,
    rawCrewRows,
    rawCapacityRows,
    rawHoldRows,
    rawEvidenceRows,
    rawChecklistRows,
  ] = tableReads.map((result) => rows(result.data));

  const selectedBranch = branchScope.mode === "BRANCH"
    ? branchScope.branches.find((branch) => branch.id === branchScope.selectedBranchId)
    : undefined;
  if (branchScope.mode === "BRANCH" && !selectedBranch) {
    return { ok: false, kind: "authorization", message: "The selected branch is no longer available to your account." };
  }
  const branchId = selectedBranch?.id;
  const inSelectedBranch = (row: Row) => !branchId || String(row.branch_id ?? "") === branchId;

  const propertyRows = rawPropertyRows.filter(inSelectedBranch);
  const requestRows = rawRequestRows.filter(inSelectedBranch);
  const requestIds = new Set(requestRows.map((row) => String(row.id)));
  const quoteRows = branchId
    ? rawQuoteRows.filter((row) => requestIds.has(String(row.request_id)))
    : rawQuoteRows;
  const quoteIds = new Set(quoteRows.map((row) => String(row.id)));
  const visitRows = rawVisitRows.filter(inSelectedBranch);
  const visitIds = new Set(visitRows.map((row) => String(row.id)));
  const conversationRows = rawConversationRows.filter(inSelectedBranch);
  const conversationIds = new Set(conversationRows.map((row) => String(row.id)));
  const recurrenceRows = rawRecurrenceRows.filter(inSelectedBranch);
  const crewRows = rawCrewRows.filter(inSelectedBranch);
  const capacityRows = rawCapacityRows.filter(inSelectedBranch);
  const capacityIds = new Set(capacityRows.map((row) => String(row.id)));
  const invoiceRows = branchId
    ? rawInvoiceRows.filter((row) =>
        (row.visit_id && visitIds.has(String(row.visit_id)))
        || (row.quote_id && quoteIds.has(String(row.quote_id))))
    : rawInvoiceRows;
  const invoiceIds = new Set(invoiceRows.map((row) => String(row.id)));
  const messageRows = branchId
    ? rawMessageRows.filter((row) => conversationIds.has(String(row.conversation_id)))
    : rawMessageRows;
  const holdRows = branchId
    ? rawHoldRows.filter((row) =>
        capacityIds.has(String(row.slot_id)) || quoteIds.has(String(row.quote_id)))
    : rawHoldRows;
  const evidenceRows = branchId
    ? rawEvidenceRows.filter((row) => visitIds.has(String(row.visit_id)))
    : rawEvidenceRows;
  const checklistRows = branchId
    ? rawChecklistRows.filter((row) => visitIds.has(String(row.visit_id)))
    : rawChecklistRows;
  const qualityRows = branchId
    ? rawQualityRows.filter((row) => visitIds.has(String(row.visit_id)))
    : rawQualityRows;
  const qualityIds = new Set(qualityRows.map((row) => String(row.id)));

  const scopedCustomerIds = new Set<string>();
  for (const row of propertyRows) scopedCustomerIds.add(String(row.customer_id));
  for (const row of requestRows) if (row.customer_id) scopedCustomerIds.add(String(row.customer_id));
  for (const row of conversationRows) if (row.customer_id) scopedCustomerIds.add(String(row.customer_id));
  const customerRows = branchId
    ? rawCustomerRows.filter((row) => scopedCustomerIds.has(String(row.id)))
    : rawCustomerRows;
  const activeCustomerIds = new Set(customerRows.map((row) => String(row.id)));
  const contactRows = branchId
    ? rawContactRows.filter((row) => activeCustomerIds.has(String(row.customer_id)))
    : rawContactRows;

  const propertyIds = new Set(propertyRows.map((row) => String(row.id)));
  const attentionRows = branchId
    ? rawAttentionRows.filter((row) => {
        const type = String(row.resource_type ?? "").toLowerCase();
        const id = String(row.resource_id ?? "");
        if (type === "customer") return activeCustomerIds.has(id);
        if (type === "property") return propertyIds.has(id);
        if (type === "request") return requestIds.has(id);
        if (type === "quote") return quoteIds.has(id);
        if (type === "visit" || type === "job") return visitIds.has(id);
        if (type === "conversation") return conversationIds.has(id);
        if (type === "invoice") return invoiceIds.has(id);
        if (type === "quality" || type === "quality_case") return qualityIds.has(id);
        return false;
      })
    : rawAttentionRows;

  const serviceById = new Map(serviceRows.map((row) => [String(row.id), row]));
  const customers: OperationalCustomer[] = customerRows.map((row) => ({
    id: String(row.id),
    displayName: textValue(row, "display_name") ?? "Unnamed customer",
    leadSource: textValue(row, "lead_source"),
  }));
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
    if (branchId && !activeCustomerIds.has(String(row.customer_id))) continue;
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
    .filter((row) => !branchId || activeCustomerIds.has(String(row.customer_id)))
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
  const retentionCampaigns: OperationalRetentionCampaign[] = (branchId ? [] : campaignRows)
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

  const properties: OperationalProperty[] = propertyRows.map((row) => ({
    id: String(row.id),
    branchId: textValue(row, "branch_id"),
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
    const structured = row.structured_fields && typeof row.structured_fields === "object" && !Array.isArray(row.structured_fields)
      ? row.structured_fields as Row
      : {};
    return {
      id: String(row.id),
      branchId: textValue(row, "branch_id"),
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
  const photoAssets: OperationalPhotoAsset[] = photoAssetRows
    .filter((row) => !branchId || requestIds.has(String(row.request_id)))
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
  const photoSuggestions: OperationalPhotoSuggestion[] = photoSuggestionRows
    .filter((row) => !branchId || requestIds.has(String(row.request_id)))
    .map((row) => ({
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
  const visits: OperationalVisit[] = visitRows.map((row) => {
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

  const reportingFacade = createPostgresReportingPlatformFacadeMethods(rpc);
  const now = new Date();
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [reportingResult, billingResult, settingsResult, attributionRead] = await Promise.all([
    reportingFacade.readReportingSnapshot(actor, { from, to: now.toISOString() }),
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
  ]);
  let branchComparison: OperationalBranchComparison | undefined;
  if (actor.role === "OWNER" && branchScope.mode === "ALL") {
    const fromDate = from.slice(0, 10);
    const toDate = now.toISOString().slice(0, 10);
    const comparisonRead = await rpc.rpc<Row>("servicedesk_read_branch_comparison_report", {
      p_input: {
        workspaceId: workspace.id,
        actorUserId: actor.userId,
        actorRole: actor.role,
        fromDate,
        toDate,
      },
    });
    if (!comparisonRead.error && comparisonRead.data?.ok === true) {
      const comparisonRows = Array.isArray(comparisonRead.data.rows)
        ? comparisonRead.data.rows.filter((value): value is Row => Boolean(value) && typeof value === "object" && !Array.isArray(value))
        : [];
      branchComparison = {
        fromDate: String(comparisonRead.data.fromDate ?? fromDate),
        toDate: String(comparisonRead.data.toDate ?? toDate),
        disclosure: String(
          comparisonRead.data.disclosure
          ?? "Each branch is measured in its own timezone and native currency. Cross-currency totals are not combined without explicit FX truth.",
        ),
        rows: comparisonRows.map((row) => ({
          branchId: String(row.branchId),
          code: String(row.code),
          name: String(row.name),
          timezone: String(row.timezone),
          currency: String(row.currency),
          requestCount: numberValue(row, "requestCount"),
          scheduledVisitCount: numberValue(row, "scheduledVisitCount"),
          paidInvoiceCount: numberValue(row, "paidInvoiceCount"),
          collectedMinor: numberValue(row, "collectedMinor"),
          currencyMismatchCount: numberValue(row, "currencyMismatchCount"),
        })),
      };
    }
  }

  let referralAttribution: OperationalReferralAttributionSummary | undefined;
  if (!branchId && !attributionRead.error && attributionRead.data?.ok === true) {
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
      workspace: selectedBranch ? { ...workspace, timezone: selectedBranch.timezone } : workspace,
      actor,
      branchScope,
      branchAssignments,
      branchComparison,
      customers,
      customerContacts,
      communicationConsents,
      retentionControls,
      retentionCampaigns,
      retentionAvailable,
      referralAttribution,
      properties,
      requests,
      quotes,
      photoReviewAvailable,
      photoAssets,
      photoSuggestions,
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
        branchId: textValue(row, "branch_id"),
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
      crews: crewRows.map((row) => ({
        id: String(row.id),
        branchId: textValue(row, "branch_id"),
        name: String(row.name ?? "Crew"),
        active: Boolean(row.active),
      })),
      capacitySlots: capacityRows.map((row) => ({
        id: String(row.id),
        branchId: textValue(row, "branch_id"),
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
      reporting: !branchId && reportingResult.ok ? reportingResult.value : undefined,
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


export async function applyOperationalRecurrenceAction(
  workspaceSlug: string,
  ruleId: string,
  action: "PAUSE" | "RESUME" | "SKIP_NEXT",
): Promise<OperationalActionResult> {
  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };
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

export async function upsertOperationalBranch(
  workspaceSlug: string,
  input: {
    branchId?: string;
    expectedVersion?: number;
    code: string;
    name: string;
    timezone: string;
    currency: string;
    active: boolean;
  },
): Promise<OperationalActionResult> {
  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();
  const timezone = input.timezone.trim();
  const currency = input.currency.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(code)
      || !name || name.length > 120 || !timezone || !/^[A-Z]{3}$/.test(currency)) {
    return { ok: false, message: "Branch code, name, timezone and three-letter currency are required." };
  }

  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };
  if (resolved.value.actor.role !== "OWNER") {
    return { ok: false, message: "Only an owner can manage branches." };
  }

  const { data, error } = await resolved.value.rpc.rpc<Row>("servicedesk_upsert_workspace_branch", {
    p_input: {
      workspaceId: resolved.value.workspace.id,
      actorUserId: resolved.value.actor.userId,
      actorRole: resolved.value.actor.role,
      branchId: input.branchId || undefined,
      expectedVersion: input.expectedVersion,
      code,
      name,
      timezone,
      currency,
      active: input.active,
      now: new Date().toISOString(),
    },
  });
  if (error || !data || data.ok !== true) {
    const codeValue = typeof data?.code === "string" ? data.code : "";
    if (codeValue === "VERSION_CONFLICT") {
      return { ok: false, message: "This branch changed since the page loaded. Refresh and try again." };
    }
    if (codeValue === "DEFAULT_BRANCH_REQUIRED") {
      return { ok: false, message: "The default branch cannot be disabled." };
    }
    if (codeValue === "BRANCH_TIMEZONE_INVALID") {
      return { ok: false, message: "Use a valid IANA timezone such as America/New_York." };
    }
    return { ok: false, message: "Branch settings could not be saved." };
  }
  return { ok: true, message: "Branch settings saved." };
}

export async function setOperationalBranchMembership(
  workspaceSlug: string,
  input: { branchId: string; userId: string; status: "ACTIVE" | "REVOKED" },
): Promise<OperationalActionResult> {
  if (!input.branchId.trim() || !input.userId.trim()) {
    return { ok: false, message: "Branch and staff member are required." };
  }
  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };
  if (resolved.value.actor.role !== "OWNER") {
    return { ok: false, message: "Only an owner can manage branch assignments." };
  }

  const { data, error } = await resolved.value.rpc.rpc<Row>("servicedesk_set_branch_membership", {
    p_input: {
      workspaceId: resolved.value.workspace.id,
      actorUserId: resolved.value.actor.userId,
      actorRole: resolved.value.actor.role,
      branchId: input.branchId,
      userId: input.userId,
      status: input.status,
      now: new Date().toISOString(),
    },
  });
  if (error || !data || data.ok !== true) {
    const codeValue = typeof data?.code === "string" ? data.code : "";
    if (codeValue === "OWNER_BRANCH_ASSIGNMENT_NOT_REQUIRED") {
      return { ok: false, message: "Owners already have company-wide branch access." };
    }
    if (codeValue === "STAFF_MEMBERSHIP_NOT_FOUND") {
      return { ok: false, message: "That staff account is no longer an active workspace member." };
    }
    return { ok: false, message: "Branch assignment could not be updated." };
  }

  return {
    ok: true,
    message: input.status === "ACTIVE" ? "Staff branch access granted." : "Staff branch access revoked.",
  };
}

