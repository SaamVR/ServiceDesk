/** Untrusted URL parameters never directly become tenant-scoped database filters. */
export type OwnerOnboardingQuery =
  | { kind: "DEFAULT" }
  | { kind: "SELECTED"; slug: string }
  | { kind: "INVALID" };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseOwnerOnboardingQuery(input?: string): OwnerOnboardingQuery {
  if (input === undefined) return { kind: "DEFAULT" };
  if (typeof input !== "string" || !input.length ||
      input.length > 40 || !SLUG.test(input) || input.length < 3) {
    return { kind: "INVALID" };
  }
  return { kind: "SELECTED", slug: input };
}
