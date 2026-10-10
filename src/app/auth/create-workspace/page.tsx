import Link from "next/link";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RegistrationShell } from "@/features/auth/RegistrationShell";
import { createOwnerWorkspace } from "./actions";
import styles from "../sign-in/page.module.css";

const timezones = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "US Eastern" },
  { value: "America/Chicago", label: "US Central" },
  { value: "America/Los_Angeles", label: "US Pacific" },
  { value: "Europe/London", label: "UK" },
  { value: "Asia/Dhaka", label: "Bangladesh" },
  { value: "Australia/Sydney", label: "Australia / Sydney" },
];

export default async function CreateWorkspacePage({
  searchParams,
}: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    return <RegistrationShell eyebrow="Workspace setup" title="Setup is unavailable"
      description="Authentication has not been configured on this preview deployment."
      asideTitle="One place to run the work." asideItems={["Customers and enquiries", "Jobs and crew scheduling", "Invoices and follow-ups"]}>
      <Link href="/auth/sign-in">Return to sign in</Link>
    </RegistrationShell>;
  }

  const store = await cookies();
  const client = createServerClient(url, key, {
    cookies: { getAll() { return store.getAll(); }, setAll() {} },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user?.email_confirmed_at) {
    redirect("/auth/sign-in?next=" + encodeURIComponent("/auth/create-workspace"));
  }

  return (
    <RegistrationShell
      eyebrow="Step 2 of 2 · Business setup"
      title="Make it yours."
      description="Set up the workspace where your team will manage enquiries, customers, jobs and collections."
      asideTitle="Your business. Your workflow."
      asideItems={["Create your private business workspace", "Add services and invite your team", "Connect approved channels when ready"]}
    >
      {query.error ? <p className={styles.error} role="alert">{query.error}</p> : null}
      <form className={styles.form} action={createOwnerWorkspace}>
        <div className={styles.field}>
          <label htmlFor="business-name">Business name</label>
          <input id="business-name" name="businessName" placeholder="e.g. BrightHome Cleaning" autoComplete="organization" minLength={2} maxLength={120} required />
        </div>
        <div className={styles.field}>
          <label htmlFor="business-slug">Workspace address <span style={{fontWeight:400}}>(optional)</span></label>
          <input id="business-slug" name="slug" pattern="[a-z0-9][a-z0-9-]{2,39}" placeholder="Generated from your business name" autoCapitalize="none" maxLength={40} aria-describedby="workspace-slug-hint" />
          <span id="workspace-slug-hint" className={styles.help}>Use lowercase letters, numbers or hyphens. You can change the suggestion if it is taken.</span>
        </div>
        <div className={styles.field}>
          <label htmlFor="workspace-timezone">Business timezone</label>
          <select id="workspace-timezone" name="timezone" defaultValue="UTC" required>
            {timezones.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="workspace-currency">Invoice currency</label>
          <select id="workspace-currency" name="currency" defaultValue="USD" required>
            <option value="USD">USD · US Dollar</option>
            <option value="GBP">GBP · British Pound</option>
            <option value="EUR">EUR · Euro</option>
            <option value="CAD">CAD · Canadian Dollar</option>
            <option value="AUD">AUD · Australian Dollar</option>
            <option value="BDT">BDT · Bangladeshi Taka</option>
          </select>
        </div>
        <button className={styles.submit} type="submit">Create my workspace <span aria-hidden="true">→</span></button>
      </form>
      <p className={styles.help}>You'll be the workspace owner. Team members can be invited after setup.</p>
    </RegistrationShell>
  );
}
