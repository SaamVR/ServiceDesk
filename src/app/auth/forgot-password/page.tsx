import Link from "next/link";
import { RegistrationShell } from "@/features/auth/RegistrationShell";
import { requestPasswordReset } from "./actions";
import styles from "../sign-in/page.module.css";
import { trustedAuthFeedback } from "@/features/auth/verified-auth-feedback";

export default async function ForgotPasswordPage({
  searchParams,
}: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams;
  const errorMessage = trustedAuthFeedback("forgot-password", "error", query.error);
  return (
    <RegistrationShell
      eyebrow="Secure account recovery"
      title="Get back to work."
      description="Enter the email address linked to your account and we’ll send you a password reset link."
      asideTitle="Your work stays with your team."
      asideItems={["Recover access with a private email link", "Choose a fresh password", "Return to your existing workspace"]}
    >
      {errorMessage ? <p className={styles.error} role="alert">{errorMessage}</p> : null}
      <form action={requestPasswordReset} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="recover-email">Work email</label>
          <input id="recover-email" name="email" type="email" autoComplete="email" maxLength={254} required/>
        </div>
        <button className={styles.submit} type="submit">Send reset link →</button>
      </form>
      <p className={styles.help}>
        We’ll show the same confirmation whether or not the address is registered.
      </p>
      <p className={styles.help}>
        Remembered your password? <Link href="/auth/sign-in"><strong>Sign in</strong></Link>
      </p>
    </RegistrationShell>
  );
}
