import Link from "next/link";
import { normalizeReturnPath } from "@/features/auth/return-path";
import { signInWithPassword } from "./actions";
import styles from "./page.module.css";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; notice?: string }>;
}) {
  const query = await searchParams;
  const next = normalizeReturnPath(query.next);

  return (
    <main className={styles.page} aria-labelledby="sign-in-title">
      <section className={styles.card}>
        <Link className={styles.brand} href="/" aria-label="ServiceDesk AI home">
          <span className={styles.mark} aria-hidden="true">SD</span>
          <span>ServiceDesk AI</span>
        </Link>

        <div className={styles.heading}>
          <h1 id="sign-in-title">Sign in</h1>
          <p>Use the account linked to your ServiceDesk workspace or customer account.</p>
        </div>

        {query.notice ? (
          <p className={styles.notice} role="status">{query.notice}</p>
        ) : null}
        {query.error ? (
          <p className={styles.error} role="alert">{query.error}</p>
        ) : null}

        <form className={styles.form} action={signInWithPassword}>
          <input type="hidden" name="next" value={next} />

          <div className={styles.field}>
            <label htmlFor="sign-in-email">Email</label>
            <input
              id="sign-in-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              maxLength={254}
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="sign-in-password">Password</label>
            <input
              id="sign-in-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          <button className={styles.submit} type="submit">Sign in</button>
        </form>

        <p className={styles.help}>
          Access is limited to accounts already linked to a staff, crew or customer record.
        </p>

        <Link className={styles.home} href="/">← Back to ServiceDesk</Link>
      </section>
    </main>
  );
}
