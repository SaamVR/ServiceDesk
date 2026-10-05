import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type {
  ActorContext,
  AttentionItemDTO,
  RequestDTO,
  VisitChecklistItemDTO,
  VisitDTO,
  VisitEvidenceDTO,
} from "@/contracts";
import type { VisitAction } from "@/server/core/facade";
import { createPostgresVisitFieldRuntimeFacadeMethods } from "@/server/core/visit-field-postgres";
import { canCrewEditChecklist, canCrewReportIssue } from "./field-action-policy";
import type { SupabaseRpcClient } from "@/server/core/payment-application-postgres";
import {
  createCrewFieldReadFactory,
  type CrewFieldReadSnapshot,
  type CrewVisitContextSnapshot,
} from "./route-boundary";

type Row = Record<string, unknown>;

export type CrewProductRuntimeErrorKind =
  | "configuration"
  | "authentication"
  | "authorization"
  | "not_found"
  | "server";

export type CrewProductRuntimeResult<T> =
  | { ok: true; value: T }
  | { ok: false; kind: CrewProductRuntimeErrorKind; code: string; message: string };

export type CrewProductActionResult =
  | { ok: true; message: string }
  | { ok: false; code: string; message: string; refreshRequired?: boolean; retryable?: boolean };

interface ResolvedCrewActor {
  workspace: { id: string; slug: string; name: string; timezone: string };
  actor: ActorContext;
  crewIds: string[];
  service: SupabaseClient;
  rpc: SupabaseRpcClient;
}

function fail(
  kind: CrewProductRuntimeErrorKind,
  code: string,
  message: string,
): Extract<CrewProductRuntimeResult<never>, { ok: false }> {
  return { ok: false, kind, code, message };
}

function textValue(row: Row, key: string): string | undefined {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberValue(row: Row, key: string, fallback = 0): number {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
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

async function authenticatedUser(config: NonNullable<ReturnType<typeof runtimeConfig>>) {
  const cookieStore = await cookies();
  const auth = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Session refresh remains owned by the application authentication layer.
      },
    },
  });
  return auth.auth.getUser();
}

async function resolveCrewActor(input: {
  workspaceSlug?: string;
  visitId?: string;
} = {}): Promise<CrewProductRuntimeResult<ResolvedCrewActor>> {
  const config = runtimeConfig();
  if (!config) {
    return fail(
      "configuration",
      "CREW_RUNTIME_NOT_CONFIGURED",
      "Crew jobs are temporarily unavailable. Try again later or contact dispatch.",
    );
  }

  const { data: authData, error: authError } = await authenticatedUser(config);
  if (authError || !authData.user) {
    return fail("authentication", "CREW_AUTH_REQUIRED", "Sign in with an active crew account.");
  }

  const service = createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const [membershipResult, crewMembershipResult] = await Promise.all([
    service
      .from("memberships")
      .select("workspace_id,role,status")
      .eq("user_id", authData.user.id)
      .eq("status", "ACTIVE")
      .eq("role", "CREW"),
    service
      .from("crew_members")
      .select("workspace_id,crew_id,active")
      .eq("user_id", authData.user.id)
      .eq("active", true),
  ]);

  if (membershipResult.error || crewMembershipResult.error) {
    return fail("server", "CREW_SCOPE_LOOKUP_FAILED", "Crew access could not be verified.");
  }

  const crewRows = rows(crewMembershipResult.data);
  const crewWorkspaceIds = new Set(crewRows.map((row) => String(row.workspace_id)));
  const eligibleWorkspaceIds = rows(membershipResult.data)
    .map((row) => String(row.workspace_id))
    .filter((workspaceId) => crewWorkspaceIds.has(workspaceId));

  if (eligibleWorkspaceIds.length === 0) {
    return fail("authorization", "CREW_SCOPE_REQUIRED", "Your account has no active crew assignment.");
  }

  let workspaceId: string | undefined;

  if (input.visitId) {
    const visitLookup = await service
      .from("visits")
      .select("id,workspace_id,crew_id")
      .eq("id", input.visitId)
      .maybeSingle();

    if (visitLookup.error) {
      return fail("server", "CREW_VISIT_LOOKUP_FAILED", "The job could not be checked.");
    }
    if (!visitLookup.data) {
      return fail("not_found", "CREW_VISIT_NOT_FOUND", "This job is not available.");
    }

    const visitRow = visitLookup.data as Row;
    const visitWorkspaceId = String(visitRow.workspace_id);
    const visitCrewId = textValue(visitRow, "crew_id");
    const assignedToUser = crewRows.some(
      (row) => String(row.workspace_id) === visitWorkspaceId && String(row.crew_id) === visitCrewId,
    );

    if (!eligibleWorkspaceIds.includes(visitWorkspaceId) || !assignedToUser) {
      return fail("not_found", "CREW_VISIT_NOT_FOUND", "This job is not available.");
    }
    workspaceId = visitWorkspaceId;
  } else if (input.workspaceSlug) {
    const workspaceLookup = await service
      .from("workspaces")
      .select("id")
      .eq("slug", input.workspaceSlug)
      .maybeSingle();

    if (workspaceLookup.error) {
      return fail("server", "CREW_WORKSPACE_LOOKUP_FAILED", "The crew workspace could not be checked.");
    }

    const candidateId = workspaceLookup.data ? String((workspaceLookup.data as Row).id) : undefined;
    if (!candidateId || !eligibleWorkspaceIds.includes(candidateId)) {
      return fail("authorization", "CREW_WORKSPACE_FORBIDDEN", "This crew workspace is not available to your account.");
    }
    workspaceId = candidateId;
  } else {
    const uniqueWorkspaceIds = [...new Set(eligibleWorkspaceIds)];
    if (uniqueWorkspaceIds.length !== 1) {
      return fail(
        "authorization",
        "CREW_WORKSPACE_SELECTION_REQUIRED",
        "Choose which crew workspace you want to open.",
      );
    }
    workspaceId = uniqueWorkspaceIds[0];
  }

  const workspaceResult = await service
    .from("workspaces")
    .select("id,slug,name,timezone")
    .eq("id", workspaceId)
    .maybeSingle();

  if (workspaceResult.error) {
    return fail("server", "CREW_WORKSPACE_LOOKUP_FAILED", "The crew workspace could not be loaded.");
  }
  if (!workspaceResult.data) {
    return fail("not_found", "CREW_WORKSPACE_NOT_FOUND", "The crew workspace is not available.");
  }

  const workspaceRow = workspaceResult.data as Row;
  const workspaceCrewIds = crewRows
    .filter((row) => String(row.workspace_id) === workspaceId)
    .map((row) => String(row.crew_id));

  return {
    ok: true,
    value: {
      workspace: {
        id: workspaceId,
        slug: String(workspaceRow.slug),
        name: String(workspaceRow.name),
        timezone: textValue(workspaceRow, "timezone") ?? "UTC",
      },
      actor: {
        workspaceId,
        userId: authData.user.id,
        role: "CREW",
      },
      crewIds: workspaceCrewIds,
      service,
      rpc: service as unknown as SupabaseRpcClient,
    },
  };
}

function visitStatus(value: unknown): VisitDTO["status"] {
  const raw = String(value);
  if (raw === "SCHEDULED") return "CONFIRMED";
  if (raw === "NEEDS_REVIEW") return "PENDING_REVIEW";
  return raw as VisitDTO["status"];
}

function addressLabel(row?: Row) {
  if (!row) return undefined;
  const parts = [
    textValue(row, "address_line1"),
    textValue(row, "address_line2"),
    textValue(row, "city"),
    textValue(row, "region"),
    textValue(row, "postal_code"),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

async function readCrewSnapshot(
  resolved: ResolvedCrewActor,
  input: { now: string; visitId?: string },
): Promise<CrewProductRuntimeResult<CrewFieldReadSnapshot>> {
  const { workspace, crewIds, service } = resolved;

  if (crewIds.length === 0) {
    return fail("authorization", "CREW_SCOPE_REQUIRED", "Your account has no active crew assignment.");
  }

  let visitQuery = service
    .from("visits")
    .select("id,workspace_id,request_id,quote_id,crew_id,status,starts_at,ends_at,version")
    .eq("workspace_id", workspace.id)
    .in("crew_id", crewIds)
    .order("starts_at", { ascending: true })
    .limit(100);

  if (input.visitId) {
    visitQuery = visitQuery.eq("id", input.visitId);
  } else {
    const nowMs = new Date(input.now).getTime();
    const padding = 36 * 60 * 60 * 1000;
    visitQuery = visitQuery
      .gte("starts_at", new Date(nowMs - padding).toISOString())
      .lte("starts_at", new Date(nowMs + padding).toISOString());
  }

  const visitResult = await visitQuery;
  if (visitResult.error) {
    return fail("server", "CREW_VISITS_READ_FAILED", "Assigned jobs could not be loaded.");
  }

  const visitRows = rows(visitResult.data);
  if (input.visitId && visitRows.length === 0) {
    return fail("not_found", "CREW_VISIT_NOT_FOUND", "This job is not available.");
  }

  const requestIds = [...new Set(visitRows.map((row) => String(row.request_id)))];
  const quoteIds = [...new Set(visitRows.map((row) => textValue(row, "quote_id")).filter((value): value is string => Boolean(value)))];
  const visitIds = visitRows.map((row) => String(row.id));

  const [requestResult, quoteResult, evidenceResult, checklistResult, attentionResult] = await Promise.all([
    requestIds.length > 0
      ? service.from("requests").select("*").eq("workspace_id", workspace.id).in("id", requestIds)
      : Promise.resolve({ data: [], error: null }),
    quoteIds.length > 0
      ? service.from("quotes").select("id,duration_minutes,buffer_minutes").eq("workspace_id", workspace.id).in("id", quoteIds)
      : Promise.resolve({ data: [], error: null }),
    visitIds.length > 0
      ? service.from("visit_evidence").select("*").eq("workspace_id", workspace.id).in("visit_id", visitIds).order("captured_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    visitIds.length > 0
      ? service.from("visit_checklist_items").select("*").eq("workspace_id", workspace.id).in("visit_id", visitIds).order("item_key", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    visitIds.length > 0
      ? service.from("attention_items").select("*").eq("workspace_id", workspace.id).eq("resource_type", "visit").in("resource_id", visitIds).neq("status", "RESOLVED")
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (
    requestResult.error
    || quoteResult.error
    || evidenceResult.error
    || checklistResult.error
    || attentionResult.error
  ) {
    return fail("server", "CREW_JOB_CONTEXT_READ_FAILED", "Job details could not be loaded.");
  }

  const requestRows = rows(requestResult.data);
  const serviceIds = [...new Set(requestRows.map((row) => textValue(row, "service_id")).filter((value): value is string => Boolean(value)))];
  const propertyIds = [...new Set(requestRows.map((row) => textValue(row, "property_id")).filter((value): value is string => Boolean(value)))];
  const customerIds = [...new Set(requestRows.map((row) => textValue(row, "customer_id")).filter((value): value is string => Boolean(value)))];

  const [serviceResult, propertyResult, customerResult] = await Promise.all([
    serviceIds.length > 0
      ? service.from("service_catalog").select("id,code,name").eq("workspace_id", workspace.id).in("id", serviceIds)
      : Promise.resolve({ data: [], error: null }),
    propertyIds.length > 0
      ? service.from("properties").select("id,customer_id,address_line1,address_line2,city,region,postal_code,country_code,access_notes,service_notes").eq("workspace_id", workspace.id).in("id", propertyIds)
      : Promise.resolve({ data: [], error: null }),
    customerIds.length > 0
      ? service.from("customers").select("id,display_name").eq("workspace_id", workspace.id).in("id", customerIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (serviceResult.error || propertyResult.error || customerResult.error) {
    return fail("server", "CREW_PRIVATE_CONTEXT_READ_FAILED", "Authorized job context could not be loaded.");
  }

  const serviceById = new Map(rows(serviceResult.data).map((row) => [String(row.id), row]));
  const propertyById = new Map(rows(propertyResult.data).map((row) => [String(row.id), row]));
  const customerById = new Map(rows(customerResult.data).map((row) => [String(row.id), row]));
  const quoteById = new Map(rows(quoteResult.data).map((row) => [String(row.id), row]));
  const requestById = new Map(requestRows.map((row) => [String(row.id), row]));

  const requests: RequestDTO[] = requestRows.map((row) => {
    const serviceRow = textValue(row, "service_id") ? serviceById.get(String(row.service_id)) : undefined;
    return {
      id: String(row.id),
      workspaceId: workspace.id,
      customerId: textValue(row, "customer_id"),
      propertyId: textValue(row, "property_id"),
      serviceCode: serviceRow ? textValue(serviceRow, "code") : undefined,
      status: String(row.status) as RequestDTO["status"],
      bedrooms: typeof row.bedrooms === "number" ? row.bedrooms : undefined,
      bathrooms: typeof row.bathrooms === "number" ? row.bathrooms : undefined,
      requestedStartAt: textValue(row, "requested_start_at"),
      version: numberValue(row, "version", 1),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  });

  const visits: VisitDTO[] = [];
  for (const row of visitRows) {
    const quoteId = textValue(row, "quote_id");
    if (!quoteId) {
      return fail("server", "CREW_VISIT_QUOTE_REQUIRED", "An assigned job is missing its booking quote.");
    }
    const startsAt = String(row.starts_at);
    const endsAt = String(row.ends_at);
    const totalMinutes = Math.max(0, Math.round((Date.parse(endsAt) - Date.parse(startsAt)) / 60_000));
    const quoteRow = quoteById.get(quoteId);
    const bufferMinutes = quoteRow ? numberValue(quoteRow, "buffer_minutes", 0) : 0;
    const serviceMinutes = quoteRow
      ? numberValue(quoteRow, "duration_minutes", Math.max(0, totalMinutes - bufferMinutes))
      : totalMinutes;

    visits.push({
      id: String(row.id),
      workspaceId: workspace.id,
      requestId: String(row.request_id),
      quoteId,
      crewId: textValue(row, "crew_id"),
      status: visitStatus(row.status),
      startAt: startsAt,
      serviceMinutes,
      bufferMinutes,
      version: numberValue(row, "version", 1),
    });
  }

  const visitEvidence: VisitEvidenceDTO[] = rows(evidenceResult.data).map((row) => ({
    id: String(row.id),
    workspaceId: workspace.id,
    visitId: String(row.visit_id),
    kind: String(row.kind) as VisitEvidenceDTO["kind"],
    mediaReference: row.media_reference as VisitEvidenceDTO["mediaReference"],
    text: textValue(row, "text"),
    capturedAt: String(row.captured_at),
    submittedByUserId: String(row.submitted_by_user_id),
    createdAt: String(row.created_at),
  }));

  const visitChecklistItems: VisitChecklistItemDTO[] = rows(checklistResult.data).map((row) => ({
    id: String(row.id),
    workspaceId: workspace.id,
    visitId: String(row.visit_id),
    itemKey: String(row.item_key),
    completed: row.completed === true,
    note: textValue(row, "note"),
    updatedByUserId: String(row.updated_by_user_id),
    updatedAt: String(row.updated_at),
    version: numberValue(row, "version", 1),
  }));

  const attentionItems: AttentionItemDTO[] = rows(attentionResult.data).map((row) => ({
    id: String(row.id),
    workspaceId: workspace.id,
    type: String(row.type),
    severity: String(row.severity) as AttentionItemDTO["severity"],
    status: String(row.status) as AttentionItemDTO["status"],
    resourceType: String(row.resource_type),
    resourceId: String(row.resource_id),
    ownerUserId: textValue(row, "owner_user_id"),
    dueAt: textValue(row, "due_at"),
    summary: String(row.summary ?? "Attention required"),
  }));

  const visitContexts: CrewVisitContextSnapshot[] = visits.map((visit) => {
    const requestRow = requestById.get(visit.requestId);
    const propertyRow = requestRow && textValue(requestRow, "property_id")
      ? propertyById.get(String(requestRow.property_id))
      : undefined;
    const customerRow = requestRow && textValue(requestRow, "customer_id")
      ? customerById.get(String(requestRow.customer_id))
      : undefined;

    return {
      visitId: visit.id,
      authorized: true,
      locationLabel: addressLabel(propertyRow),
      customerLabel: customerRow ? textValue(customerRow, "display_name") : undefined,
      accessNotes: propertyRow ? textValue(propertyRow, "access_notes") : undefined,
      serviceNotes: propertyRow ? textValue(propertyRow, "service_notes") : undefined,
      highPriorityNotes: [],
    };
  });

  return {
    ok: true,
    value: {
      workspaceId: workspace.id,
      workspaceTimeZone: workspace.timezone,
      scope: "ASSIGNED_CREW_ONLY",
      requests,
      visits,
      visitEvidence,
      visitChecklistItems,
      attentionItems,
      visitContexts,
    },
  };
}

export async function loadCrewTodayProduct(
  now: string,
  workspaceSlug?: string,
) {
  const resolved = await resolveCrewActor({ workspaceSlug });
  if (!resolved.ok) return resolved;

  const port = {
    readCrewFieldSnapshot: async (_ctx: ActorContext, query: { now: string; visitId?: string }) => {
      const snapshot = await readCrewSnapshot(resolved.value, query);
      return snapshot.ok
        ? { ok: true as const, value: snapshot.value }
        : { ok: false as const, code: snapshot.code, message: snapshot.message };
    },
  };

  const result = await createCrewFieldReadFactory(port).loadToday(resolved.value.actor, now);
  return result.ok
    ? { ok: true as const, value: { ...result.value, workspace: resolved.value.workspace, actor: resolved.value.actor } }
    : fail("server", result.code, result.message);
}

export async function loadCrewJobProduct(visitId: string, now: string) {
  const resolved = await resolveCrewActor({ visitId });
  if (!resolved.ok) return resolved;

  const port = {
    readCrewFieldSnapshot: async (_ctx: ActorContext, query: { now: string; visitId?: string }) => {
      const snapshot = await readCrewSnapshot(resolved.value, query);
      return snapshot.ok
        ? { ok: true as const, value: snapshot.value }
        : { ok: false as const, code: snapshot.code, message: snapshot.message };
    },
  };

  const result = await createCrewFieldReadFactory(port).loadJob(resolved.value.actor, visitId, now);
  return result.ok
    ? { ok: true as const, value: { ...result.value, workspace: resolved.value.workspace, actor: resolved.value.actor } }
    : fail("server", result.code, result.message);
}

async function verifyCrewVisitMutationState(
  resolved: ResolvedCrewActor,
  visitId: string,
  expectedVersion: number,
  allowed: (status: VisitDTO["status"]) => boolean,
): Promise<CrewProductActionResult | undefined> {
  const result = await resolved.service
    .from("visits")
    .select("id,workspace_id,crew_id,status,version")
    .eq("workspace_id", resolved.workspace.id)
    .eq("id", visitId)
    .maybeSingle();

  if (result.error) {
    return {
      ok: false,
      code: "CREW_VISIT_REFRESH_CHECK_FAILED",
      message: "The latest job status could not be checked. Refresh before trying again.",
      refreshRequired: true,
      retryable: false,
    };
  }
  if (!result.data) {
    return {
      ok: false,
      code: "CREW_VISIT_NOT_FOUND",
      message: "This job is no longer available.",
      refreshRequired: true,
      retryable: false,
    };
  }

  const row = result.data as Row;
  const currentCrewId = textValue(row, "crew_id");
  if (!currentCrewId || !resolved.crewIds.includes(currentCrewId)) {
    return {
      ok: false,
      code: "CREW_ASSIGNMENT_CHANGED",
      message: "This job is no longer assigned to your crew. Refresh to see the latest work.",
      refreshRequired: true,
      retryable: false,
    };
  }

  const currentVersion = numberValue(row, "version", -1);
  if (currentVersion !== expectedVersion) {
    return actionFailure("VERSION_CONFLICT", "This job changed.");
  }

  const currentStatus = visitStatus(row.status);
  if (!allowed(currentStatus)) {
    return actionFailure("VISIT_STATE_INVALID", "This field action is no longer available.");
  }

  return undefined;
}

function actionFailure(code: string, message: string): CrewProductActionResult {
  const refreshRequired = [
    "VERSION_CONFLICT",
    "STALE_VERSION",
    "VISIT_STATE_INVALID",
    "VISIT_TERMINAL",
    "FORBIDDEN",
  ].includes(code);

  const practicalMessage =
    code === "VERSION_CONFLICT" || code === "STALE_VERSION"
      ? "This job changed. Refresh it before trying again."
      : code === "VISIT_REVIEW_EVIDENCE_REQUIRED"
        ? "Add the required before and after photos before sending for review."
        : code === "VISIT_STATE_INVALID" || code === "VISIT_TERMINAL"
          ? "This action is no longer available for the current job status."
          : code === "FORBIDDEN"
            ? "This action is no longer available to your crew account."
            : message;

  return { ok: false, code, message: practicalMessage, refreshRequired, retryable: false };
}

export async function transitionCrewProductVisit(input: {
  visitId: string;
  expectedVersion: number;
  action: Extract<VisitAction, "EN_ROUTE" | "START" | "SUBMIT_REVIEW">;
}): Promise<CrewProductActionResult> {
  const resolved = await resolveCrewActor({ visitId: input.visitId });
  if (!resolved.ok) return { ok: false, code: resolved.code, message: resolved.message, refreshRequired: true };

  const facade = createPostgresVisitFieldRuntimeFacadeMethods(resolved.value.rpc);
  const now = new Date().toISOString();
  const result = await facade.transitionVisit(
    resolved.value.actor,
    input.visitId,
    input.action,
    {
      idempotencyKey: `crew-transition:${resolved.value.actor.userId}:${input.visitId}:${input.expectedVersion}:${input.action}`,
      expectedVersion: input.expectedVersion,
      now,
    },
  );

  if (!result.ok) return actionFailure(result.code, result.message);
  return { ok: true, message: "Job status updated." };
}

export async function setCrewProductChecklistItem(input: {
  visitId: string;
  expectedVisitVersion: number;
  itemKey: string;
  completed: boolean;
}): Promise<CrewProductActionResult> {
  const resolved = await resolveCrewActor({ visitId: input.visitId });
  if (!resolved.ok) return { ok: false, code: resolved.code, message: resolved.message, refreshRequired: true };

  const preflight = await verifyCrewVisitMutationState(
    resolved.value,
    input.visitId,
    input.expectedVisitVersion,
    canCrewEditChecklist,
  );
  if (preflight) return preflight;

  const facade = createPostgresVisitFieldRuntimeFacadeMethods(resolved.value.rpc);
  const now = new Date().toISOString();
  const result = await facade.setVisitChecklistItem(
    resolved.value.actor,
    input.visitId,
    { itemKey: input.itemKey, completed: input.completed },
    {
      idempotencyKey: `crew-checklist:${resolved.value.actor.userId}:${input.visitId}:${input.itemKey}:${input.completed}:${now}`,
      expectedVersion: input.expectedVisitVersion,
      now,
    },
  );

  if (!result.ok) return actionFailure(result.code, result.message);
  return { ok: true, message: "Checklist updated." };
}

export async function reportCrewProductIssue(input: {
  visitId: string;
  expectedVisitVersion: number;
  text: string;
}): Promise<CrewProductActionResult> {
  const note = input.text.trim();
  if (!note) {
    return { ok: false, code: "VISIT_EVIDENCE_TEXT_REQUIRED", message: "Describe the issue before sending." };
  }

  const resolved = await resolveCrewActor({ visitId: input.visitId });
  if (!resolved.ok) return { ok: false, code: resolved.code, message: resolved.message, refreshRequired: true };

  const preflight = await verifyCrewVisitMutationState(
    resolved.value,
    input.visitId,
    input.expectedVisitVersion,
    canCrewReportIssue,
  );
  if (preflight) return preflight;

  const facade = createPostgresVisitFieldRuntimeFacadeMethods(resolved.value.rpc);
  const now = new Date().toISOString();
  const result = await facade.addVisitEvidence(
    resolved.value.actor,
    input.visitId,
    { kind: "INCIDENT_NOTE", text: note, capturedAt: now },
    {
      idempotencyKey: `crew-issue:${resolved.value.actor.userId}:${input.visitId}:${input.expectedVisitVersion}:${now}`,
      expectedVersion: input.expectedVisitVersion,
      now,
    },
  );

  if (!result.ok) return actionFailure(result.code, result.message);
  return { ok: true, message: "Issue reported to dispatch." };
}
