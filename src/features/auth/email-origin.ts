/**
 * Only server-owned HTTPS redirect origins are allowed in outgoing auth email
 * links. The Host header, forwarded host, query params and cookies are never
 * used to derive password-reset or account-confirmation targets.
 */
export function verifiedEmailRedirectOrigin(
  preferred: string | undefined,
  renderUrl: string | undefined,
): string | null {
  const value = preferred?.trim() || renderUrl?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      url.port ||
      !url.hostname.includes(".")
    ) return null;
    return url.origin;
  } catch {
    return null;
  }
}
