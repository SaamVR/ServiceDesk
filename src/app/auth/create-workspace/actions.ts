"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { businessSlug, validateWorkspaceFields } from "@/features/auth/registration";
import { ownerRegistrationAvailable } from "@/features/auth/owner-registration-readiness";

function fail(code: string): never {
  redirect("/auth/create-workspace?error=" + encodeURIComponent(code));
}

export async function createOwnerWorkspace(formData: FormData): Promise<never> {
  if (!ownerRegistrationAvailable()) fail("Workspace registration is not enabled on this environment yet.");
  const name = String(formData.get("businessName") ?? "").trim();
  const customSlug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const derivedSlug = businessSlug(name);
  const slug = customSlug || (derivedSlug.length >= 3 ? derivedSlug : derivedSlug + "-team");
  const timezone = String(formData.get("timezone") ?? "");
  const currency = String(formData.get("currency") ?? "");
  const validation = validateWorkspaceFields({ name, slug, timezone, currency });
  if (validation) fail(validation);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) fail("Workspace creation is not configured on this environment.");

  const cookieStore = await cookies();
  const auth = createServerClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(values) {
        for (const { name: cookieName, value, options } of values) {
          cookieStore.set(cookieName, value, options);
        }
      },
    },
  });

  const { data: actor, error: actorError } = await auth.auth.getUser();
  if (actorError || !actor.user || !actor.user.email_confirmed_at) {
    redirect("/auth/sign-in?notice=" + encodeURIComponent("Verify your email and sign in to create a workspace."));
  }

  const { data, error } = await auth.rpc("servicedesk_register_owner_workspace", {
    p_name: name, p_slug: slug, p_timezone: timezone, p_currency: currency,
  });

  if (error) {
    // An unapplied migration, missing EXECUTE permission or DB outage must
    // never be presented as a successful account/workspace creation.
    fail("Workspace setup is unavailable. Contact the administrator to complete deployment.");
  }

  const result = data as {ok?: boolean; slug?: string; code?: string} | null;
  if (!result?.ok || !result.slug) {
    if (result?.code === "SLUG_UNAVAILABLE") fail("This workspace address is taken. Try another.");
    if (result?.code === "EMAIL_VERIFICATION_REQUIRED") fail("Verify your email before creating a workspace.");
    if (result?.code === "TIMEZONE_INVALID") fail("Select another business timezone.");
    fail("Workspace could not be created. Check your details and try again.");
  }

  redirect("/onboarding?workspace=" + encodeURIComponent(result.slug));
}
