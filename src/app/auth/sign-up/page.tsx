import Link from "next/link";
import { signUpWithPassword } from "./actions";
import styles from "../sign-in/page.module.css";
import { RegistrationShell } from "@/features/auth/RegistrationShell";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  return (
    <RegistrationShell
      eyebrow="Start your workspace"
      title="Build a calmer workday."
      description="Create your ServiceDesk account, then set up your cleaning business in a few steps."
      asideTitle="Your entire operation, one place."
      asideItems={["Receive and qualify new enquiries", "Send clear quotes and schedule your crews", "Keep jobs, payments and follow-ups in sync"]}
    >
      {query.error ? <p className={styles.error} role="alert">{query.error}</p> : null}
      <form className={styles.form} action={signUpWithPassword}>
        <div className={styles.field}>
          <label htmlFor="signup-email">Work email</label>
          <input id="signup-email" name="email" type="email" autoComplete="email" required maxLength={254} />
        </div>
        <div className={styles.field}>
          <label htmlFor="signup-password">Create password</label>
          <input id="signup-password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required aria-describedby="signup-password-hint" />
          <span id="signup-password-hint" className={styles.help}>12 characters minimum. A password manager is recommended.</span>
        </div>
        <label className={styles.help} style={{display:"flex",gap:9,alignItems:"flex-start"}}>
          <input type="checkbox" name="terms" value="agreed" required style={{marginTop:4}} />
          <span>I agree to the <Link href="/terms" style={{textDecoration:"underline"}}>Terms</Link> and <Link href="/privacy" style={{textDecoration:"underline"}}>Privacy Policy</Link>.</span>
        </label>
        <button className={styles.submit} type="submit">Create account <span aria-hidden="true">→</span></button>
      </form>
      <p className={styles.help}>We’ll send an email confirmation. No payment information is needed to start.</p>
      <p className={styles.help}>Already registered? <Link href="/auth/sign-in"><strong>Sign in</strong></Link></p>
    </RegistrationShell>
  );
}
