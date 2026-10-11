import type { SupabaseClient } from "@supabase/supabase-js";

/** Fully fictional data for an explicitly opted-in, authenticated QA workspace. */
export const QA_SEED_SOURCE = "SERVICEDESK_QA_SAMPLE_V1";
export const QA_SEED_LABEL = "ServiceDesk QA sample property";
export const QA_SEED_FIELDS = Object.freeze({
  qa_sample_version: 1,
  provider_connected: false,
  synthetic: true,
  description: "Fictional move-out enquiry; do not contact a person or trigger a provider",
});

export interface QaSeedWorkspace { id: string; slug: string }
export type QaSeedResult =
  | { ok: true; customerId: string; requestId: string; reused: boolean }
  | { ok: false; stage: "branch" | "customer" | "property" | "request" };

const isUuid = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);

/**
 * Writes as the verified owner's SSR Supabase client, NEVER as service_role.
 * Seeding is resumable: any successfully written synthetic step can be
 * reused on the next invocation, rather than duplicating every record.
 *
 * This does not pretend to be a DB-atomic transaction, and concurrent
 * clicks may still race. Operators should run it only on test workspaces.
 */
export async function seedQaWorkspaceData(
  auth: SupabaseClient,
  workspace: QaSeedWorkspace,
): Promise<QaSeedResult> {
  if (!isUuid(workspace.id) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspace.slug)) {
    return { ok: false, stage: "branch" };
  }

  const branch = await auth.from("workspace_branches")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("code", "MAIN")
    .maybeSingle();
  const branchId = branch.data?.id;
  if (branch.error || !isUuid(branchId)) return { ok: false, stage: "branch" };

  let reused = true;
  const existingCustomers = await auth.from("customers")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("lead_source", QA_SEED_SOURCE)
    .limit(2);
  if (existingCustomers.error || (existingCustomers.data ?? []).length > 1) {
    return { ok: false, stage: "customer" };
  }
  let customerId = existingCustomers.data?.[0]?.id;
  if (!customerId) {
    const created = await auth.from("customers")
      .insert({
        workspace_id: workspace.id,
        display_name: "Casey Sample (fictional)",
        lead_source: QA_SEED_SOURCE,
        notes: "Synthetic QA data only. No real customer or contact details.",
      })
      .select("id")
      .single();
    if (created.error) return { ok: false, stage: "customer" };
    customerId = created.data?.id;
    reused = false;
  }
  if (!isUuid(customerId)) return { ok: false, stage: "customer" };

  const existingProperties = await auth.from("properties")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("customer_id", customerId)
    .eq("label", QA_SEED_LABEL)
    .limit(2);
  if (existingProperties.error || (existingProperties.data ?? []).length > 1) {
    return { ok: false, stage: "property" };
  }
  let propertyId = existingProperties.data?.[0]?.id;
  if (!propertyId) {
    const created = await auth.from("properties")
      .insert({
        workspace_id: workspace.id,
        customer_id: customerId,
        branch_id: branchId,
        label: QA_SEED_LABEL,
        address_line1: "Fictional QA address - not a real property",
        city: "Example City",
        postal_code: "00000",
        country_code: "US",
      })
      .select("id")
      .single();
    if (created.error) return { ok: false, stage: "property" };
    propertyId = created.data?.id;
    reused = false;
  }
  if (!isUuid(propertyId)) return { ok: false, stage: "property" };

  const existingRequests = await auth.from("requests")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("customer_id", customerId)
    .eq("property_id", propertyId)
    .contains("structured_fields", { qa_sample_version: QA_SEED_FIELDS.qa_sample_version })
    .limit(2);
  if (existingRequests.error || (existingRequests.data ?? []).length > 1) {
    return { ok: false, stage: "request" };
  }
  let requestId = existingRequests.data?.[0]?.id;
  if (!requestId) {
    const created = await auth.from("requests")
      .insert({
        workspace_id: workspace.id,
        branch_id: branchId,
        customer_id: customerId,
        property_id: propertyId,
        bedrooms: 3,
        bathrooms: 2,
        status: "NEW",
        structured_fields: QA_SEED_FIELDS,
      })
      .select("id")
      .single();
    if (created.error) return { ok: false, stage: "request" };
    requestId = created.data?.id;
    reused = false;
  }
  if (!isUuid(requestId)) return { ok: false, stage: "request" };

  // A successful insert response alone is not release evidence. Prove all
  // three rows can be read by the SAME authenticated session and workspace.
  // These reads intentionally cannot fall back to a service-role client.
  const [customerProof, propertyProof, requestProof] = await Promise.all([
    auth.from("customers").select("id")
      .eq("id", customerId).eq("workspace_id", workspace.id)
      .eq("lead_source", QA_SEED_SOURCE).maybeSingle(),
    auth.from("properties").select("id")
      .eq("id", propertyId).eq("workspace_id", workspace.id)
      .eq("customer_id", customerId).eq("branch_id", branchId).maybeSingle(),
    auth.from("requests").select("id")
      .eq("id", requestId).eq("workspace_id", workspace.id)
      .eq("customer_id", customerId).eq("property_id", propertyId)
      .eq("branch_id", branchId)
      .contains("structured_fields", { qa_sample_version: QA_SEED_FIELDS.qa_sample_version })
      .maybeSingle(),
  ]);
  if (customerProof.error || customerProof.data?.id !== customerId) {
    return { ok: false, stage: "customer" };
  }
  if (propertyProof.error || propertyProof.data?.id !== propertyId) {
    return { ok: false, stage: "property" };
  }
  if (requestProof.error || requestProof.data?.id !== requestId) {
    return { ok: false, stage: "request" };
  }

  return { ok: true, customerId, requestId, reused };
}
