import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  loadOperationalStaffSnapshot,
  type OperationalStaffSnapshot,
} from "@/features/operations/operational-product-runtime";

type OnboardingErrorKind =
  | "configuration"
  | "authentication"
  | "authorization"
  | "not_found"
  | "server";

export type OnboardingProductResult =
  | { ok: true; value: OperationalStaffSnapshot }
  | { ok: false; kind: OnboardingErrorKind; message: string };

type OwnerWorkspaceResult =
  | { ok: true; slug: string }
  | { ok: false; kind: OnboardingErrorKind; message: string };

function runtimeConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && anonKey && serviceRoleKey ? { url, anonKey, serviceRoleKey } : undefined;
}

async function defaultOwnerWorkspaceSlug(): Promise<OwnerWorkspaceResult> {
  const config = runtimeConfig();
  if (!config) {
    return {
      ok: false,
      kind: "configuration",
      message: "Workspace setup is temporarily unavailable.",
    };
  }

  const cookieStore = await cookies();
  const auth = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Session refresh remains middleware-owned.
      },
    },
  });

  const { data: authData, error: authError } = await auth.auth.getUser();
  if (authError || !authData.user) {
    return {
      ok: false,
      kind: "authentication",
      message: "Sign in with an owner account to continue setup.",
    };
  }

  const service = createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const membershipResult = await service
    .from("memberships")
    .select("workspace_id")
    .eq("user_id", authData.user.id)
    .eq("role", "OWNER")
    .eq("status", "ACTIVE")
    .limit(1);

  if (membershipResult.error) {
    return {
      ok: false,
      kind: "server",
      message: "Owner workspace access could not be loaded.",
    };
  }

  const membership = membershipResult.data?.[0];
  if (!membership?.workspace_id) {
    return {
      ok: false,
      kind: "authorization",
      message: "No active owner workspace is linked to this account.",
    };
  }

  const workspaceResult = await service
    .from("workspaces")
    .select("slug")
    .eq("id", membership.workspace_id)
    .maybeSingle();

  if (workspaceResult.error) {
    return {
      ok: false,
      kind: "server",
      message: "The owner workspace could not be loaded.",
    };
  }
  if (!workspaceResult.data?.slug) {
    return {
      ok: false,
      kind: "not_found",
      message: "The owner workspace no longer exists.",
    };
  }

  return { ok: true, slug: String(workspaceResult.data.slug) };
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

  const snapshot = await loadOperationalStaffSnapshot(slug);
  if (!snapshot.ok) return snapshot;

  if (snapshot.value.actor.role !== "OWNER") {
    return {
      ok: false,
      kind: "authorization",
      message: "Only workspace owners can manage onboarding.",
    };
  }

  return snapshot;
}
