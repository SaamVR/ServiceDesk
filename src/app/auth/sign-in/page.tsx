import Link from "next/link";
import { normalizeReturnPath } from "@/features/auth/return-path";
import { RegistrationShell } from "@/features/auth/RegistrationShell";
import { RegistrationSubmitButton } from "@/features/auth/RegistrationSubmitButton";
import { ownerRegistrationAvailable, ownerRegistrationMode, ownerRegistrationPubliclyAvailable } from "@/features/auth/owner-registration-readiness";
import { marketingRegistrationEntry } from "@/features/auth/marketing-entry-policy";
import { signInWithPassword } from "./actions";
import styles from "./page.module.css";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; notice?: string }>;
}) {
  const query = await searchParams;
  const next = normalizeReturnPath(query.next ?? "/auth/continue");
  const registrationAvailable = ownerRegistrationAvailable() && ownerRegistrationPubliclyAvailable();
  const inviteOnly = ownerRegistrationMode() === "QA_ONLY";
  const newVisitorEntry = marketingRegistrationEntry(registrationAvailable);

  return (
    <RegistrationShell
      eyebrow="Welcome back"
      title="Ready for what's next?"
      description="Sign in to see your customers, schedule and team's work in one place."
      asideTitle="Stay on top of every workday."
      asideItems={["Prioritize the conversations that need you", "Know where every crew and job stands", "Keep invoices and follow-ups moving"]}
    >
      {query.notice ? <p className={styles.notice} role="status">{query.notice}</p> : null}
      {query.error ? <p className={styles.error} role="alert">{query.error}</p> : null}

      <form className={styles.form} action={signInWithPassword}>
        <input type="hidden" name="next" value={next} />
        <div className={styles.field}>
          <label htmlFor="sign-in-email">Work email</label>
          <input id="sign-in-email" name="email" type="email" autoComplete="email" inputMode="email" maxLength={254} required />
        </div>
        <div className={styles.field}>
          <label htmlFor="sign-in-password">Password</label>
          <input id="sign-in-password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <RegistrationSubmitButton className={styles.submit} label="Sign in" pendingLabel="Signing in…" />
      </form>
      <p className={styles.help}>Forgot your password? <Link href="/auth/forgot-password"><strong>Recover access</strong></Link></p>
      <p className={styles.help}>
        New to ServiceDesk?{" "}
        <Link href={newVisitorEntry.href}>
          <strong>{registrationAvailable ? "Create your account" : "Explore the product tour"}</strong>
        </Link>
      </p>
      {inviteOnly ? (
        <p className={styles.notice} role="note">
          Approved tester? <Link href="/auth/sign-up"><strong>Create your test account →</strong></Link>
          {" "}This review environment requires an invited email address; other emails cannot register.
        </p>
      ) : null}
      <p className={styles.help}>Joining a team? Use your existing account and the invitation link you received.</p>
    </RegistrationShell>
  );
}
