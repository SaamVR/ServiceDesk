import type { SupabaseClient } from "@supabase/supabase-js";
import { QA_SEED_FIELDS, QA_SEED_LABEL, QA_SEED_SOURCE } from "./qa-sample-seed";

const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);

function onlyRow(value: unknown): Record<string, unknown> | null {
  if (!Array.isArray(value) || value.length !== 1 ||
      value[0] === null || typeof value[0] !== "object" ||
      Array.isArray(value[0])) return null;
  return value[0] as Record<string, unknown>;
}

/**
 * A ?qaSeed=created URL flag cannot authenticate a database write. Verify
 * the exact synthetic customer, property, MAIN branch and enquiry through
 * the SAME signed-in, RLS-limited Supabase client. No writes, service-role
 * key, provider sends, caller-chosen actor or cross-tenant fallback.
 */
export async function verifiedSavedQaSample(
  auth: SupabaseClient,
  actorUserId: string,
  workspaceId: string,
): Promise<boolean> {
  if (!uuid(actorUserId) || !uuid(workspaceId)) return false;
  try {
    const identity = await auth.auth.getUser();
    if (identity.error || identity.data.user?.id !== actorUserId ||
        !identity.data.user.email_confirmed_at) return false;

    const memberResult = await auth.from("memberships")
      .select("workspace_id,user_id,role,status")
      .eq("workspace_id", workspaceId).eq("user_id", actorUserId)
      .eq("role", "OWNER").eq("status", "ACTIVE").limit(2);
    const member = !memberResult.error && onlyRow(memberResult.data);
    if (!member || member.workspace_id !== workspaceId ||
        member.user_id !== actorUserId ||
        member.role !== "OWNER" || member.status !== "ACTIVE") return false;

    const customers = await auth.from("customers")
      .select("id,workspace_id,lead_source")
      .eq("workspace_id", workspaceId).eq("lead_source", QA_SEED_SOURCE).limit(2);
    const customer = !customers.error && onlyRow(customers.data);
    if (!customer || !uuid(customer.id) ||
        customer.workspace_id !== workspaceId ||
        customer.lead_source !== QA_SEED_SOURCE) return false;

    const properties = await auth.from("properties")
      .select("id,workspace_id,customer_id,branch_id,label")
      .eq("workspace_id", workspaceId).eq("customer_id", customer.id)
      .eq("label", QA_SEED_LABEL).limit(2);
    const property = !properties.error && onlyRow(properties.data);
    if (!property || !uuid(property.id) || !uuid(property.branch_id) ||
        property.workspace_id !== workspaceId ||
        property.customer_id !== customer.id ||
        property.label !== QA_SEED_LABEL) return false;

    // A renamed existing default branch is valid, but an inactive, missing or
    // foreign branch is never proof of a saved fictional QA enquiry.
    const branches = await auth.from("workspace_branches")
      .select("id,workspace_id,code,is_default,active")
      .eq("id", property.branch_id).eq("workspace_id", workspaceId)
      .eq("is_default", true).eq("active", true).limit(2);
    const branch = !branches.error && onlyRow(branches.data);
    if (!branch || branch.id !== property.branch_id ||
        branch.workspace_id !== workspaceId ||
        branch.is_default !== true || branch.active !== true ||
        typeof branch.code !== "string" ||
        !/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(branch.code)) return false;

    // Workspace ownership is not an unbounded authorization for every branch.
    // Verify this owner is assigned to the exact saved default branch as well.
    const assignments = await auth.from("branch_memberships")
      .select("workspace_id,branch_id,user_id,status")
      .eq("workspace_id", workspaceId).eq("branch_id", branch.id)
      .eq("user_id", actorUserId).eq("status", "ACTIVE").limit(2);
    const assignment = !assignments.error && onlyRow(assignments.data);
    if (!assignment || assignment.workspace_id !== workspaceId ||
        assignment.branch_id !== branch.id ||
        assignment.user_id !== actorUserId || assignment.status !== "ACTIVE")
      return false;

    const requests = await auth.from("requests")
      .select("id,workspace_id,customer_id,property_id,branch_id,structured_fields")
      .eq("workspace_id", workspaceId).eq("customer_id", customer.id)
      .eq("property_id", property.id)
      .contains("structured_fields", { qa_sample_version: QA_SEED_FIELDS.qa_sample_version })
      .limit(2);
    const request = !requests.error && onlyRow(requests.data);
    if (!request || !uuid(request.id) || request.workspace_id !== workspaceId ||
        request.customer_id !== customer.id || request.property_id !== property.id ||
        request.branch_id !== branch.id) return false;
    const fields = request.structured_fields;
    return !!fields && typeof fields === "object" && !Array.isArray(fields) &&
      (fields as Record<string, unknown>).qa_sample_version === QA_SEED_FIELDS.qa_sample_version &&
      (fields as Record<string, unknown>).synthetic === true &&
      (fields as Record<string, unknown>).provider_connected === false;
  } catch {
    return false;
  }
}
