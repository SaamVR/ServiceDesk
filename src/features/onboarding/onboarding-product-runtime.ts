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
import { parseOwnerOnboardingQuery } from "./owner-onboarding-query";

type OnboardingErrorKind =
  | "configuration"
  | "authentication"
  | "authorization"
  | "verification"
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
type VerifiedOnboardingOwnerSession =
  | { ok: true; auth: ReturnType<typeof createServerClient>; userId: string }
  | { ok: false; kind: "configuration" | "authentication" | "verification"; message: string };

/**
 * Both bare /onboarding and /onboarding?workspace= must require a real,
 * confirmed Auth subject. A caller-supplied slug never bypasses email
 * confirmation; the operational snapshot re-authorizes role and scope.
 */
async function verifiedOnboardingOwnerSession(): Promise<VerifiedOnboardingOwnerSession> {
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
  let identity: Awaited<ReturnType<typeof auth.auth.getUser>> | null = null;
  try {
    identity = await auth.auth.getUser();
  } catch {
    return { ok: false, kind: "authentication",
      message: "We could not verify your sign-in right now. Retry from sign-in before setting up your business." };
  }
  // An error-free but null/undefined Auth result is not a confirmed session.
  const user = identity?.data?.user;
  if (!identity || identity.error || typeof user?.id !== "string" || !user.id) {
    return { ok: false, kind: "authentication",
      message: "Sign in with an owner account to continue setup." };
  }
  if (!user.email_confirmed_at) {
    return { ok: false, kind: "verification",
      message: "Confirm your account email before configuring a business." };
  }
  return { ok: true, auth, userId: user.id };
}

async function defaultOwnerWorkspaceSlug(): Promise<OwnerWorkspaceResult> {
  const verified = await verifiedOnboardingOwnerSession();
  if (!verified.ok) return verified;

  const choice = await resolveOwnerOnboardingWorkspaceChoice(verified.auth, verified.userId);
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
  const parsed = parseOwnerOnboardingQuery(workspaceSlug);
  if (parsed.kind === "INVALID") {
    return { ok: false, kind: "not_found", message: "Invalid workspace selection." };
  }
  let slug = parsed.kind === "SELECTED" ? parsed.slug : undefined;

  // Explicit-workspace navigation must not skip the bare route's email and
  // live Auth preflight. The downstream snapshot still authorizes the role.
  if (slug) {
    const verified = await verifiedOnboardingOwnerSession();
    if (!verified.ok) return verified;
  }

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
