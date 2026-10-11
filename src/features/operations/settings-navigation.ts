/** Preserve safe settings section context after an authenticated staff action. */
export const settingsSections = [
  "services", "team", "branches", "recurrence", "growth", "governance",
  "release-readiness", "integrations",
] as const;

export function settingsFeedbackFragment(module: string, extra: string): string {
  if (module !== "settings") return "";
  const requested = new URLSearchParams(extra).get("section");
  return requested && (settingsSections as readonly string[]).includes(requested)
    ? "#" + requested
    : "";
}
