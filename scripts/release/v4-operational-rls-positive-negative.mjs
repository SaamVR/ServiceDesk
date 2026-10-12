/**
 * Authenticated, READ-ONLY deep operational RLS check. A cross-tenant query
 * returning [] proves nothing if both tenants have no actual operational rows.
 * Require a positive owner-visible row before testing each foreign-tenant
 * negative result, for both DISTINCT owners.
 *
 * Does not create users, sample prices, quotes, workflow rules, messages,
 * scheduling, billing or provider actions. No identities are ever printed.
 */
export const operationalProofTables = Object.freeze([
  "service_catalog",
  "branch_price_books",
  "requests",
  "quotes",
  "workflow_rule_versions",
]);

const safeCode = (table) => table.toUpperCase().replace(/[^A-Z0-9_]/g, "");

export async function verifyTwoTenantOperationalRls(actor, foreign, fail) {
  if (!actor?.client || !actor.id || !foreign?.id || actor.id === foreign.id) {
    fail("DISTINCT_ACTORS_REQUIRED");
  }
  for (const table of operationalProofTables) {
    const own = await actor.client.from(table)
      .select("workspace_id")
      .eq("workspace_id", actor.id).limit(1);
    if (own.error || !Array.isArray(own.data) || own.data.length !== 1 ||
        own.data[0]?.workspace_id !== actor.id) {
      fail("MISSING_OWN_OPERATIONAL_ROW_" + safeCode(table));
    }
    const other = await actor.client.from(table)
      .select("workspace_id")
      .eq("workspace_id", foreign.id).limit(1);
    if (other.error || !Array.isArray(other.data) || other.data.length !== 0) {
      fail("FOREIGN_OPERATIONAL_ROW_EXPOSED_" + safeCode(table));
    }
  }
}

/**
 * QA must prove two *authenticated user identities*, not merely two
 * workspace slugs or rows. A single owner may legitimately belong to
 * multiple workspaces; that must never count as two-person tenancy UAT.
 * Only internal IDs are compared; callers must not log them.
 */
export function requireDistinctConfirmedOwnerSessions(a, b, fail) {
  if (typeof a?.userId !== "string" || !a.userId ||
      typeof b?.userId !== "string" || !b.userId ||
      a.userId === b.userId) {
    fail("DISTINCT_CONFIRMED_OWNER_USERS_REQUIRED");
  }
  if (typeof a?.id !== "string" || !a.id ||
      typeof b?.id !== "string" || !b.id || a.id === b.id) {
    fail("DISTINCT_WORKSPACE_IDS_REQUIRED");
  }
}
