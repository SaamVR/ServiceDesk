"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabasePublicConfig } from "@/features/auth/supabase-public-config";
import { ownerRegistrationEmailAllowed, ownerRegistrationMode } from "@/features/auth/owner-registration-readiness";
import { operationalDatabaseMode } from "@/features/auth/operational-preview-mode";
import { qaFixtureWritesAllowed, qaFixtureWritesAllowedForWorkspace } from "@/features/auth/qa-fixture-write-authority";
import {
  loadVerifiedOwnerWorkspace, verifySavedOwnerDefaultBranch,
} from "@/features/auth/verified-owner-workspace";
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
      ownerRegistrationMode() !== "QA_ONLY" || !qaFixtureWritesAllowed()) {
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
  // A provider transport exception cannot authorize a QA tenant write.
  let identity: Awaited<ReturnType<typeof auth.auth.getUser>> | null = null;
  try {
    identity = await auth.auth.getUser();
  } catch {
    identity = null;
  }
  const user = identity?.data?.user;
  if (!identity || identity.error || !user?.id)
    redirect("/auth/sign-in?next=" + encodeURIComponent("/auth/continue"));
  if (!user.email_confirmed_at || !ownerRegistrationEmailAllowed(user.email)) {
    back(slug, "not-authorized");
  }

  const owner = await loadVerifiedOwnerWorkspace(auth, user.id, slug);
  if (!owner.ok) back(slug, "not-authorized");
  // Main database QA consent is scoped to an exact, owner-verified workspace;
  // the QA email allowlist must never authorize writes to a real business.
  if (!qaFixtureWritesAllowedForWorkspace(owner.workspace.slug)) {
    back(slug, "not-authorized");
  }
  // A QA email and workspace allowlist still cannot grant writes to a branch
  // without the current owner's ACTIVE saved default-branch assignment.
  let authorizedDefaultBranch = false;
  try {
    authorizedDefaultBranch = await verifySavedOwnerDefaultBranch(
      auth, user.id, owner.workspace,
    );
  } catch {
    authorizedDefaultBranch = false;
  }
  if (!authorizedDefaultBranch) back(slug, "not-authorized");

  // This resumable multi-table QA seed is not atomic. If a transport read
  // fails after any step committed, show the existing may-have-committed
  // warning; never claim success or retry the write automatically.
  let result: Awaited<ReturnType<typeof seedQaWorkspaceData>> | null = null;
  try {
    result = await seedQaWorkspaceData(auth, owner.workspace);
  } catch {
    result = null;
  }
  if (!result?.ok) back(slug, "write-failed");
  back(slug, result.reused ? "already-exists" : "created");
}
