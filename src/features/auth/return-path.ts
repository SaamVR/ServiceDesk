export function normalizeReturnPath(value?: string | null) {
  const fallback = "/portal";
  if (!value) return fallback;

  const path = value.trim();
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.startsWith("/\\") ||
    path.includes("\0") ||
    path.startsWith("/auth/sign-in") ||
    path.startsWith("/auth/sign-out")
  ) {
    return fallback;
  }

  return path;
}
