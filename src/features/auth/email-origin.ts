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

/**
 * Auth redirects must never be based on the inbound request URL. Some proxies
 * forward an internal localhost:port URL; an untrusted Host header is also not
 * an acceptable source of authentication callback destinations.
 */
export function trustedAuthDestination(
  path: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): URL | null {
  const origin = verifiedEmailRedirectOrigin(
    env.SERVICEDESK_AUTH_REDIRECT_ORIGIN,
    env.RENDER_EXTERNAL_URL,
  );
  if (!origin || !path.startsWith("/") || path.startsWith("//")) return null;
  try {
    const url = new URL(path, origin);
    return url.origin === origin ? url : null;
  } catch {
    return null;
  }
}
