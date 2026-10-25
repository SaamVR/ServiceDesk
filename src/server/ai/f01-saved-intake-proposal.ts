import type { Result } from "../../contracts";
import { resolveStaffActor } from "@/features/operations/operational-product-runtime";
import { planSavedRequestReviewChecks } from "./request-review-checks";

/**
 * F01: deterministic classification of an *authorized persisted* request.
 * This is a staff-only proposal, not a customer message or an AI invocation.
 * No unsaved user text, provider calls, writes or booking actions.
 */
type ActorResolver = typeof resolveStaffActor;
export interface SavedIntakeDependencies { resolveActor?: ActorResolver }
export interface SavedIntakeInput {
  workspaceSlug: string;
  requestId: string;
  /** The exact saved record revision opened by the staff member. */
  expectedVersion: number;
}
export interface SavedIntakeProposal {
  state: "STAFF_CONFIRMATION_REQUIRED";
  classification: "CLARIFICATION_NEEDED" | "READY_FOR_REVIEW" | "SPECIALIST_REVIEW";
  evidence: {
    source: "AUTHORIZED_PERSISTED_REQUEST";
    workspaceId: string;
    requestId: string;
    requestVersion: number;
    branchId: string;
    serviceCode: string | null;
  };
  questions: Array<{ field: "serviceCode" | "bedrooms" | "bathrooms"; text: string }>;
  /** This function cannot record a confirmation; caller must verify staff approval separately. */
  staffConfirmed: false;
  customerContactSent: false;
}
const id = (v: unknown): v is string =>
  typeof v === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const fail = (code: string): Result<never> => ({
  ok: false, code, message: "Saved intake evidence requires staff reconciliation.",
});
type Row = Record<string, unknown>;
function validRecord(row: unknown, input: SavedIntakeInput, workspaceId: string): row is Row {
  if (!row || typeof row !== "object" || Array.isArray(row)) return false;
  const r = row as Row;
  return r.id === input.requestId && r.workspace_id === workspaceId &&
    id(r.branch_id) &&
    (r.service_id === null || id(r.service_id)) &&
    r.version === input.expectedVersion &&
    typeof r.status === "string" && /^[A-Z_]{2,40}$/.test(r.status) &&
    [r.bedrooms, r.bathrooms].every(x => x === null ||
      (typeof x === "number" && Number.isSafeInteger(x) && x >= 0 && x <= 10));
}
function equalSavedFields(a: Row, b: Row): boolean {
  return ["id", "workspace_id", "branch_id", "service_id", "version",
    "bedrooms", "bathrooms", "status"].every(k => a[k] === b[k]);
}
export async function planAuthorizedSavedIntake(
  input: SavedIntakeInput, deps: SavedIntakeDependencies = {},
): Promise<Result<SavedIntakeProposal>> {
  if (!input || typeof input.workspaceSlug !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.workspaceSlug) ||
      input.workspaceSlug.length > 40 || !id(input.requestId) ||
      !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1) {
    return fail("F01_INTAKE_INPUT_INVALID");
  }
  const resolver = deps.resolveActor ?? resolveStaffActor;
  let first: Awaited<ReturnType<ActorResolver>>;
  try { first = await resolver(input.workspaceSlug); }
  catch { return fail("F01_INTAKE_AUTH_UNAVAILABLE"); }
  if (!first.ok) return fail("F01_INTAKE_AUTH_DENIED");
  const { actor, workspace, branchScope, service } = first.value;
  if (workspace.slug !== input.workspaceSlug || actor.workspaceId !== workspace.id ||
      !actor.userId || !["OWNER", "DISPATCHER"].includes(actor.role) ||
      (actor.role === "DISPATCHER" &&
       (branchScope.mode !== "BRANCH" || !id(branchScope.selectedBranchId)))) {
    return fail("F01_INTAKE_AUTH_DENIED");
  }
  async function readRequest(db: typeof service): Promise<Row | null> {
    try {
      const result = await db.from("requests")
        .select("id,workspace_id,branch_id,service_id,version,bedrooms,bathrooms,status")
        .eq("workspace_id", workspace.id).eq("id", input.requestId).maybeSingle();
      return result.error ? null : result.data as Row | null;
    } catch { return null; }
  }
  const saved = await readRequest(service);
  if (!validRecord(saved, input, workspace.id)) return fail("F01_INTAKE_SOURCE_UNVERIFIED");
  if (actor.role === "DISPATCHER" && saved.branch_id !== branchScope.selectedBranchId)
    return fail("F01_INTAKE_SCOPE_DENIED");
  if (["CANCELLED", "CLOSED", "REJECTED", "DECLINED"].includes(saved.status as string))
    return fail("F01_INTAKE_CLOSED_REQUEST");

  const savedServiceId = saved.service_id;
  async function readCatalog(db: typeof service): Promise<Row | null> {
    if (savedServiceId === null) return null;
    try {
      const result = await db.from("service_catalog")
        .select("id,workspace_id,code,active,requires_review")
        .eq("workspace_id", workspace.id).eq("id", savedServiceId).maybeSingle();
      if (result.error || !result.data) return null;
      return result.data as Row;
    } catch { return null; }
  }
  const catalog = await readCatalog(service);
  if (saved.service_id !== null && (!catalog ||
      catalog.id !== saved.service_id || catalog.workspace_id !== workspace.id ||
      catalog.active !== true || typeof catalog.requires_review !== "boolean" ||
      !["STANDARD", "DEEP", "MOVE_OUT"].includes(String(catalog.code)))) {
    return fail("F01_INTAKE_SERVICE_UNVERIFIED");
  }
  const code = catalog ? catalog.code as string : null;
  const checks = planSavedRequestReviewChecks({
    serviceCode: code ?? "not recorded",
    bedrooms: saved.bedrooms as number | null,
    bathrooms: saved.bathrooms as number | null,
    status: saved.status as string,
  });
  if (!checks) return fail("F01_INTAKE_FACTS_INVALID");

  // A second independent read prevents displaying a draft created for a
  // revised/foreign saved request or for a staff member whose access changed.
  let second: Awaited<ReturnType<ActorResolver>>;
  try { second = await resolver(input.workspaceSlug); }
  catch { return fail("F01_INTAKE_REVALIDATION_UNAVAILABLE"); }
  if (!second.ok || second.value.workspace.id !== workspace.id ||
      second.value.workspace.slug !== workspace.slug ||
      second.value.actor.userId !== actor.userId ||
      second.value.actor.workspaceId !== actor.workspaceId ||
      second.value.actor.role !== actor.role ||
      (actor.role === "DISPATCHER" &&
       (second.value.branchScope.mode !== "BRANCH" ||
        second.value.branchScope.selectedBranchId !== branchScope.selectedBranchId))) {
    return fail("F01_INTAKE_AUTH_CHANGED");
  }
  const fresh = await readRequest(second.value.service);
  if (!fresh || !equalSavedFields(saved, fresh))
    return fail("F01_INTAKE_SOURCE_CHANGED");
  if (saved.service_id !== null) {
    const recentCatalog = await readCatalog(second.value.service);
    if (!recentCatalog || !catalog ||
        ["id", "workspace_id", "code", "active", "requires_review"]
          .some(k => recentCatalog[k] !== catalog[k]))
      return fail("F01_INTAKE_SERVICE_CHANGED");
  }
  return { ok: true, value: {
    state: "STAFF_CONFIRMATION_REQUIRED",
    classification: catalog?.requires_review === true ? "SPECIALIST_REVIEW" :
      checks.length ? "CLARIFICATION_NEEDED" : "READY_FOR_REVIEW",
    evidence: {
      source: "AUTHORIZED_PERSISTED_REQUEST", workspaceId: workspace.id,
      requestId: input.requestId, requestVersion: input.expectedVersion,
      branchId: saved.branch_id as string, serviceCode: code,
    },
    questions: checks.map(c => ({ field: c.field, text: c.question })),
    staffConfirmed: false, customerContactSent: false,
  } };
}
