import type { SupabaseClient } from "@supabase/supabase-js";

/** Fully fictional data for an explicitly opted-in, authenticated QA workspace. */
export const QA_SEED_SOURCE = "SERVICEDESK_QA_SAMPLE_V1";
export const QA_SEED_LABEL = "ServiceDesk QA sample property";
export const QA_SEED_CUSTOMER = Object.freeze({
  display_name: "Casey Sample (fictional)",
  notes: "Synthetic QA data only. No real customer or contact details.",
});
export const QA_SEED_PROPERTY = Object.freeze({
  address_line1: "Fictional QA address - not a real property",
  city: "Example City",
  postal_code: "00000",
  country_code: "US",
});
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

// A matching version tag alone never authorizes reusing or mutating an
// enquiry: another row may have lost its fictional-only / no-provider status.
function isVerifiedSyntheticRequest(fields: unknown): boolean {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return false;
  const marker = fields as Record<string, unknown>;
  return marker.qa_sample_version === QA_SEED_FIELDS.qa_sample_version &&
    marker.synthetic === true && marker.provider_connected === false;
}

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

  // The atomic owner bootstrap creates MAIN, but an existing owner can rename
  // the default branch later. Use the single ACTIVE default branch proven by
  // the owner readiness gate, not a mutable display code. Duplicate or
  // unreadable defaults must never route a fictional write to another branch.
  const branch = await auth.from("workspace_branches")
    .select("id,workspace_id,code,is_default,active")
    .eq("workspace_id", workspace.id)
    .eq("is_default", true)
    .eq("active", true)
    .limit(2);
  if (branch.error || !Array.isArray(branch.data) || branch.data.length !== 1)
    return { ok: false, stage: "branch" };
  const saved = branch.data[0];
  const branchId = saved?.id;
  if (!isUuid(branchId) || saved.workspace_id !== workspace.id ||
      saved.is_default !== true || saved.active !== true ||
      typeof saved.code !== "string" ||
      !/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(saved.code))
    return { ok: false, stage: "branch" };

  // The QA customer may be seeded before the owner configures pricing. An
  // active MOVE_OUT service is optional, but when it exists the saved request
  // must point to its actual tenant-bound FK so it can reach real quoting.
  const catalog = await auth.from("service_catalog")
    .select("id,code,active")
    .eq("workspace_id", workspace.id)
    .eq("code", "MOVE_OUT")
    .maybeSingle();
  if (catalog.error) return { ok: false, stage: "request" };
  const configuredServiceId = catalog.data?.active === true ? catalog.data.id : null;
  if (configuredServiceId !== null && !isUuid(configuredServiceId)) {
    return { ok: false, stage: "request" };
  }

  let reused = true;
  const existingCustomers = await auth.from("customers")
    .select("id,workspace_id,auth_user_id,display_name,lead_source,notes,archived_at")
    .eq("workspace_id", workspace.id)
    .eq("lead_source", QA_SEED_SOURCE)
    .limit(2);
  if (existingCustomers.error || !Array.isArray(existingCustomers.data) ||
      existingCustomers.data.length > 1) {
    return { ok: false, stage: "customer" };
  }
  const savedCustomer = existingCustomers.data[0];
  // A QA source label alone never means an owner hasn't repurposed a customer.
  // A real Auth identity, a changed name/notes or archived status stops the
  // fixture before adding a property or mutating a request.
  if (savedCustomer && (!isUuid(savedCustomer.id) ||
      savedCustomer.workspace_id !== workspace.id ||
      savedCustomer.lead_source !== QA_SEED_SOURCE ||
      savedCustomer.auth_user_id !== null || savedCustomer.archived_at !== null ||
      savedCustomer.display_name !== QA_SEED_CUSTOMER.display_name ||
      savedCustomer.notes !== QA_SEED_CUSTOMER.notes)) {
    return { ok: false, stage: "customer" };
  }
  let customerId = savedCustomer?.id;
  if (!customerId) {
    const created = await auth.from("customers")
      .insert({
        workspace_id: workspace.id,
        ...QA_SEED_CUSTOMER,
        lead_source: QA_SEED_SOURCE,
      })
      .select("id")
      .single();
    if (created.error) return { ok: false, stage: "customer" };
    customerId = created.data?.id;
    reused = false;
  }
  if (!isUuid(customerId)) return { ok: false, stage: "customer" };

  // No contactable phone/email may be attached to the fictional identity.
  // This is a separate owner-session RLS-visible row test, never a privileged
  // lookup and never permission to contact real people.
  const contacts = await auth.from("customer_contacts")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("customer_id", customerId)
    .limit(1);
  if (contacts.error || !Array.isArray(contacts.data) || contacts.data.length !== 0) {
    return { ok: false, stage: "customer" };
  }

  const existingProperties = await auth.from("properties")
    .select("id,workspace_id,customer_id,branch_id,label,address_line1,city,postal_code,country_code,archived_at")
    .eq("workspace_id", workspace.id)
    .eq("customer_id", customerId)
    .eq("label", QA_SEED_LABEL)
    .limit(2);
  if (existingProperties.error || !Array.isArray(existingProperties.data) ||
      existingProperties.data.length > 1) {
    return { ok: false, stage: "property" };
  }
  const savedProperty = existingProperties.data[0];
  // An existing QA-labelled property can have been transferred to another
  // branch. Confirm saved tenant, owner-scoped customer and exact active
  // default branch BEFORE trying to amend any request or create more records.
  if (savedProperty && (!isUuid(savedProperty.id) ||
      savedProperty.workspace_id !== workspace.id ||
      savedProperty.customer_id !== customerId ||
      savedProperty.branch_id !== branchId ||
      savedProperty.label !== QA_SEED_LABEL ||
      savedProperty.archived_at !== null ||
      savedProperty.address_line1 !== QA_SEED_PROPERTY.address_line1 ||
      savedProperty.city !== QA_SEED_PROPERTY.city ||
      savedProperty.postal_code !== QA_SEED_PROPERTY.postal_code ||
      savedProperty.country_code !== QA_SEED_PROPERTY.country_code)) {
    return { ok: false, stage: "property" };
  }
  let propertyId = savedProperty?.id;
  if (!propertyId) {
    const created = await auth.from("properties")
      .insert({
        workspace_id: workspace.id,
        customer_id: customerId,
        branch_id: branchId,
        label: QA_SEED_LABEL,
        ...QA_SEED_PROPERTY,
      })
      .select("id")
      .single();
    if (created.error) return { ok: false, stage: "property" };
    propertyId = created.data?.id;
    reused = false;
  }
  if (!isUuid(propertyId)) return { ok: false, stage: "property" };

  const existingRequests = await auth.from("requests")
    .select("id,service_id,branch_id,status,structured_fields")
    .eq("workspace_id", workspace.id)
    .eq("customer_id", customerId)
    .eq("property_id", propertyId)
    // Keep this broad: a version-tagged row with corrupted synthetic markers
    // must veto the seed rather than be skipped and silently duplicated.
    .contains("structured_fields", { qa_sample_version: QA_SEED_FIELDS.qa_sample_version })
    .limit(2);
  if (existingRequests.error || !Array.isArray(existingRequests.data) ||
      existingRequests.data.length > 1) {
    return { ok: false, stage: "request" };
  }
  const priorRequest = existingRequests.data[0];
  if (priorRequest && (!isUuid(priorRequest.id) ||
      priorRequest.branch_id !== branchId ||
      !isVerifiedSyntheticRequest(priorRequest.structured_fields))) {
    // Refuse before a service_id UPDATE: this could be a real or otherwise
    // provider-connected enquiry incorrectly carrying the QA version tag.
    return { ok: false, stage: "request" };
  }
  let requestId = priorRequest?.id;
  if (requestId && configuredServiceId && existingRequests.data?.[0]?.service_id !== configuredServiceId) {
    if (existingRequests.data?.[0]?.service_id != null) {
      // A previous service reference may have been intentionally assigned.
      // Do not overwrite it with a different service when a QA seed is retried.
      return { ok: false, stage: "request" };
    }
    // A synthetic request may still have entered a real owner workflow.
    // Never retroactively assign a service to one that is being qualified,
    // quoted, booked, lost, or closed, even with untouched QA markers.
    if (priorRequest?.status !== "NEW")
      return { ok: false, stage: "request" };
    const amended = await auth.from("requests")
      .update({ service_id: configuredServiceId })
      .eq("id", requestId)
      .eq("workspace_id", workspace.id)
      .eq("customer_id", customerId)
      .eq("property_id", propertyId)
      .eq("branch_id", branchId)
      // Status is a mutable business decision. Protect the UPDATE at the DB
      // boundary too, not only the preceding read (TOCTOU).
      .eq("status", "NEW")
      // Protect the UPDATE itself against a concurrently repurposed request:
      // a pre-write synthetic check alone is not an atomic write predicate.
      .contains("structured_fields", {
        qa_sample_version: QA_SEED_FIELDS.qa_sample_version,
        synthetic: true, provider_connected: false,
      })
      .is("service_id", null)
      .select("id,service_id,branch_id,status,structured_fields")
      .maybeSingle();
    if (amended.error || amended.data?.id !== requestId ||
        amended.data?.service_id !== configuredServiceId ||
        amended.data?.branch_id !== branchId ||
        amended.data?.status !== "NEW" ||
        !isVerifiedSyntheticRequest(amended.data?.structured_fields)) {
      return { ok: false, stage: "request" };
    }
    reused = false;
  }
  if (!requestId) {
    const created = await auth.from("requests")
      .insert({
        workspace_id: workspace.id,
        branch_id: branchId,
        customer_id: customerId,
        property_id: propertyId,
        bedrooms: 3,
        bathrooms: 2,
        ...(configuredServiceId ? { service_id: configuredServiceId } : {}),
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
  const [customerProof, contactsProof, propertyProof, requestProof] = await Promise.all([
    auth.from("customers").select("id,workspace_id,auth_user_id,display_name,lead_source,notes,archived_at")
      .eq("id", customerId).eq("workspace_id", workspace.id)
      .eq("lead_source", QA_SEED_SOURCE)
      .eq("display_name", QA_SEED_CUSTOMER.display_name)
      .eq("notes", QA_SEED_CUSTOMER.notes)
      .is("auth_user_id", null).is("archived_at", null).maybeSingle(),
    auth.from("customer_contacts").select("id")
      .eq("workspace_id", workspace.id).eq("customer_id", customerId).limit(1),
    auth.from("properties").select("id,workspace_id,customer_id,branch_id,label,address_line1,city,postal_code,country_code,archived_at")
      .eq("id", propertyId).eq("workspace_id", workspace.id)
      .eq("customer_id", customerId).eq("branch_id", branchId)
      .eq("label", QA_SEED_LABEL)
      .eq("address_line1", QA_SEED_PROPERTY.address_line1)
      .eq("city", QA_SEED_PROPERTY.city)
      .eq("postal_code", QA_SEED_PROPERTY.postal_code)
      .eq("country_code", QA_SEED_PROPERTY.country_code)
      .is("archived_at", null).maybeSingle(),
    auth.from("requests").select("id,service_id,branch_id,structured_fields")
      .eq("id", requestId).eq("workspace_id", workspace.id)
      .eq("customer_id", customerId).eq("property_id", propertyId)
      .eq("branch_id", branchId)
      .contains("structured_fields", {
        qa_sample_version: QA_SEED_FIELDS.qa_sample_version,
        synthetic: true, provider_connected: false,
      })
      .maybeSingle(),
  ]);
  if (customerProof.error || customerProof.data?.id !== customerId ||
      customerProof.data?.auth_user_id !== null ||
      customerProof.data?.archived_at !== null ||
      customerProof.data?.display_name !== QA_SEED_CUSTOMER.display_name ||
      customerProof.data?.notes !== QA_SEED_CUSTOMER.notes) {
    return { ok: false, stage: "customer" };
  }
  if (contactsProof.error || !Array.isArray(contactsProof.data) ||
      contactsProof.data.length !== 0) return { ok: false, stage: "customer" };
  if (propertyProof.error || propertyProof.data?.id !== propertyId ||
      propertyProof.data?.archived_at !== null ||
      propertyProof.data?.address_line1 !== QA_SEED_PROPERTY.address_line1 ||
      propertyProof.data?.city !== QA_SEED_PROPERTY.city ||
      propertyProof.data?.postal_code !== QA_SEED_PROPERTY.postal_code ||
      propertyProof.data?.country_code !== QA_SEED_PROPERTY.country_code) {
    return { ok: false, stage: "property" };
  }
  if (requestProof.error || requestProof.data?.id !== requestId ||
      requestProof.data?.branch_id !== branchId ||
      !isVerifiedSyntheticRequest(requestProof.data?.structured_fields) ||
      (configuredServiceId && requestProof.data.service_id !== configuredServiceId)) {
    return { ok: false, stage: "request" };
  }

  return { ok: true, customerId, requestId, reused };
}
