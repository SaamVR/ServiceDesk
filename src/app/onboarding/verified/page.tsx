import Link from "next/link";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RegistrationShell } from "@/features/auth/RegistrationShell";
import { supabasePublicConfig } from "@/features/auth/supabase-public-config";
import { loadVerifiedOwnerWorkspace } from "@/features/auth/verified-owner-workspace";
import { operationalDatabaseMode } from "@/features/auth/operational-preview-mode";
import { ownerRegistrationEmailAllowed } from "@/features/auth/owner-registration-readiness";
import { seedVerifiedQaWorkspace } from "./qa-seed-actions";
import { RegistrationSubmitButton } from "@/features/auth/RegistrationSubmitButton";

export const dynamic = "force-dynamic";

export default async function VerifiedOwnerWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string; qaSeed?: string }>;
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
  const canSeed = operationalMode === "QA_SESSION_RLS" && ownerRegistrationEmailAllowed(data.user.email);
  const seedNotice = ({
    created: "Fictional sample customer, property and enquiry saved in your real test workspace.",
    "already-exists": "Sample records already exist. No duplicate records were created.",
    "write-failed": "Sample data was not fully saved. Confirm workspace permissions and retry; earlier steps are resumable.",
    "not-enabled": "Sample data is only available in an authorized QA environment.",
    "not-configured": "The test database is not configured.",
    "not-authorized": "This test account is not authorized to seed workspace records.",
  } as Record<string, string>)[query.qaSeed ?? ""];
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
          {canSeed ? (
            <section aria-label="Synthetic QA data" style={{border:"1px solid #cbded6",padding:16,borderRadius:12,display:"grid",gap:9}}>
              <strong>Test the real database with fictional records</strong>
              <p>Save one fictional customer, property and cleaning enquiry into this test workspace. This runs against the authenticated database, not the browser-only sandbox. No emails, messages or payments are sent.</p>
              {seedNotice ? <p role="status">{seedNotice}</p> : null}
              <form action={seedVerifiedQaWorkspace}>
                <input type="hidden" name="workspace" value={workspace.slug} />
                <button type="submit" style={{padding:"12px 16px",background:"#135d49",color:"#fff",border:0,borderRadius:9,fontWeight:750,cursor:"pointer"}}>
                  Add fictional QA records
                </button>
              </form>
            </section>
          ) : null}
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
