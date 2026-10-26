import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { trustedAuthDestination } from "@/features/auth/email-origin";

function authConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : undefined;
}

export async function POST(request: NextRequest) {
  // An inbound Host/request URL is not an authorized redirect origin.
  const destination = trustedAuthDestination(
    "/auth/sign-in?notice=" + encodeURIComponent("You have been signed out."),
  );
  if (!destination) {
    return NextResponse.json(
      { error: "Authentication redirect is not configured for this environment." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  const response = NextResponse.redirect(destination, 303);
  response.headers.set("Cache-Control", "private, no-store");
  const config = authConfig();

  if (!config) {
    return response;
  }

  const auth = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await auth.auth.signOut();
  return response;
}
