"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { normalizedEmail } from "@/features/auth/registration";
import { verifiedEmailRedirectOrigin } from "@/features/auth/email-origin";

export async function requestPasswordReset(formData: FormData): Promise<never> {
  const email = normalizedEmail(String(formData.get("email") ?? ""));
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect("/auth/forgot-password?error=" + encodeURIComponent("Enter a valid email address."));
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  const origin = verifiedEmailRedirectOrigin(
    process.env.SERVICEDESK_AUTH_REDIRECT_ORIGIN,
    process.env.RENDER_EXTERNAL_URL,
  );
  if (!url || !key || !origin) {
    redirect("/auth/forgot-password?error=" +
      encodeURIComponent("Password recovery is unavailable in this environment."));
  }

  const store = await cookies();
  const auth = createServerClient(url, key, {
    cookies: {
      getAll() { return store.getAll(); },
      setAll(values) {
        for (const { name, value, options } of values) store.set(name, value, options);
      },
    },
  });

  // Generic response for registered and unknown addresses: no user enumeration.
  await auth.auth.resetPasswordForEmail(email, {
    redirectTo: origin + "/auth/confirm?flow=recovery",
  });
  redirect("/auth/forgot-password/check-email");
}
