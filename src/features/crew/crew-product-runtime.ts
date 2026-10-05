import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type {
  ActorContext,
  RequestDTO,
  VisitChecklistItemDTO,
  VisitDTO,
  VisitEvidenceDTO,
} from "@/contracts";
import { createCrewSyncState } from "./sync-state";
import { createPostgresVisitFieldRuntimeFacadeMethods } from "@/server/core/visit-field-postgres";
import type { SupabaseRpcClient } from "@/server/core/payment-application-postgres";
import type {
  CrewAuthorizedContext,
  CrewJobDetailInput,
  CrewTodayJobInput,
} from "./v2-field-models";

type Row = Record<string, unknown>;

export interface CrewWorkspaceContext {
  workspace: { id: string; slug: string; name: string; timeZone: string };
  actor: ActorContext;
  crewIds: string[];
  service: SupabaseClient;
}

export type CrewProductResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      kind:
        | "configuration"
        | "authentication"
        | "authorization"
        | "workspace_selection"
        | "not_found"
        | "server";
      message: string;
    };

function runtimeConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceRoleKey) return undefined;
  return { url, anonKey, serviceRoleKey };
}

function rows(data: unknown): Row[] {
  return Array.isArray(data)
    ? data.filter((item): item is Row => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function text(row: Row | undefined, key: string): string | undefined {
  const value = row?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function number(row: Row | undefined, key: string, fallback = 0): number {
  const value = row?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function unique(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function localDateKey(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

async function resolveCrewWorkspace(workspaceSlug?: string): Promise<CrewProductResult<CrewWorkspaceContext>> {
  const config = runtimeConfig();
  if (!config) {
    return {
      ok: false,
      kind: "configuration",
      message: "Crew access is not connected to the production data service yet.",
    };
  }

  const cookieStore = await cookies();
  const auth = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Authentication middleware owns cookie refresh.
      },
    },
  });
  const { data: authData, error: authError } = await auth.auth.getUser();
  if (authError || !authData.user) {
    return { ok: false, kind: "authentication", message: "Sign in with an active crew account." };
  }

  const service = createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const membershipResult = await service
    .from("crew_members")
    .select("workspace_id,crew_id")
    .eq("user_id", authData.user.id)
    .eq("active", true)
    .limit(50);
  if (membershipResult.error) {
    return { ok: false, kind: "server", message: "Crew access could not be loaded." };
  }

  const membershipRows = rows(membershipResult.data);
  const workspaceIds = unique(membershipRows.map((row) => text(row, "workspace_id")));
  if (workspaceIds.length === 0) {
    return { ok: false, kind: "authorization", message: "No active crew assignment is linked to this account." };
  }

  const workspaceResult = await service
    .from("workspaces")
    .select("id,slug,name,timezone")
    .in("id", workspaceIds);
  if (workspaceResult.error) {
    return { ok: false, kind: "server", message: "Crew workspace details could not be loaded." };
  }

  const workspaces = rows(workspaceResult.data);
  const selected = workspaceSlug
    ? workspaces.find((row) => String(row.slug) === workspaceSlug)
    : workspaces.length === 1
      ? workspaces[0]
      : undefined;

  if (!selected) {
    return {
      ok: false,
      kind: workspaceSlug ? "authorization" : "workspace_selection",
      message: workspaceSlug
        ? "This crew account does not have access to the requested workspace."
        : "This account belongs to more than one crew workspace. Open a workspace-specific crew link.",
    };
  }

  const workspaceId = String(selected.id);
  const crewIds = unique(
    membershipRows
      .filter((row) => String(row.workspace_id) === workspaceId)
      .map((row) => text(row, "crew_id")),
  );
  if (crewIds.length === 0) {
    return { ok: false, kind: "authorization", message: "No active crew assignment is available in this workspace." };
  }

  return {
    ok: true,
    value: {
      workspace: {
        id: workspaceId,
        slug: String(selected.slug),
        name: String(selected.name),
        timeZone: text(selected, "timezone") ?? "UTC",
      },
      actor: { workspaceId, userId: authData.user.id, role: "CREW" },
      crewIds,
      service,
    },
  };
}

function mapRequest(row: Row, workspaceId: string, serviceCode?: string): RequestDTO {
  return {
    id: String(row.id),
    workspaceId,
    customerId: text(row, "customer_id"),
    propertyId: text(row, "property_id"),
    serviceCode,
    status: String(row.status) as RequestDTO["status"],
    bedrooms: typeof row.bedrooms === "number" ? row.bedrooms : undefined,
    bathrooms: typeof row.bathrooms === "number" ? row.bathrooms : undefined,
    requestedStartAt: text(row, "requested_start_at"),
    version: number(row, "version", 1),
    createdAt: text(row, "created_at") ?? new Date(0).toISOString(),
    updatedAt: text(row, "updated_at") ?? text(row, "created_at") ?? new Date(0).toISOString(),
  };
}

function mapVisit(row: Row, quote: Row | undefined, workspaceId: string): VisitDTO {
  const rawStatus = String(row.status);
  const status =
    rawStatus === "SCHEDULED"
      ? "CONFIRMED"
      : rawStatus === "NEEDS_REVIEW"
        ? "PENDING_REVIEW"
        : rawStatus;
  const startAt = String(row.starts_at);
  const endsAt = text(row, "ends_at");
  const derivedMinutes = endsAt
    ? Math.max(0, Math.round((new Date(endsAt).getTime() - new Date(startAt).getTime()) / 60000))
    : 0;
  const bufferMinutes = number(quote, "buffer_minutes", 0);
  return {
    id: String(row.id),
    workspaceId,
    requestId: String(row.request_id),
    quoteId: text(row, "quote_id") ?? "",
    crewId: text(row, "crew_id"),
    status: status as VisitDTO["status"],
    startAt,
    serviceMinutes: number(quote, "duration_minutes", Math.max(0, derivedMinutes - bufferMinutes)),
    bufferMinutes,
    version: number(row, "version", 1),
  };
}

function mapEvidence(row: Row, workspaceId: string): VisitEvidenceDTO {
  return {
    id: String(row.id),
    workspaceId,
    visitId: String(row.visit_id),
    kind: String(row.kind) as VisitEvidenceDTO["kind"],
    mediaReference: row.media_reference as VisitEvidenceDTO["mediaReference"],
    text: text(row, "text"),
    capturedAt: String(row.captured_at),
    submittedByUserId: String(row.submitted_by_user_id),
    createdAt: String(row.created_at),
  };
}

function mapChecklist(row: Row, workspaceId: string): VisitChecklistItemDTO {
  return {
    id: String(row.id),
    workspaceId,
    visitId: String(row.visit_id),
    itemKey: String(row.item_key),
    completed: Boolean(row.completed),
    note: text(row, "note"),
    updatedByUserId: String(row.updated_by_user_id),
    updatedAt: String(row.updated_at),
    version: number(row, "version", 1),
  };
}

async function loadCrewJobs(context: CrewWorkspaceContext) {
  const { service, workspace, crewIds } = context;
  const visitResult = await service
    .from("visits")
    .select("*")
    .eq("workspace_id", workspace.id)
    .in("crew_id", crewIds)
    .order("starts_at", { ascending: true })
    .limit(250);
  if (visitResult.error) throw new Error("VISITS");

  const visitRows = rows(visitResult.data);
  const requestIds = unique(visitRows.map((row) => text(row, "request_id")));
  const quoteIds = unique(visitRows.map((row) => text(row, "quote_id")));

  const requestResult = requestIds.length
    ? await service.from("requests").select("*").eq("workspace_id", workspace.id).in("id", requestIds)
    : { data: [], error: null };
  const quoteResult = quoteIds.length
    ? await service.from("quotes").select("*").eq("workspace_id", workspace.id).in("id", quoteIds)
    : { data: [], error: null };
  if (requestResult.error || quoteResult.error) throw new Error("REQUESTS_OR_QUOTES");

  const requestRows = rows(requestResult.data);
  const propertyIds = unique(requestRows.map((row) => text(row, "property_id")));
  const customerIds = unique(requestRows.map((row) => text(row, "customer_id")));
  const serviceIds = unique(requestRows.map((row) => text(row, "service_id")));

  const [propertyResult, customerResult, serviceResult] = await Promise.all([
    propertyIds.length
      ? service.from("properties").select("*").eq("workspace_id", workspace.id).in("id", propertyIds)
      : Promise.resolve({ data: [], error: null }),
    customerIds.length
      ? service.from("customers").select("id,display_name").eq("workspace_id", workspace.id).in("id", customerIds)
      : Promise.resolve({ data: [], error: null }),
    serviceIds.length
      ? service.from("service_catalog").select("id,code").eq("workspace_id", workspace.id).in("id", serviceIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (propertyResult.error || customerResult.error || serviceResult.error) throw new Error("JOB_CONTEXT");

  const requestsById = new Map(requestRows.map((row) => [String(row.id), row]));
  const quotesById = new Map(rows(quoteResult.data).map((row) => [String(row.id), row]));
  const propertiesById = new Map(rows(propertyResult.data).map((row) => [String(row.id), row]));
  const customersById = new Map(rows(customerResult.data).map((row) => [String(row.id), row]));
  const servicesById = new Map(rows(serviceResult.data).map((row) => [String(row.id), row]));

  return visitRows.map((visitRow) => {
    const requestRow = requestsById.get(String(visitRow.request_id));
    const quoteRow = quotesById.get(String(visitRow.quote_id));
    if (!requestRow) return undefined;

    const property = propertiesById.get(String(requestRow.property_id));
    const customer = customersById.get(String(requestRow.customer_id));
    const serviceRow = servicesById.get(String(requestRow.service_id));
    const contextValue: CrewAuthorizedContext = {
      authorized: true,
      locationLabel: property
        ? [text(property, "address_line1"), text(property, "city"), text(property, "postal_code")]
            .filter(Boolean)
            .join(", ")
        : undefined,
      customerLabel: text(customer, "display_name"),
      serviceNotes: text(property, "service_notes"),
      accessNotes: text(property, "access_notes"),
      highPriorityNotes: text(property, "access_notes") ? [String(property?.access_notes)] : [],
    };

    return {
      request: mapRequest(requestRow, workspace.id, text(serviceRow, "code")),
      visit: mapVisit(visitRow, quoteRow, workspace.id),
      context: contextValue,
      sync: createCrewSyncState(true),
    } satisfies CrewTodayJobInput;
  }).filter((job): job is CrewTodayJobInput => Boolean(job));
}

export async function loadCrewToday(
  workspaceSlug?: string,
  now = new Date().toISOString(),
): Promise<CrewProductResult<{ workspace: CrewWorkspaceContext["workspace"]; jobs: CrewTodayJobInput[] }>> {
  const resolved = await resolveCrewWorkspace(workspaceSlug);
  if (!resolved.ok) return resolved;
  try {
    const allJobs = await loadCrewJobs(resolved.value);
    const today = localDateKey(now, resolved.value.workspace.timeZone);
    return {
      ok: true,
      value: {
        workspace: resolved.value.workspace,
        jobs: allJobs.filter((job) => localDateKey(job.visit.startAt, resolved.value.workspace.timeZone) === today),
      },
    };
  } catch {
    return { ok: false, kind: "server", message: "Today's assigned jobs could not be loaded." };
  }
}

export async function loadCrewJob(
  visitId: string,
  workspaceSlug?: string,
): Promise<CrewProductResult<{ workspace: CrewWorkspaceContext["workspace"]; job: CrewJobDetailInput }>> {
  const resolved = await resolveCrewWorkspace(workspaceSlug);
  if (!resolved.ok) return resolved;
  try {
    const allJobs = await loadCrewJobs(resolved.value);
    const base = allJobs.find((job) => job.visit.id === visitId);
    if (!base) return { ok: false, kind: "not_found", message: "This job is not assigned to your crew." };

    const [evidenceResult, checklistResult] = await Promise.all([
      resolved.value.service
        .from("visit_evidence")
        .select("*")
        .eq("workspace_id", resolved.value.workspace.id)
        .eq("visit_id", visitId)
        .order("captured_at", { ascending: true }),
      resolved.value.service
        .from("visit_checklist_items")
        .select("*")
        .eq("workspace_id", resolved.value.workspace.id)
        .eq("visit_id", visitId)
        .order("item_key", { ascending: true }),
    ]);
    if (evidenceResult.error || checklistResult.error) throw new Error("FIELD_STATE");

    return {
      ok: true,
      value: {
        workspace: resolved.value.workspace,
        job: {
          ...base,
          evidence: rows(evidenceResult.data).map((row) => mapEvidence(row, resolved.value.workspace.id)),
          checklist: rows(checklistResult.data).map((row) => mapChecklist(row, resolved.value.workspace.id)),
          uploadTransportAvailable: false,
        },
      },
    };
  } catch {
    return { ok: false, kind: "server", message: "Job details could not be loaded." };
  }
}


export type CrewProductActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function transitionCrewJob(
  workspaceSlug: string | undefined,
  visitId: string,
  action: "EN_ROUTE" | "START" | "SUBMIT_REVIEW",
  expectedVersion: number,
): Promise<CrewProductActionResult> {
  const resolved = await resolveCrewWorkspace(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };
  if (!visitId || !Number.isInteger(expectedVersion) || expectedVersion <= 0) {
    return { ok: false, message: "Refresh this job and try again." };
  }

  const facade = createPostgresVisitFieldRuntimeFacadeMethods(
    resolved.value.service as unknown as SupabaseRpcClient,
  );
  const result = await facade.transitionVisit(
    resolved.value.actor,
    visitId,
    action,
    {
      idempotencyKey: "crew-transition-" + crypto.randomUUID(),
      expectedVersion,
      now: new Date().toISOString(),
    },
  );

  return result.ok
    ? { ok: true, message: "Job status updated." }
    : {
        ok: false,
        message:
          result.code === "VERSION_CONFLICT"
            ? "This job changed elsewhere. Refresh before trying again."
            : result.message,
      };
}

export async function updateCrewChecklistItem(
  workspaceSlug: string | undefined,
  visitId: string,
  itemKey: string,
  completed: boolean,
  expectedVersion: number,
  note?: string,
): Promise<CrewProductActionResult> {
  const resolved = await resolveCrewWorkspace(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };
  if (!visitId || !itemKey.trim() || !Number.isInteger(expectedVersion) || expectedVersion <= 0) {
    return { ok: false, message: "Refresh this job and try again." };
  }

  const facade = createPostgresVisitFieldRuntimeFacadeMethods(
    resolved.value.service as unknown as SupabaseRpcClient,
  );
  const result = await facade.setVisitChecklistItem(
    resolved.value.actor,
    visitId,
    { itemKey: itemKey.trim(), completed, note: note?.trim() || undefined },
    {
      idempotencyKey: "crew-checklist-" + crypto.randomUUID(),
      expectedVersion,
      now: new Date().toISOString(),
    },
  );

  return result.ok
    ? { ok: true, message: completed ? "Checklist item completed." : "Checklist item reopened." }
    : {
        ok: false,
        message:
          result.code === "VERSION_CONFLICT"
            ? "This job changed elsewhere. Refresh before trying again."
            : result.message,
      };
}

export async function addCrewFieldNote(
  workspaceSlug: string | undefined,
  visitId: string,
  kind: "TIME_MATERIAL_NOTE" | "INCIDENT_NOTE",
  note: string,
  expectedVersion: number,
): Promise<CrewProductActionResult> {
  const trimmed = note.trim();
  if (!trimmed) return { ok: false, message: "Write a note before saving." };

  const resolved = await resolveCrewWorkspace(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };
  if (!visitId || !Number.isInteger(expectedVersion) || expectedVersion <= 0) {
    return { ok: false, message: "Refresh this job and try again." };
  }

  const facade = createPostgresVisitFieldRuntimeFacadeMethods(
    resolved.value.service as unknown as SupabaseRpcClient,
  );
  const now = new Date().toISOString();
  const result = await facade.addVisitEvidence(
    resolved.value.actor,
    visitId,
    { kind, text: trimmed, capturedAt: now },
    {
      idempotencyKey: "crew-note-" + crypto.randomUUID(),
      expectedVersion,
      now,
    },
  );

  return result.ok
    ? { ok: true, message: kind === "INCIDENT_NOTE" ? "Issue reported to the office." : "Job note saved." }
    : {
        ok: false,
        message:
          result.code === "VERSION_CONFLICT"
            ? "This job changed elsewhere. Refresh before trying again."
            : result.message,
      };
}
