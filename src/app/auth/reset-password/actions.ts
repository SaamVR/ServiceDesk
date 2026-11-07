"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

function resetError(message: string): never {
  redirect("/auth/reset-password?error=" + encodeURIComponent(message));
}

export async function updateRecoveredPassword(formData: FormData): Promise<never> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (password.length < 12 || password.length > 128) {
    resetError("Choose a new password between 12 and 128 characters.");
  }
  if (password !== confirmation) resetError("The two passwords do not match.");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) resetError("Password recovery is unavailable in this environment.");

  const store = await cookies();
  const auth = createServerClient(url, key, {
    cookies: {
      getAll() { return store.getAll(); },
      setAll(values) {
        for (const { name, value, options } of values) store.set(name, value, options);
      },
    },
  });
  const { data, error } = await auth.auth.getUser();
  if (error || !data.user?.email_confirmed_at) {
    redirect("/auth/forgot-password?error=" + encodeURIComponent("Your reset link is invalid or expired. Request another link."));
  }

  // A provider transport exception is not a successful password reset.
  let changed: Awaited<ReturnType<typeof auth.auth.updateUser>>;
  try {
    changed = await auth.auth.updateUser({ password });
  } catch {
    resetError("Password could not be updated. Please request a fresh recovery link.");
  }
  if (changed.error) resetError("Password could not be updated. Please request a fresh recovery link.");

  // Default global signOut() may leave the current session intact when its
  // revocation request fails. Do not claim fresh sign-in if closure is unknown.
  // Never retry the password mutation after an already-committed update.
  let signedOut = false;
  try {
    const result = await auth.auth.signOut();
    signedOut = !result.error;
  } catch {
    signedOut = false;
  }
  if (!signedOut) {
    resetError("Password updated, but ending this session could not be confirmed. Sign out before leaving this device.");
  }
  redirect("/auth/sign-in?notice=" + encodeURIComponent("Password updated. Sign in with your new password."));
}
