import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * This check is about whether the saved workspace has ANY eligible real,
 * internal rule to execute. It is not permission to send customer messages,
 * proof of a quote, provider connection, or authorization to publish a rule.
 *
 * The caller independently verified OWNER membership and workspace identity.
 * Every query below is constrained to that trusted workspace. Unknown/partial
 * snapshots fail CLOSED rather than converting a failed query into "zero".
 */
export type QuoteAutomationActivationProof =
  | { ok: true; branchId: string; ruleId: string }
  | { ok: false; code: "AUTO_QUOTE_SERVICE_MISSING" |
      "AUTO_QUOTE_PRICING_MISSING" | "AUTO_QUOTE_INTERNAL_RULE_MISSING" |
      "AUTO_QUOTE_PREREQUISITES_UNVERIFIED" };

type ServiceReader = Pick<SupabaseClient, "from">;

const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(value);

const unverified = (): QuoteAutomationActivationProof =>
  ({ ok: false, code: "AUTO_QUOTE_PREREQUISITES_UNVERIFIED" });

export async function verifyOwnerQuoteAutomationPrerequisites(
  service: ServiceReader,
  trustedWorkspaceId: string,
): Promise<QuoteAutomationActivationProof> {
  if (!uuid(trustedWorkspaceId)) return unverified();
  try {
    // Bounded queries: truncation is never assumed to mean all records were
    // checked. Those cases must be reviewed rather than activating blind.
    const [catalog, branches, books, rules] = await Promise.all([
      service.from("service_catalog").select("id,active")
        .eq("workspace_id", trustedWorkspaceId).eq("active", true).limit(2),
      service.from("workspace_branches").select("id,currency,active")
        .eq("workspace_id", trustedWorkspaceId).eq("active", true).limit(201),
      service.from("branch_price_books").select("branch_id,active")
        .eq("workspace_id", trustedWorkspaceId).eq("active", true).limit(201),
      service.from("workflow_rules").select("id,branch_id,published_version_number,status")
        .eq("workspace_id", trustedWorkspaceId).eq("status", "ACTIVE").limit(201),
    ]);
    if (catalog.error || branches.error || books.error || rules.error ||
        !Array.isArray(catalog.data) || !Array.isArray(branches.data) ||
        !Array.isArray(books.data) || !Array.isArray(rules.data) ||
        branches.data.length >= 201 || books.data.length >= 201 ||
        rules.data.length >= 201) return unverified();

    if (!catalog.data.some(row => uuid(row.id) && row.active === true)) {
      return { ok: false, code: "AUTO_QUOTE_SERVICE_MISSING" };
    }
    const usdBranches = new Set(branches.data.filter(row =>
      uuid(row.id) && row.currency === "USD" && row.active === true,
    ).map(row => row.id));
    const pricedBranches = new Set(books.data.filter(row =>
      uuid(row.branch_id) && row.active === true && usdBranches.has(row.branch_id),
    ).map(row => row.branch_id));
    if (pricedBranches.size === 0) {
      return { ok: false, code: "AUTO_QUOTE_PRICING_MISSING" };
    }

    const candidates = rules.data.filter(row =>
      uuid(row.id) && uuid(row.branch_id) &&
      pricedBranches.has(row.branch_id) && row.status === "ACTIVE" &&
      Number.isSafeInteger(row.published_version_number) &&
      row.published_version_number > 0,
    );
    if (candidates.length > 40) return unverified();
    for (const rule of candidates) {
      const version = await service.from("workflow_rule_versions")
        .select("rule_id,branch_id,version_number,state,event_type,actions")
        .eq("workspace_id", trustedWorkspaceId)
        .eq("rule_id", rule.id).eq("branch_id", rule.branch_id)
        .eq("version_number", rule.published_version_number)
        .eq("state", "PUBLISHED").eq("event_type", "QUOTE_ACCEPTED").maybeSingle();
      if (version.error) return unverified();
      if (!version.data) continue;
      if (version.data.rule_id !== rule.id ||
          version.data.branch_id !== rule.branch_id ||
          version.data.version_number !== rule.published_version_number ||
          version.data.state !== "PUBLISHED" ||
          version.data.event_type !== "QUOTE_ACCEPTED" ||
          !Array.isArray(version.data.actions)) return unverified();
      if (version.data.actions.some((action: unknown) =>
        action !== null && typeof action === "object" &&
        "type" in action && action.type === "CREATE_ATTENTION")) {
        return { ok: true, branchId: rule.branch_id, ruleId: rule.id };
      }
    }
    return { ok: false, code: "AUTO_QUOTE_INTERNAL_RULE_MISSING" };
  } catch {
    return unverified();
  }
}
