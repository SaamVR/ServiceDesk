import Link from "next/link";
import { loadTeamInvitation } from "@/features/settings/team-invitation-access-runtime";
import { acceptTeamInvitationAction } from "./actions";
import styles from "./page.module.css";

function destinationFor(role: "OWNER" | "DISPATCHER" | "CREW", workspaceSlug: string) {
  return role === "CREW" ? "/crew/today" : "/app/" + encodeURIComponent(workspaceSlug) + "/overview";
}

export default async function TeamInvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const result = await loadTeamInvitation(token);
  const currentPath = "/auth/invitations/" + encodeURIComponent(token);

  return (
    <main className={styles.page} aria-labelledby="invitation-title">
      <section className={styles.card}>
        <Link className={styles.brand} href="/" aria-label="ServiceDesk AI home">
          <span className={styles.mark} aria-hidden="true">SD</span>
          <span>ServiceDesk AI</span>
        </Link>

        {!result.ok && result.kind === "authentication" ? (
          <>
            <div className={styles.heading}>
              <p className={styles.eyebrow}>Team invitation</p>
              <h1 id="invitation-title">Sign in to continue</h1>
              <p>Use the existing ServiceDesk account for the email address that received this invitation.</p>
            </div>
            <Link className={styles.primary} href={"/auth/sign-in?next=" + encodeURIComponent(currentPath)}>Sign in</Link>
            <p className={styles.help}>New account creation is not available from team invitations yet. Ask the workspace owner if you need an account created.</p>
          </>
        ) : !result.ok ? (
          <>
            <div className={styles.heading}>
              <p className={styles.eyebrow}>Team invitation</p>
              <h1 id="invitation-title">Invitation unavailable</h1>
              <p>{result.message}</p>
            </div>
            <Link className={styles.secondary} href="/">Back to ServiceDesk</Link>
          </>
        ) : (
          <>
            <div className={styles.heading}>
              <p className={styles.eyebrow}>Team invitation</p>
              <h1 id="invitation-title">Join {result.value.workspaceName}</h1>
              <p>This invitation grants {result.value.role.toLowerCase()} access to the workspace.</p>
            </div>

            {query.error ? <p className={styles.error} role="alert">{query.error}</p> : null}

            <dl className={styles.summary}>
              <div><dt>Invited email</dt><dd>{result.value.email}</dd></div>
              <div><dt>Role</dt><dd>{result.value.role.toLowerCase()}</dd></div>
              <div><dt>Expires</dt><dd>{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(result.value.expiresAt))}</dd></div>
            </dl>

            {result.value.state === "ACCEPTED" ? (
              <>
                <p className={styles.notice} role="status">This invitation has already been accepted.</p>
                <Link className={styles.primary} href={destinationFor(result.value.role, result.value.workspaceSlug)}>Open workspace</Link>
              </>
            ) : (
              <form action={acceptTeamInvitationAction}>
                <input type="hidden" name="token" value={token} />
                <button className={styles.primaryButton} type="submit">Accept invitation</button>
              </form>
            )}

            <p className={styles.help}>Acceptance is limited to a signed-in account whose confirmed email matches the invitation.</p>
          </>
        )}
      </section>
    </main>
  );
}
