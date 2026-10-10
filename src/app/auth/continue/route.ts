import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

function go(request: NextRequest, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url), 303);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

// Route after confirmed registration AND ordinary sign-in.
// Workspace selection is based only on DB-authorized membership, not JWT
// user_metadata, caller-supplied workspace slugs, or URL parameters.
export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!url || !key) return go(request, "/auth/sign-in?error=Sign-in%20is%20unavailable");
  const store = await cookies();
  const auth = createServerClient(url, key, {
    cookies: {
      getAll() { return store.getAll(); },
      setAll() { /* Session refresh is middleware-owned. */ },
    },
  });

  const { data, error } = await auth.auth.getUser();
  if (error || !data.user) return go(request, "/auth/sign-in");
  if (!data.user.email_confirmed_at) return go(request, "/auth/sign-up/check-email");

  const membership = await auth.from("memberships")
    .select("workspace_id,role,status")
    .eq("user_id", data.user.id)
    .eq("status", "ACTIVE")
    .limit(10);
  if (membership.error) return go(request, "/auth/sign-in?error=Workspace%20lookup%20unavailable");

  const ordered = [...(membership.data ?? [])].sort((a, b) => {
    const rank = (role: string) => role === "OWNER" ? 0 : role === "DISPATCHER" ? 1 : 2;
    return rank(a.role) - rank(b.role);
  });

  for (const member of ordered) {
    if (member.role === "CREW") return go(request, "/crew/today");
    const ws = await auth.from("workspaces")
      .select("slug").eq("id", member.workspace_id).maybeSingle();
    if (ws.error) return go(request, "/auth/sign-in?error=Workspace%20lookup%20unavailable");
    if (ws.data?.slug) {
      return go(request, "/app/" + encodeURIComponent(String(ws.data.slug)) + "/overview");
    }
  }

  const customers = await auth.from("customers")
    .select("id").eq("auth_user_id", data.user.id).limit(1);
  if (customers.error) return go(request, "/auth/sign-in?error=Account%20lookup%20unavailable");
  if (customers.data?.length) return go(request, "/portal");
  return go(request, "/auth/create-workspace");
}
