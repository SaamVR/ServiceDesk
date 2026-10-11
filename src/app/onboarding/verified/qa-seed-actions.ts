"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabasePublicConfig } from "@/features/auth/supabase-public-config";
import { ownerRegistrationEmailAllowed, ownerRegistrationMode } from "@/features/auth/owner-registration-readiness";
import { operationalDatabaseMode } from "@/features/auth/operational-preview-mode";
import { loadVerifiedOwnerWorkspace } from "@/features/auth/verified-owner-workspace";
import { seedQaWorkspaceData } from "@/features/auth/qa-sample-seed";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function back(slug: string, status: string): never {
  const path = "/onboarding/verified?workspace=" + encodeURIComponent(slug) +
    "&qaSeed=" + encodeURIComponent(status);
  redirect(path);
}

/**
 * User-triggered, test-data-only operation. No fixture fallback in the
 * read path, no automatic writes on page load, and no provider messages.
 */
export async function seedVerifiedQaWorkspace(formData: FormData): Promise<never> {
  const slug = String(formData.get("workspace") ?? "");
  if (slug.length < 3 || slug.length > 40 || !slugPattern.test(slug)) {
    redirect("/auth/continue");
  }

  // All gates are server-side and fail closed. Public customer accounts,
  // unverified QA testers and production service-role mode cannot seed.
  if (operationalDatabaseMode() !== "QA_SESSION_RLS" ||
      ownerRegistrationMode() !== "QA_ONLY") {
    back(slug, "not-enabled");
  }

  const cfg = supabasePublicConfig();
  if (!cfg) back(slug, "not-configured");

  const store = await cookies();
  const auth = createServerClient(cfg.url, cfg.publishableKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll() { /* Request proxy handles session refresh. */ },
    },
  });
  const { data, error } = await auth.auth.getUser();
  if (error || !data.user) redirect("/auth/sign-in?next=" + encodeURIComponent("/auth/continue"));
  if (!data.user.email_confirmed_at || !ownerRegistrationEmailAllowed(data.user.email)) {
    back(slug, "not-authorized");
  }

  const owner = await loadVerifiedOwnerWorkspace(auth, data.user.id, slug);
  if (!owner.ok) back(slug, "not-authorized");

  const result = await seedQaWorkspaceData(auth, owner.workspace);
  if (!result.ok) back(slug, "write-failed");
  back(slug, result.reused ? "already-exists" : "created");
}
