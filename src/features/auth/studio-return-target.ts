import { normalizeReturnPath } from "./return-path";

export const STUDIO_RETURN_HEADER = "x-servicedesk-studio-return-path";

const MODULE_QUERY_KEYS: Record<string, readonly string[]> = {
  overview: [],
  customers: ["customer", "search"],
  requests: ["request", "search"],
  quotes: ["quote", "search"],
  schedule: ["queue", "from", "day"],
  jobs: ["job", "queue", "search"],
  quality: ["case", "queue", "q"],
  invoices: ["invoice", "search", "queue", "surface"],
  inbox: ["conversation", "queue", "search"],
  automations: ["template"],
  reports: [],
  billing: [],
  settings: [],
};
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MODULES = new Set(Object.keys(MODULE_QUERY_KEYS));

/** Path derived only from the actual edge request URL, never forwarded user headers.
 * Query values are re-encoded and limited to real module filters/IDs.
 */
export function safeStudioReturnFromRequest(pathname: string, search = ""): string | null {
  if (typeof pathname !== "string" || pathname.length > 190) return null;
  const match = /^\/app\/([^/]+)\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  const [, workspace, module] = match;
  if (!SLUG.test(workspace) || workspace.length > 64 || !MODULES.has(module)) return null;
  let raw: URLSearchParams;
  try { raw = new URLSearchParams(search); } catch { return null; }
  if (search.length > 900 || [...raw].length > 16) return null;
  const safeQuery = new URLSearchParams();
  const allowed = MODULE_QUERY_KEYS[module];
  for (const [key, value] of raw) {
    if (!allowed.includes(key) || value.length > 140 || /[\u0000-\u001f\u007f]/.test(value)) continue;
    safeQuery.append(key, value);
  }
  const base = `/app/${workspace}/${module}`;
  const target = safeQuery.size > 0 ? base + "?" + safeQuery.toString() : base;
  return normalizeReturnPath(target) === target ? target : null;
}

/** Header may be client supplied in unusual hosting paths: verify it is a
 * same-workspace, allowlisted Studio page even if the edge fails to overwrite.
 */
export function verifiedStudioSignInTarget(workspace: string, trustedHeader?: string | null): string {
  const safeWorkspace = SLUG.test(workspace) && workspace.length <= 64 ? workspace : "";
  const fallback = "/app/" + encodeURIComponent(safeWorkspace) + "/overview";
  if (!safeWorkspace || !trustedHeader) return fallback;
  const question = trustedHeader.indexOf("?");
  const pathname = question < 0 ? trustedHeader : trustedHeader.slice(0, question);
  const search = question < 0 ? "" : trustedHeader.slice(question);
  const verified = safeStudioReturnFromRequest(pathname, search);
  if (!verified || verified !== trustedHeader || !verified.startsWith("/app/" + safeWorkspace + "/")) {
    return fallback;
  }
  return verified;
}
