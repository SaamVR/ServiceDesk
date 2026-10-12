import { randomUUID } from "node:crypto";
import {
  requireOperationalBranchResource,
  resolveStaffActor,
  type OperationalActionResult,
} from "./operational-product-runtime";
import { createPostgresRequestQuoteCapacityFacadeMethods } from "@/server/core/request-quote-capacity-postgres";
import { parseRequestQuoteInputs } from "./request-quote-input";

/**
 * Finish a real saved cleaning enquiry with human-confirmed facts.
 * A photo or AI suggestion does not silently fill or overwrite these fields.
 * Only a verified active OWNER or DISPATCHER can perform the mutation.
 */
export async function completeOperationalRequestQuoteInputs(
  workspaceSlug: string,
  form: FormData,
): Promise<OperationalActionResult> {
  const parsed = parseRequestQuoteInputs(form);
  if (!parsed.ok) return { ok: false, message: parsed.message };
  const { requestId, serviceCode, bedrooms, bathrooms, expectedVersion } = parsed.value;

  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };
  const { actor, workspace, branchScope, service, rpc } = resolved.value;
  if (workspace.slug !== workspaceSlug ||
      actor.workspaceId !== workspace.id ||
      (actor.role !== "OWNER" && actor.role !== "DISPATCHER")) {
    return { ok: false, message: "Only an authorized owner or dispatcher may complete a cleaning request." };
  }
  const denied = await requireOperationalBranchResource(resolved.value, "request", requestId);
  if (denied) return denied;

  try {
    const current = await service.from("requests")
      .select("id,workspace_id,branch_id,version,status")
      .eq("workspace_id", workspace.id).eq("id", requestId).maybeSingle();
    if (current.error || !current.data || current.data.id !== requestId ||
        current.data.workspace_id !== workspace.id) {
      return { ok: false, message: "The saved request could not be verified. Reload the Requests workspace." };
    }
    if (!Number.isSafeInteger(current.data.version) ||
        current.data.version !== expectedVersion) {
      return { ok: false, message: "This request changed since you opened it. Reload before saving." };
    }
    if (!["NEW", "COLLECTING", "READY", "NEEDS_REVIEW"].includes(current.data.status)) {
      return { ok: false, message: "This request can no longer be edited for pricing. Review its existing quote or lifecycle." };
    }
    const branchId = current.data.branch_id;
    if (typeof branchId !== "string" ||
        !branchScope.branches.some(branch => branch.id === branchId) ||
        (branchScope.mode === "BRANCH" && branchScope.selectedBranchId !== branchId)) {
      return { ok: false, message: "The request's active branch could not be authorized." };
    }
    const catalog = await service.from("service_catalog")
      .select("id,code,active")
      .eq("workspace_id", workspace.id)
      .eq("code", serviceCode).eq("active", true).maybeSingle();
    if (catalog.error || !catalog.data || catalog.data.code !== serviceCode ||
        catalog.data.active !== true || typeof catalog.data.id !== "string") {
      return { ok: false, message: "This cleaning service is not active. Ask the owner to configure the real service catalog first." };
    }

    // Existing versioned RPC verifies staff membership and service ownership
    // again in the database. No raw requests UPDATE or client-chosen tenant.
    const facade = createPostgresRequestQuoteCapacityFacadeMethods(rpc);
    const result = await facade.updateRequest(actor, requestId,
      { serviceCode, bedrooms, bathrooms }, {
        expectedVersion,
        idempotencyKey: "human-request-details-" + randomUUID(),
        now: new Date().toISOString(),
      });
    if (!result.ok) {
      return { ok: false,
        message: result.code === "VERSION_CONFLICT"
          ? "Another staff member changed this request. Reload and review the new values."
          : "The request update was not verified. Reload the saved request before retrying." };
    }

    // Do not infer success from an RPC acknowledgement alone. The actual
    // persisted service ID, room counts, version and tenant must match.
    const saved = await service.from("requests")
      .select("workspace_id,branch_id,service_id,bedrooms,bathrooms,version")
      .eq("workspace_id", workspace.id).eq("id", requestId).maybeSingle();
    if (saved.error || !saved.data ||
        saved.data.workspace_id !== workspace.id ||
        saved.data.branch_id !== branchId ||
        saved.data.service_id !== catalog.data.id ||
        saved.data.bedrooms !== bedrooms ||
        saved.data.bathrooms !== bathrooms ||
        saved.data.version !== expectedVersion + 1) {
      return { ok: false,
        message: "Request details may have saved, but the readback was not verified. Reload before retrying." };
    }
    return { ok: true,
      message: "Human-confirmed service and room details saved. Quote calculation still requires the branch's active approved price book." };
  } catch {
    return { ok: false,
      message: "The request save could not be verified. Reload this record before attempting the operation again." };
  }
}
