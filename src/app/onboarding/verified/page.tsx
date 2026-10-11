import Link from "next/link";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RegistrationShell } from "@/features/auth/RegistrationShell";
import { supabasePublicConfig } from "@/features/auth/supabase-public-config";
import { loadVerifiedOwnerWorkspace } from "@/features/auth/verified-owner-workspace";
import { operationalDatabaseMode } from "@/features/auth/operational-preview-mode";

export const dynamic = "force-dynamic";

export default async function VerifiedOwnerWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const config = supabasePublicConfig();
  if (!config) {
    return <main><h1>Workspace connection unavailable</h1><p>The database connection is not configured on this environment.</p></main>;
  }

  const store = await cookies();
  const auth = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll() { /* Signed-in session refresh is handled by the request proxy. */ },
    },
  });
  const { data, error } = await auth.auth.getUser();
  if (error || !data.user) {
    redirect("/auth/sign-in?next=" + encodeURIComponent("/auth/continue"));
  }
  if (!data.user.email_confirmed_at) redirect("/auth/sign-up/check-email");

  const query = await searchParams;
  const workspaceSlug = query.workspace ?? "";
  const result = await loadVerifiedOwnerWorkspace(auth, data.user.id, workspaceSlug);
  if (!result.ok) {
    return <RegistrationShell
      eyebrow="Workspace access" title="We could not verify this workspace"
      description="Only a verified owner may open this onboarding confirmation."
      asideTitle="Your account remains protected."
      asideItems={["Workspace access is verified against active membership", "No access is granted by entering a workspace URL", "Contact an administrator if the problem continues"]}
    >
      <p role="alert">Workspace verification could not be completed. Your account has not been changed.</p>
      <p><Link href="/auth/continue">Return to your authorized workspaces →</Link></p>
    </RegistrationShell>;
  }

  const workspace = result.workspace;
  const operationalMode = operationalDatabaseMode();
  const operationalConnected = operationalMode !== "DISABLED";
  const overviewHref = "/app/" + encodeURIComponent(workspace.slug) + "/overview";
  return <RegistrationShell
    eyebrow="Account verified · workspace registered"
    title="Your business workspace is ready."
    description="Your confirmed account is linked to a real private ServiceDesk workspace."
    asideTitle="Your workspace, your data."
    asideItems={["Email-verified ownership", "Active business membership", "Private default branch"]}
  >
    <div aria-label="Verified workspace details" style={{display:"grid",gap:16}}>
      <p role="status" style={{color:"#14634a",fontWeight:750}}>
        Email confirmed. Owner membership verified against the database.
      </p>
      <dl style={{display:"grid",gap:12,margin:0}}>
        <div><dt>Business</dt><dd style={{fontWeight:700,margin:0}}>{workspace.name}</dd></div>
        <div><dt>Workspace address</dt><dd style={{margin:0}}>{workspace.slug}</dd></div>
        <div><dt>Timezone</dt><dd style={{margin:0}}>{workspace.timezone}</dd></div>
        <div><dt>Currency</dt><dd style={{margin:0}}>{workspace.currency}</dd></div>
      </dl>
      {operationalConnected ? (
        <>
          <p>{operationalMode === "QA_SESSION_RLS"
            ? "QA mode: the dashboard uses your verified session and workspace row-level permissions. Provider connectivity and all operational actions are not yet certified."
            : "The operations backend is configured. Continue to setup and verify your first workspace actions."}</p>
          <Link href={"/onboarding?workspace=" + encodeURIComponent(workspace.slug)}>
            Continue business setup →
          </Link>
          <Link href={overviewHref}>Open operational dashboard →</Link>
        </>
      ) : (
        <>
          <p role="status">Account and business registration have succeeded. The full operational dashboard is not connected on this review environment yet; its server-only database credential is required separately.</p>
          <Link href="/sandbox">Explore the interactive test workflow →</Link>
          <Link href="/auth/continue">Return to your account →</Link>
        </>
      )}
    </div>
  </RegistrationShell>;
}
