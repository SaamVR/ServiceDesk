import type { Result, VisitDTO } from "../../../contracts";
import type { CalendarSyncState } from "../types";
import { planCalendarReconciliation, type CalendarReconciliationPlan } from "./reconciliation";

export type CalendarVisitProjectionAction = "UPSERT" | "CANCEL";
export type CalendarBindingStatus = "CONNECTED" | "DISCONNECTED" | "REAUTH_REQUIRED" | "CONFIGURATION_MISSING";

export interface CalendarCrewBinding {
  workspaceId: string;
  crewId: string;
  calendarId: string;
  status: CalendarBindingStatus;
  syncToken?: string;
  lastSyncedAt?: string;
  stale: boolean;
  timezone: string;
}

export interface CalendarCrewBindingResolver {
  resolve(input: { workspaceId: string; crewId: string }): Promise<Result<CalendarCrewBinding>>;
}

export interface ServiceDeskManagedVisitCalendarProjection {
  action: CalendarVisitProjectionAction;
  workspaceId: string;
  visitId: string;
  requestId: string;
  quoteId: string;
  crewId: string;
  calendarId: string;
  startAt: string;
  endAt: string;
  timezone: string;
  summary: string;
  idempotencyKey: string;
  providerMappingKey: string;
  providerEventId?: string;
  visit: VisitDTO;
  canMutateBookingTruth: false;
}

export interface BuildVisitCalendarProjectionInput {
  action: CalendarVisitProjectionAction;
  visit: VisitDTO;
  binding: CalendarCrewBinding;
  summary: string;
  idempotencyKey: string;
  providerEventId?: string;
}

export interface ResolvedCalendarCrewBinding {
  binding: CalendarCrewBinding;
  freshness: CalendarReconciliationPlan;
}

function nonblank(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function visitEndAt(visit: VisitDTO): string {
  const startMs = new Date(visit.startAt).getTime();
  if (!Number.isFinite(startMs)) throw new Error("VISIT_START_INVALID");
  return new Date(startMs + (visit.serviceMinutes + visit.bufferMinutes) * 60_000).toISOString();
}

export function calendarProviderMappingKey(input: { workspaceId: string; crewId: string; visitId: string }): string {
  return `google-calendar:${input.workspaceId}:${input.crewId}:${input.visitId}`;
}

export async function resolveAuthoritativeCalendarCrewBinding(
  resolver: CalendarCrewBindingResolver,
  input: { workspaceId: string; crewId: string; now: string; freshnessThresholdMinutes?: number },
): Promise<Result<ResolvedCalendarCrewBinding>> {
  if (!nonblank(input.workspaceId) || !nonblank(input.crewId)) {
    return { ok: false, code: "CALENDAR_BINDING_IDENTITY_INVALID", message: "Workspace and crew identity are required before resolving a calendar binding." };
  }

  const resolved = await resolver.resolve({ workspaceId: input.workspaceId, crewId: input.crewId });
  if (!resolved.ok) return resolved;
  const binding = resolved.value;

  if (binding.workspaceId !== input.workspaceId || binding.crewId !== input.crewId) {
    return { ok: false, code: "WORKSPACE_MISMATCH", message: "Resolved calendar binding identity did not match requested workspace/crew." };
  }
  if (!nonblank(binding.calendarId)) {
    return { ok: false, code: "CALENDAR_BINDING_MISSING", message: "Crew has no configured Google Calendar mapping." };
  }
  if (binding.status === "CONFIGURATION_MISSING") {
    return { ok: false, code: "CALENDAR_NOT_CONFIGURED", message: "Google Calendar is not configured for this crew." };
  }
  if (binding.status === "DISCONNECTED") {
    return { ok: false, code: "CALENDAR_DISCONNECTED", message: "Google Calendar is disconnected for this crew." };
  }
  if (binding.status === "REAUTH_REQUIRED") {
    return { ok: false, code: "CALENDAR_REAUTH_REQUIRED", message: "Google Calendar requires reauthorization for this crew." };
  }

  const freshness = planCalendarReconciliation({
    workspaceId: binding.workspaceId,
    crewId: binding.crewId,
    calendarId: binding.calendarId,
    syncToken: binding.syncToken,
    stale: binding.stale,
    lastSyncedAt: binding.lastSyncedAt,
    now: input.now,
    freshnessThresholdMinutes: input.freshnessThresholdMinutes,
  });
  if (freshness.blocksAvailability) {
    return { ok: false, code: freshness.reason === "SYNC_TOKEN_EXPIRED" ? "CALENDAR_SYNC_TOKEN_EXPIRED" : "CALENDAR_SYNC_STALE", message: freshness.notes.join(" ") };
  }

  return { ok: true, value: { binding, freshness } };
}

export function buildServiceDeskManagedVisitCalendarProjection(input: BuildVisitCalendarProjectionInput): Result<ServiceDeskManagedVisitCalendarProjection> {
  const visit = input.visit;
  if (!nonblank(visit.crewId)) {
    return { ok: false, code: "VISIT_CREW_MISSING", message: "Visit must have an assigned crew before calendar projection." };
  }
  if (visit.workspaceId !== input.binding.workspaceId || visit.crewId !== input.binding.crewId) {
    return { ok: false, code: "WORKSPACE_MISMATCH", message: "Visit workspace/crew does not match resolved calendar binding." };
  }
  if (!nonblank(input.summary) || !nonblank(input.idempotencyKey) || !nonblank(input.binding.timezone)) {
    return { ok: false, code: "CALENDAR_VISIT_PROJECTION_INVALID", message: "Calendar visit projection requires summary, timezone and idempotency key." };
  }

  let endAt: string;
  try { endAt = visitEndAt(visit); } catch { return { ok: false, code: "VISIT_START_INVALID", message: "Visit startAt must be a valid ISO timestamp." }; }

  return {
    ok: true,
    value: {
      action: input.action,
      workspaceId: visit.workspaceId,
      visitId: visit.id,
      requestId: visit.requestId,
      quoteId: visit.quoteId,
      crewId: visit.crewId,
      calendarId: input.binding.calendarId,
      startAt: visit.startAt,
      endAt,
      timezone: input.binding.timezone,
      summary: input.summary,
      idempotencyKey: input.idempotencyKey,
      providerMappingKey: calendarProviderMappingKey({ workspaceId: visit.workspaceId, crewId: visit.crewId, visitId: visit.id }),
      providerEventId: input.providerEventId,
      visit,
      canMutateBookingTruth: false,
    },
  };
}

export function projectionToCalendarSyncState(projection: ServiceDeskManagedVisitCalendarProjection): CalendarSyncState {
  return { workspaceId: projection.workspaceId, crewId: projection.crewId, calendarId: projection.calendarId, stale: false };
}
