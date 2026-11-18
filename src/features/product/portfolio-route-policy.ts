/**
 * Strict HTTP entrypoint for the standalone business-automation portfolio.
 * This deliberately does not protect the full SaaS; the existing server-side
 * tenant and session authorization remains authoritative outside portfolio mode.
 *
 * Only browser-read routes whose content is synthetic/marketing are visible.
 * There are no public write or provider ingestion endpoints in portfolio mode.
 * Next.js framework assets are excluded from proxy matching in src/proxy.ts.
 */
const PUBLIC_PORTFOLIO_PATHS = new Set([
  "/",
  "/health",
  "/work/business-automation",
  "/sandbox",
  "/tour",
  "/features",
  "/use-cases/cleaning",
  "/integrations",
  "/pricing",
  "/contact",
  "/help",
  "/privacy",
  "/terms",
  "/presentation",
]);

export function portfolioAllowsRequest(method: string, pathname: string): boolean {
  if (method !== "GET" && method !== "HEAD") return false;
  if (!pathname.startsWith("/") || pathname.includes("\0")) return false;
  const canonical = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return PUBLIC_PORTFOLIO_PATHS.has(canonical);
}
