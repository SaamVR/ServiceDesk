import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// Accepts both Supabase's SSR code exchange and the token-hash email template.
// Destination is fixed, not derived from an untrusted query string.
export async function GET(request: NextRequest) {
  const configUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  const failure = new URL("/auth/sign-in?error=" + encodeURIComponent(
    "The verification link has expired or could not be confirmed. Please try signing in.",
  ), request.url);

  if (!configUrl || !key) return NextResponse.redirect(failure, 303);

  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  if ((!code || code.length > 2048) &&
      (!tokenHash || !/^[a-zA-Z0-9_-]{10,2048}$/.test(tokenHash))) {
    return NextResponse.redirect(failure, 303);
  }

  const flow = request.nextUrl.searchParams.get("flow") === "recovery"
    ? "recovery"
    : "signup";
  const response = NextResponse.redirect(
    new URL(flow === "recovery" ? "/auth/reset-password" : "/auth/continue", request.url),
    303,
  );
  response.headers.set("Cache-Control", "private, no-store");

  const supabase = createServerClient(configUrl, key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(values) {
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const verification = code && code.length <= 2048
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: flow === "recovery" ? "recovery" : "email" });

  if (verification.error) return NextResponse.redirect(failure, 303);

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email_confirmed_at) {
    return NextResponse.redirect(failure, 303);
  }
  return response;
}
