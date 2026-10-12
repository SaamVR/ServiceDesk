import { buildStaffModuleHref, staffModuleConfig } from "@/features/operations/staff-modules";
import { normalizeReturnPath } from "./return-path";

/**
 * The proxy must overwrite this header from the real request URL for every
 * request. Never trust a client-supplied header as an authenticated identity.
 */
export const STAFF_REQUEST_TARGET_HEADER = "x-servicedesk-staff-request-target";

/**
 * Return only to a recognized module within the SAME workspace.
 * Authorization remains exclusively with the existing server layout and
 * RLS-aware operational route; this only selects the post-login destination.
 */
export function verifiedStudioReturnPath(workspace: string, requested?: string | null): string {
  const fallback = buildStaffModuleHref(workspace, "overview");
  if (!requested || requested.length > 2048) return fallback;
  const path = requested.split("?")[0];
  const root = `/app/${encodeURIComponent(workspace)}/`;
  if (!path.startsWith(root)) return fallback;
  const suffix = path.slice(root.length);
  const [module, ...segments] = suffix.split("/");
  if (!Object.prototype.hasOwnProperty.call(staffModuleConfig, module)) return fallback;
  if (segments.some(segment => !segment || segment === "." || segment === ".." ||
    /%(?:2e|2f|5c)/i.test(segment))) return fallback;
  // Studio uses one page per module with record selection through query parameters.
  // There is no /jobs/[id] or /requests/[id] route; do not preserve a 404
  // as an apparent post-login destination.
  if (segments.length > 0) return root + module;
  // The shared normalizer rejects external, control-character and auth-loop URLs.
  const safe = normalizeReturnPath(requested);
  return safe === "/auth/continue" ? fallback : safe;
}
