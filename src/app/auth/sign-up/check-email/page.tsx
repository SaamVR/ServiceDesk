import Link from "next/link";
import { RegistrationShell } from "@/features/auth/RegistrationShell";
import { ownerRegistrationAvailable } from "@/features/auth/owner-registration-readiness";
import { resendSignupConfirmation } from "./actions";
import styles from "../../sign-in/page.module.css";

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const query = await searchParams;
  const registrationEnabled = ownerRegistrationAvailable();

  return (
    <RegistrationShell
      eyebrow="Step 1 of 2"
      title="Check your email."
      description="Open the verification message from ServiceDesk to confirm your account."
      asideTitle="Almost there."
      asideItems={["Confirm your email address", "Name your cleaning business", "Start your workspace setup"]}
    >
      <p>Check your spam folder if the email hasn&apos;t arrived. Your verification link will open ServiceDesk automatically.</p>
      {registrationEnabled ? (
        <>
          {query.notice ? <p className={styles.notice} role="status">{query.notice}</p> : null}
          <form className={styles.form} action={resendSignupConfirmation}>
            <div className={styles.field}>
              <label htmlFor="resend-confirmation-email">Need another verification email?</label>
              <input
                id="resend-confirmation-email"
                name="email"
                type="email"
                placeholder="Your account email"
                autoComplete="email"
                maxLength={254}
                required
              />
              <span className={styles.help}>Only request a new link for your own email address.</span>
            </div>
            <button className={styles.submit} type="submit">
              Resend verification link <span aria-hidden="true">→</span>
            </button>
          </form>
        </>
      ) : (
        <p className={styles.help}>New registration and verification messages are not enabled on this preview yet.</p>
      )}
      <p>Already verified? <Link href="/auth/sign-in"><strong>Sign in to continue →</strong></Link></p>
    </RegistrationShell>
  );
}
