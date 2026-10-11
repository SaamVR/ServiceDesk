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

  const { data, error } = await auth.auth.getUser();
  if (error || !data.user) return go("/auth/sign-in");
  if (!data.user.email_confirmed_at) return go("/auth/sign-up/check-email");

  const loaded = await loadAuthorizedWorkspaceDecision(auth, data.user.id);
  if (!loaded.ok) return go("/auth/sign-in?error=Workspace%20lookup%20unavailable");

  const decision = loaded.decision;
  if (decision.kind === "CREW") return go("/crew/today");
  if (decision.kind === "STAFF") return go(ownerAfterLoginHref(decision.workspace));
  if (decision.kind === "CHOOSE") return go("/auth/select-workspace");

  const customers = await auth.from("customers")
    .select("id").eq("auth_user_id", data.user.id).limit(1);
  if (customers.error) return go("/auth/sign-in?error=Account%20lookup%20unavailable");
  if (customers.data?.length) return go("/portal");
  return go("/auth/create-workspace");
}
