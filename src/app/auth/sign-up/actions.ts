"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { normalizedEmail, validateRegistrationFields } from "@/features/auth/registration";
import { verifiedEmailRedirectOrigin } from "@/features/auth/email-origin";

function signupError(message: string): never {
  redirect("/auth/sign-up?error=" + encodeURIComponent(message));
}

export async function signUpWithPassword(formData: FormData): Promise<never> {
  const email = normalizedEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const consent = String(formData.get("terms") ?? "");
  const invalid = validateRegistrationFields({ email, password });

  if (invalid) signupError(invalid);
  if (consent !== "agreed") signupError("Review and accept the Terms and Privacy Policy.");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  const redirectOrigin = verifiedEmailRedirectOrigin(
    process.env.SERVICEDESK_AUTH_REDIRECT_ORIGIN,
    process.env.RENDER_EXTERNAL_URL,
  );
  if (!url || !publishableKey || !redirectOrigin) {
    signupError("Account creation is not configured on this environment yet.");
  }

  const store = await cookies();
  const auth = createServerClient(url, publishableKey, {
    cookies: {
      getAll() { return store.getAll(); },
      setAll(values) {
        for (const { name, value, options } of values) store.set(name, value, options);
      },
    },
  });

  const { error } = await auth.auth.signUp({
    email, password,
    options: { emailRedirectTo: redirectOrigin + "/auth/confirm" },
  });

  // Do not disclose whether an email address already has an account.
  if (error) {
    if (/rate.limit|too.many/i.test(error.message)) signupError("Please wait before requesting another confirmation email.");
    signupError("We could not start account registration. Try again shortly.");
  }

  redirect("/auth/sign-up/check-email");
}
