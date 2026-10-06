import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeReturnPath } from "../../src/features/auth/return-path";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V2 authentication product", () => {
  it("accepts only internal return paths", () => {
    expect(normalizeReturnPath("/portal/quotes/quote_1")).toBe("/portal/quotes/quote_1");
    expect(normalizeReturnPath("/app/brightroom/inbox")).toBe("/app/brightroom/inbox");
    expect(normalizeReturnPath("https://evil.example")).toBe("/portal");
    expect(normalizeReturnPath("//evil.example")).toBe("/portal");
    expect(normalizeReturnPath("/auth/sign-out")).toBe("/portal");
  });

  it("refreshes Supabase SSR sessions through the Next.js 16 proxy", () => {
    const entry = source("src/proxy.ts");
    const proxy = source("src/features/auth/session-proxy.ts");

    expect(entry).toContain("export async function proxy");
    expect(entry).toContain("refreshAuthSession(request)");
    expect(proxy).toContain("auth.auth.getClaims()");
    expect(proxy).toContain("request.cookies.set");
    expect(proxy).toContain("response.cookies.set");
    expect(proxy).toContain('Cache-Control", "private, no-store"');
    expect(proxy).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("uses Supabase password auth with cookie-backed SSR sessions", () => {
    const action = source("src/app/auth/sign-in/actions.ts");
    expect(action).toContain("createServerClient");
    expect(action).toContain("auth.signInWithPassword");
    expect(action).toContain("cookieStore.set");
    expect(action).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("offers a real sign-in form and POST sign-out route", () => {
    const page = source("src/app/auth/sign-in/page.tsx");
    const signout = source("src/app/auth/sign-out/route.ts");
    expect(page).toContain('type="password"');
    expect(page).toContain("signInWithPassword");
    expect(signout).toContain("auth.auth.signOut()");
    expect(signout).toContain("NextResponse.redirect");
  });

  it("turns authentication failures into real sign-in entry points", () => {
    const staff = source("src/features/operations/OperationalProductRoute.tsx");
    const customer = source("src/features/operations/CustomerProductRoute.tsx");
    const crew = source("src/features/crew/CrewRouteUnavailable.tsx");
    const onboarding = source("src/features/onboarding/OnboardingProductRoute.tsx");

    expect(staff).toContain("/auth/sign-in?next=");
    expect(customer).toContain("/auth/sign-in?next=");
    expect(crew).toContain("signInHref");
    expect(onboarding).toContain("/auth/sign-in?next=");
  });

  it("offers session-aware sign out from staff and customer shells", () => {
    const layout = source("src/app/app/[workspace]/layout.tsx");
    const staff = source("src/components/product/StaffAppShell.tsx");
    const customer = source("src/components/product/CustomerFacingShell.tsx");
    const customerRoute = source("src/features/operations/CustomerProductRoute.tsx");

    expect(layout).toContain("hasAuthenticatedSession");
    expect(layout).toContain("signedIn={signedIn}");
    expect(staff).toContain("signedIn ? (");
    expect(staff).toContain('action="/auth/sign-out"');
    expect(staff).toContain('className="app-auth-entry-link"');
    expect(staff).toContain('href={"/auth/sign-in?next=" + encodeURIComponent(pathname)}');
    expect(staff).toContain(">Sign in</Link>");
    expect(customer).toContain("authenticationRequired ? (");
    expect(customer).toContain('action="/auth/sign-out"');
    expect(customerRoute).toContain('result.kind === "authentication"');
  });

});
