"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { normalizeReturnPath } from "@/features/auth/return-path";

function authConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : undefined;
}

function signInError(next: string, message: string): never {
  redirect(
    "/auth/sign-in?next=" +
      encodeURIComponent(next) +
      "&error=" +
      encodeURIComponent(message),
  );
}

export async function signInWithPassword(formData: FormData): Promise<never> {
  const next = normalizeReturnPath(String(formData.get("next") ?? ""));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || email.length > 254 || !password) {
    signInError(next, "Enter your email address and password.");
  }

  const config = authConfig();
  if (!config) {
    signInError(next, "Sign in is temporarily unavailable.");
  }

  const cookieStore = await cookies();
  const auth = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });

  const { error } = await auth.auth.signInWithPassword({ email, password });
  if (error) {
    signInError(next, "The email or password is incorrect.");
  }

  redirect(next);
}
