import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { trustedAuthDestination } from "@/features/auth/email-origin";
import { loadAuthorizedWorkspaceDecision } from "@/features/auth/authorized-workspace-access";
import { ownerAfterLoginHref } from "@/features/auth/verified-owner-workspace";

function go(path: string) {
  const destination = trustedAuthDestination(path);
  if (!destination) {
    return NextResponse.json(
      { error: "Authentication redirect is not configured for this environment." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  const response = NextResponse.redirect(destination, 303);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

// Route after confirmed registration AND ordinary sign-in.
// Workspace selection is based only on DB-authorized membership, not JWT
// user_metadata, caller-supplied workspace slugs, or URL parameters.
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!url || !key) return go("/auth/sign-in?error=Sign-in%20is%20unavailable");
  const store = await cookies();
  const auth = createServerClient(url, key, {
    cookies: {
      getAll() { return store.getAll(); },
      setAll() { /* Session refresh is middleware-owned. */ },
    },
  });

  // A provider/network rejection after email confirmation must not become a
  // 500 or give a partially verified session access to owner navigation.
  let identity: Awaited<ReturnType<typeof auth.auth.getUser>> | null = null;
  try {
    identity = await auth.auth.getUser();
  } catch {
    return go("/auth/sign-in?error=" + encodeURIComponent("Sign in is temporarily unavailable."));
  }
  const user = identity?.data?.user;
  if (!identity || identity.error || !user?.id) return go("/auth/sign-in");
  if (!user.email_confirmed_at) return go("/auth/sign-up/check-email");

  // Both the membership and workspace RLS reads can throw on transport
  // failure, including after the Auth session itself was successfully verified.
  let loaded: Awaited<ReturnType<typeof loadAuthorizedWorkspaceDecision>> | null = null;
  try {
    loaded = await loadAuthorizedWorkspaceDecision(auth, user.id);
  } catch {
    return go("/auth/sign-in?error=Workspace%20lookup%20unavailable");
  }
  if (!loaded?.ok) return go("/auth/sign-in?error=Workspace%20lookup%20unavailable");

  const decision = loaded.decision;
  if (decision.kind === "CREW") return go("/crew/today");
  if (decision.kind === "STAFF") return go(ownerAfterLoginHref(decision.workspace));
  if (decision.kind === "CHOOSE") return go("/auth/select-workspace");

  // An unverified customer lookup must never be interpreted as "no account".
  // That would send an existing customer into an owner-registration form.
  const customers = await (async () => {
    try {
      return await auth.from("customers")
        .select("id").eq("auth_user_id", user.id).limit(1);
    } catch {
      return null;
    }
  })();
  if (!customers || customers.error || !Array.isArray(customers.data)) {
    return go("/auth/sign-in?error=Account%20lookup%20unavailable");
  }
  if (customers.data.length) return go("/portal");
  return go("/auth/create-workspace");
}
