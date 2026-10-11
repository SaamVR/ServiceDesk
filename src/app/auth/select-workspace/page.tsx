import Link from "next/link";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RegistrationShell } from "@/features/auth/RegistrationShell";
import { loadAuthorizedWorkspaceDecision } from "@/features/auth/authorized-workspace-access";
import styles from "./page.module.css";

export default async function SelectWorkspacePage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) redirect("/auth/sign-in");

  const store = await cookies();
  const auth = createServerClient(url, key, {
    cookies: {
      getAll() { return store.getAll(); },
      setAll() { /* Middleware owns session refresh. */ },
    },
  });
  const { data, error } = await auth.auth.getUser();
  if (error || !data.user) redirect("/auth/sign-in");
  if (!data.user.email_confirmed_at) redirect("/auth/sign-up/check-email");

  const loaded = await loadAuthorizedWorkspaceDecision(auth, data.user.id);
  if (!loaded.ok) {
    return (
      <RegistrationShell
        eyebrow="Workspace access"
        title="Workspace lookup is unavailable"
        description="We couldn't verify your authorized workspaces. Your access has not been changed."
        asideTitle="Your workspace, securely."
        asideItems={["Access is verified through your signed-in account", "Only active memberships are shown", "Workspace permissions are checked on every request"]}
      >
        <p role="alert">Please retry shortly. If this continues, contact your workspace administrator.</p>
        <Link className={styles.returnLink} href="/auth/continue">Retry workspace lookup</Link>
      </RegistrationShell>
    );
  }

  const decision = loaded.decision;
  if (decision.kind === "STAFF") redirect(decision.href);
  if (decision.kind === "CREW") redirect("/crew/today");
  if (decision.kind === "NONE") redirect("/auth/continue");

  return (
    <RegistrationShell
      eyebrow="Choose your workspace"
      title="Where are you working today?"
      description="Select one of your active staff workspaces. You can switch again from the application header."
      asideTitle="Clear separation. One account."
      asideItems={["Workspaces remain private to their authorized teams", "Your staff role follows each workspace membership", "Changes are saved through existing operational flows"]}
    >
      <nav className={styles.workspaceChoices} aria-label="Your authorized workspaces">
        {decision.workspaces.map(workspace => (
          <Link key={workspace.workspaceId} className={styles.workspaceChoice} href={workspace.href}>
            <span className={styles.workspaceMark} aria-hidden="true">{workspace.name.charAt(0).toUpperCase()}</span>
            <span className={styles.workspaceDetails}>
              <strong>{workspace.name}</strong>
              <span>{workspace.role === "OWNER" ? "Owner" : "Dispatcher"} · {workspace.slug}</span>
            </span>
            <span className={styles.arrow} aria-hidden="true">↗</span>
          </Link>
        ))}
      </nav>
      <p className={styles.hint}>Your options are drawn from the workspaces this account can access. Every destination checks authorization again.</p>
    </RegistrationShell>
  );
}
