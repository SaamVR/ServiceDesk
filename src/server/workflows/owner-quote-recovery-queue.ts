import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveStaffActor } from "@/features/operations/operational-product-runtime";
import { operationalDatabaseMode } from "@/features/auth/operational-preview-mode";

export type QuoteQueueState =
  | "PENDING" | "PROCESSING" | "RETRY_PENDING"
  | "SUCCEEDED" | "SKIPPED" | "DEAD_LETTER";

const states: readonly QuoteQueueState[] = [
  "PENDING", "PROCESSING", "RETRY_PENDING",
  "SUCCEEDED", "SKIPPED", "DEAD_LETTER",
];

export type OwnerQuoteRecoverySummary =
  | { state: "AVAILABLE"; counts: Record<QuoteQueueState, number>; health: { dueNow: number; expiredLeases: number } }
  | { state: "UNAVAILABLE" }
  | { state: "OWNER_REQUIRED" };

type Resolver = typeof resolveStaffActor;
type Service = Pick<SupabaseClient, "from">;
export interface OwnerQuoteRecoverySummaryDependencies {
  resolveActor?: Resolver;
  mode?: typeof operationalDatabaseMode;
  count?: (service: Service, workspaceId: string, state: QuoteQueueState) => Promise<number | null>;
  health?: (service: Service, workspaceId: string, now: string) => Promise<{ dueNow:number; expiredLeases:number } | null>;
  now?: () => string;
}
const uuid = (s: unknown): s is string => typeof s === "string" &&
  /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(s);

/** Service-only, *count-only* scoped read. Never return quote IDs or customer data. */
async function persistedCount(
  service: Service, workspaceId: string, state: QuoteQueueState,
): Promise<number | null> {
  const response = await service.from("workflow_source_events")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("state", state);
  if (response.error || !Number.isSafeInteger(response.count) ||
      response.count === null || response.count < 0) return null;
  return response.count;
}

/** Read-only, tenant-scoped count queries. No event or customer rows escape. */
async function persistedHealth(service: Service, workspaceId: string, now: string) {
  const due = await service.from("workflow_source_events")
    .select("id", {count:"exact",head:true})
    .eq("workspace_id",workspaceId)
    .in("state",["PENDING","RETRY_PENDING"])
    .lte("next_attempt_at",now);
  if (due.error || due.count === null || !Number.isSafeInteger(due.count) || due.count < 0) return null;
  const expired = await service.from("workflow_source_events")
    .select("id", {count:"exact",head:true})
    .eq("workspace_id",workspaceId)
    .eq("state","PROCESSING")
    .lt("locked_until",now);
  if (expired.error || expired.count === null || !Number.isSafeInteger(expired.count) || expired.count < 0) return null;
  return {dueNow:due.count as number,expiredLeases:expired.count as number};
}

/**
 * Owner-only signed-in aggregate. Missing migration, DB errors or partial
 * query results are UNAVAILABLE, NEVER silently cast to an empty queue.
 * Does not activate the worker and does not report any provider delivery.
 */
export async function readOwnerQuoteRecoverySummary(
  workspaceSlug: string,
  deps: OwnerQuoteRecoverySummaryDependencies = {},
): Promise<OwnerQuoteRecoverySummary> {
  if ((deps.mode ?? operationalDatabaseMode)() !== "SERVICE_ROLE") {
    return { state: "UNAVAILABLE" };
  }
  try {
    const actorResult = await (deps.resolveActor ?? resolveStaffActor)(workspaceSlug);
    if (!actorResult.ok) return { state: "OWNER_REQUIRED" };
    const { actor, workspace, service } = actorResult.value;
    if (workspace.slug !== workspaceSlug || !uuid(workspace.id) ||
        !uuid(actor.userId) || actor.role !== "OWNER" ||
        actor.workspaceId !== workspace.id) return { state: "OWNER_REQUIRED" };
    const count = deps.count ?? persistedCount;
    // 0063 may not exist yet. Read one state first to avoid five wasted
    // service-role queries on an uninstalled or unavailable migration.
    const first = await count(service, workspace.id, "PENDING");
    if (first === null || !Number.isSafeInteger(first) || first < 0) {
      return { state: "UNAVAILABLE" };
    }
    const rest = await Promise.all(states.slice(1).map(async state =>
      count(service, workspace.id, state)));
    if (rest.some(n => n === null || !Number.isSafeInteger(n) || n < 0)) {
      return { state: "UNAVAILABLE" };
    }
    const now = (deps.now ?? (()=>new Date().toISOString()))();
    if (!Number.isFinite(Date.parse(now))) return {state:"UNAVAILABLE"};
    const health = await (deps.health ?? persistedHealth)(service,workspace.id,now);
    if (!health || !Number.isSafeInteger(health.dueNow) ||
        !Number.isSafeInteger(health.expiredLeases) ||
        health.dueNow < 0 || health.expiredLeases < 0) return {state:"UNAVAILABLE"};
    return {
      state: "AVAILABLE",
      health,
      counts: Object.fromEntries(
        states.map((state, index) => [state, index === 0 ? first : rest[index - 1]]),
      ) as Record<QuoteQueueState, number>,
    };
  } catch {
    return { state: "UNAVAILABLE" };
  }
}
