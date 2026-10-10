import Link from "next/link";
import { RegistrationShell } from "@/features/auth/RegistrationShell";

export default function CheckEmailPage() {
  return (
    <RegistrationShell
      eyebrow="Step 1 of 2"
      title="Check your email."
      description="Open the verification message from ServiceDesk to confirm your account."
      asideTitle="Almost there."
      asideItems={["Confirm your email address", "Name your cleaning business", "Start your workspace setup"]}
    >
      <p>If you don't see the email, check spam or wait a few minutes. The verification link should open ServiceDesk automatically.</p>
      <p>Already verified? <Link href="/auth/sign-in"><strong>Sign in to continue →</strong></Link></p>
    </RegistrationShell>
  );
}
