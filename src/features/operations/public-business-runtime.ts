import { createClient } from "@supabase/supabase-js";

export interface PublicBusinessSnapshot {
  workspace: { id: string; slug: string; name: string };
  services: Array<{ code: string; name: string; requiresReview: boolean }>;
}

export type PublicBusinessResult =
  | { ok: true; value: PublicBusinessSnapshot }
  | { ok: false; kind: "configuration" | "not_found" | "server"; message: string };

export async function loadPublicBusiness(slug: string): Promise<PublicBusinessResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return {
      ok: false,
      kind: "configuration",
      message: "Online service information is temporarily unavailable.",
    };
  }

  const service = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const workspaceResult = await service
    .from("workspaces")
    .select("id,slug,name")
    .eq("slug", slug)
    .maybeSingle();

  if (workspaceResult.error) {
    return { ok: false, kind: "server", message: "This business page could not be loaded." };
  }
  if (!workspaceResult.data) {
    return { ok: false, kind: "not_found", message: "This business page does not exist." };
  }

  const workspace = workspaceResult.data as { id: string; slug: string; name: string };
  const servicesResult = await service
    .from("service_catalog")
    .select("code,name,requires_review")
    .eq("workspace_id", workspace.id)
    .eq("active", true)
    .order("name", { ascending: true });

  if (servicesResult.error) {
    return { ok: false, kind: "server", message: "Available services could not be loaded." };
  }

  return {
    ok: true,
    value: {
      workspace,
      services: (servicesResult.data ?? []).map((row) => ({
        code: String(row.code),
        name: String(row.name),
        requiresReview: Boolean(row.requires_review),
      })),
    },
  };
}
