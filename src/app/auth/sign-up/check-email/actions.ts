"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifiedEmailRedirectOrigin } from "@/features/auth/email-origin";
import { ownerRegistrationAvailable, ownerRegistrationEmailAllowed } from "@/features/auth/owner-registration-readiness";
import { normalizedEmail } from "@/features/auth/registration";

function back(message: string): never {
  redirect("/auth/sign-up/check-email?notice=" + encodeURIComponent(message));
}

/**
 * Resend a signup verification message for an address the owner enters.
 * Do not reveal whether that email address has a pending account or whether
 * Supabase accepted the resend. Provider-level rate limits still apply.
 */
export async function resendSignupConfirmation(formData: FormData): Promise<never> {
  if (!ownerRegistrationAvailable()) {
    back("Account registration is not enabled on this environment.");
  }

  const email = normalizedEmail(String(formData.get("email") ?? ""));
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    back("Enter a valid email address to request a new verification message.");
  }

  if (!ownerRegistrationEmailAllowed(email)) {
    back("Account registration on this preview is limited to approved test accounts.");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  const origin = verifiedEmailRedirectOrigin(
    process.env.SERVICEDESK_AUTH_REDIRECT_ORIGIN,
    process.env.RENDER_EXTERNAL_URL,
  );
  if (!url || !key || !origin) {
    back("Email verification is temporarily unavailable. Please try later.");
  }

  const store = await cookies();
  const client = createServerClient(url, key, {
    cookies: {
      getAll() { return store.getAll(); },
      setAll(values) {
        for (const { name, value, options } of values) store.set(name, value, options);
      },
    },
  });

  // A single generic response prevents enumeration of registered addresses.
  // Requests are bounded by Supabase Auth resend quotas and abuse controls.
  await client.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: origin + "/auth/confirm" },
  });

  back("If this address has an account awaiting verification, a new link will arrive shortly.");
}
