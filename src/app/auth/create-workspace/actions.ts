"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { businessSlug, validateWorkspaceFields } from "@/features/auth/registration";
import { ownerRegistrationAvailable, ownerRegistrationEmailAllowed } from "@/features/auth/owner-registration-readiness";
import { verifyOwnerWorkspaceCreationReadback } from "@/features/auth/verified-owner-workspace";

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

  // A thrown Auth transport error is not proof of an authorized owner.
  // No registration RPC may run until the identity was actually verified.
  let identity: Awaited<ReturnType<typeof auth.auth.getUser>> | null = null;
  try {
    identity = await auth.auth.getUser();
  } catch {
    identity = null;
  }
  const actor = identity?.data;
  // A confirmed email without a usable authenticated user ID must not be
  // allowed to invoke a privileged, non-idempotent workspace registration RPC.
  if (!identity || identity.error || !actor?.user ||
      typeof actor.user.id !== "string" ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(actor.user.id) ||
      !actor.user.email_confirmed_at) {
    redirect("/auth/sign-in?notice=" + encodeURIComponent("Verify your email and sign in to create a workspace."));
  }

  if (!ownerRegistrationEmailAllowed(actor.user.email)) {
    fail("Workspace creation is limited to approved test accounts on this preview.");
  }

  // A timeout/transport exception can occur AFTER an atomic registration RPC
  // committed. Do not emit a 500 or encourage another non-idempotent setup.
  // The owner must verify existing saved workspaces before any retry.
  const rpcResponse = await (async () => {
    try {
      return await auth.rpc("servicedesk_register_owner_workspace", {
        p_name: name, p_slug: slug, p_timezone: timezone, p_currency: currency,
      });
    } catch {
      return null;
    }
  })();
  if (!rpcResponse) {
    fail("Workspace registration may have committed, but its result could not be confirmed. Check your authorized workspaces before trying again.");
  }
  const { data, error } = rpcResponse;

  if (error) {
    // Supabase may return { error } for a failed network response instead of
    // throwing. A POST RPC might already have committed before the response
    // was lost. Treat only known pre-execution rejections as definitively
    // unavailable; every other error needs saved-workspace reconciliation.
    // Do not log details, retry the POST or claim successful onboarding.
    const code = typeof error.code === "string" ? error.code : "";
    if (code === "PGRST202" || code === "PGRST301" || code === "42501") {
      fail("Workspace setup is unavailable. Contact the administrator to complete deployment.");
    }
    fail("Workspace registration may have committed, but its result could not be confirmed. Check your authorized workspaces before trying again.");
  }

  const result = data as {ok?: unknown; slug?: unknown; existing?: unknown; code?: unknown} | null;
  // A server-only QA email allowlist is insufficient for direct PostgREST
  // callers; a reviewed database gate can deny an otherwise signed-in actor.
  if (result?.code === "REGISTRATION_NOT_AUTHORIZED") {
    fail("Workspace creation is not approved for this account. Contact the administrator.");
  }
  // A contradictory success response must not reach the saved-state reader.
  if (result?.ok !== true || typeof result.slug !== "string" ||
      typeof result.existing !== "boolean" || result.code != null) {
    if (result?.code === "SLUG_UNAVAILABLE") fail("This workspace address is taken. Try another.");
    if (result?.code === "EMAIL_VERIFICATION_REQUIRED") fail("Verify your email before creating a workspace.");
    if (result?.code === "TIMEZONE_INVALID") fail("Select another business timezone.");
    fail("Workspace could not be created. Check your details and try again.");
  }

  // The registration RPC is atomic but its JSON success is not independently
  // verified owner access. RLS-read the saved membership and workspace before
  // presenting a creation receipt. A transport failure can occur after commit;
  // do not suggest blindly submitting a second non-idempotent setup.
  // The registration RPC may already have committed by the time its
  // independent owner/branch RLS readback begins. If verification itself
  // throws (not just returns a denied result), show the same bounded
  // may-have-committed recovery route. Never return an HTTP 500 that could
  // encourage a second non-idempotent registration or expose provider data.
  let readback: Awaited<ReturnType<typeof verifyOwnerWorkspaceCreationReadback>> | null = null;
  try {
    readback = await verifyOwnerWorkspaceCreationReadback(
      auth, actor.user.id, { slug, name, timezone, currency }, result,
    );
  } catch {
    readback = null;
  }
  if (!readback?.ok) {
    fail("Workspace registration may have committed, but saved owner access could not be verified. Use your authorized workspaces to check before trying again.");
  }

  redirect("/onboarding/verified?workspace=" + encodeURIComponent(readback.workspace.slug));
}
