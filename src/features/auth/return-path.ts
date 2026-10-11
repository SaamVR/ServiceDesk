export function normalizeReturnPath(value?: string | null) {
  const fallback = "/auth/continue";
  if (!value || /[\\\u0000-\u001f\u007f]/.test(value) || /%(?:0a|0d|5c)/i.test(value)) return fallback;

  const path = value.trim();
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.startsWith("/\\") ||
    path.includes("\0") ||
    path.startsWith("/auth/sign-in") ||
    path.startsWith("/auth/sign-out") ||
    path.startsWith("/auth/confirm") ||
    path.startsWith("/auth/reset-password") ||
    /[\\\r\n]/.test(path) ||
    /%(?:0a|0d|5c)/i.test(path)
  ) {
    return fallback;
  }

  return path;
}
