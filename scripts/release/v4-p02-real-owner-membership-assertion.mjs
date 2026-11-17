/**
 * Independent real-session RLS acceptance predicate; no network, credentials,
 * service_role or actor metadata. Filtered PostgREST rows are still untrusted
 * until their returned saved values match the verified Auth subject.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isSavedActiveOwnerMembership(row, expected) {
  if (!row || typeof row !== "object" || Array.isArray(row) ||
      !expected || typeof expected !== "object" ||
      typeof expected.workspaceId !== "string" ||
      typeof expected.userId !== "string" ||
      !UUID.test(expected.workspaceId) || !UUID.test(expected.userId)) return false;
  return row.workspace_id === expected.workspaceId &&
    row.user_id === expected.userId &&
    row.role === "OWNER" && row.status === "ACTIVE";
}
