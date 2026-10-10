import Link from "next/link";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RegistrationShell } from "@/features/auth/RegistrationShell";
import { updateRecoveredPassword } from "./actions";
import styles from "../sign-in/page.module.css";

export default async function ResetPasswordPage({
  searchParams,
}: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    return <RegistrationShell
      eyebrow="Secure account recovery" title="Recovery unavailable."
      description="Authentication is not configured for this preview deployment."
      asideTitle="Your account stays protected."
      asideItems={["No provider credentials are exposed", "No reset is attempted while unconfigured", "Return when your workspace is ready"]}
    ><Link href="/auth/sign-in">Return to sign in</Link></RegistrationShell>;
  }

  const store = await cookies();
  const auth = createServerClient(url, key, {
    cookies: {
      getAll() { return store.getAll(); },
      setAll() { /* Session refresh is middleware-owned. */ },
    },
  });
  const { data, error } = await auth.auth.getUser();
  if (error || !data.user?.email_confirmed_at) redirect("/auth/forgot-password");

  return (
    <RegistrationShell
      eyebrow="Secure account recovery"
      title="Set a new password."
      description="Use a strong, unique password. We’ll ask you to sign in again when you’re done."
      asideTitle="A safer fresh start."
      asideItems={["Your existing business data remains unchanged", "Use a password manager to create a unique secret", "Sign in again after the update"]}
    >
      {query.error ? <p className={styles.error} role="alert">{query.error}</p> : null}
      <form action={updateRecoveredPassword} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="new-password">New password</label>
          <input id="new-password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/>
        </div>
        <div className={styles.field}>
          <label htmlFor="confirm-password">Confirm new password</label>
          <input id="confirm-password" name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/>
        </div>
        <button className={styles.submit} type="submit">Update password →</button>
      </form>
    </RegistrationShell>
  );
}
