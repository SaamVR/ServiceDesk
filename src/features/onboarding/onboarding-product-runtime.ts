import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublicConfig } from "@/features/auth/supabase-public-config";
import {
  loadOperationalStaffSnapshot,
  type OperationalStaffSnapshot,
} from "@/features/operations/operational-product-runtime";
import {
  resolveOwnerOnboardingWorkspaceChoice,
  type OwnerOnboardingWorkspace,
} from "./owner-onboarding-workspace-choice";

type OnboardingErrorKind =
  | "configuration"
  | "authentication"
  | "authorization"
  | "not_found"
  | "server";

export type OnboardingProductResult =
  | { ok: true; value: OperationalStaffSnapshot }
  | { ok: false; kind: OnboardingErrorKind; message: string }
  | { ok: false; kind: "selection"; workspaces: OwnerOnboardingWorkspace[] };

type OwnerWorkspaceResult =
  | { ok: true; slug: string }
  | { ok: false; kind: OnboardingErrorKind; message: string }
  | { ok: false; kind: "selection"; workspaces: OwnerOnboardingWorkspace[] };

/**
 * A signed-in owner with several businesses must CHOOSE instead of being
 * silently routed to the first arbitrary RLS membership. Workspace records
 * and roles are read under the actual user's session; never service_role.
 */
async function defaultOwnerWorkspaceSlug(): Promise<OwnerWorkspaceResult> {
  const config = supabasePublicConfig();
  if (!config) {
    return { ok: false, kind: "configuration",
      message: "Workspace setup is temporarily unavailable." };
  }

  const cookieStore = await cookies();
  const auth = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll() { /* The request proxy owns session refresh. */ },
    },
  });

  const { data, error } = await auth.auth.getUser();
  if (error || !data.user) {
    return { ok: false, kind: "authentication",
      message: "Sign in with an owner account to continue setup." };
  }
  if (!data.user.email_confirmed_at) {
    return { ok: false, kind: "authorization",
      message: "Confirm your account email before configuring a business." };
  }

  const choice = await resolveOwnerOnboardingWorkspaceChoice(auth, data.user.id);
  if (!choice.ok) {
    return { ok: false, kind: "server",
      message: "Your owner workspace access could not be verified. No business was selected." };
  }
  if (choice.kind === "NONE") {
    return { ok: false, kind: "authorization",
      message: "No active owner workspace is linked to this account." };
  }
  if (choice.kind === "CHOOSE") {
    return { ok: false, kind: "selection", workspaces: choice.workspaces };
  }
  return { ok: true, slug: choice.workspace.slug };
}

export async function loadOnboardingProduct(
  workspaceSlug?: string,
): Promise<OnboardingProductResult> {
  let slug = workspaceSlug?.trim();

  if (!slug) {
    const selected = await defaultOwnerWorkspaceSlug();
    if (!selected.ok) return selected;
    slug = selected.slug;
  }

  // Independently authorize the explicit choice again, including role and
  // workspace scope. A caller-controlled slug never grants membership.
  const snapshot = await loadOperationalStaffSnapshot(slug);
  if (!snapshot.ok) return snapshot;

  if (snapshot.value.actor.role !== "OWNER") {
    return { ok: false, kind: "authorization",
      message: "Only workspace owners can manage onboarding." };
  }
  return snapshot;
}
