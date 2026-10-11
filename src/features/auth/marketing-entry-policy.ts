/** Keep public entry links consistent with the backend owner signup gate. */
export function marketingRegistrationEntry(available: boolean) {
  return available
    ? { href: "/auth/sign-up", desktop: "Create account", mobile: "Get started" }
    : { href: "/tour", desktop: "Explore tour", mobile: "Take tour" };
}
export function marketingHeroEntry(available: boolean, href: string, label: string) {
  return !available && href === "/auth/sign-up"
    ? { href: "/tour", label: "Explore product tour" }
    : { href, label };
}
