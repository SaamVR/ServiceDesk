import Link from "next/link";
import { RegistrationShell } from "@/features/auth/RegistrationShell";

export default function ResetEmailPage() {
  return (
    <RegistrationShell
      eyebrow="Secure account recovery"
      title="Check your inbox."
      description="If your email address is linked to an account, we’ll send a password reset link shortly."
      asideTitle="Back to your work, safely."
      asideItems={["Open the password reset email", "Set a new private password", "Sign in to your existing workspace"]}
    >
      <p>Check your spam folder if you can’t find the message. For security we don’t confirm whether an account exists.</p>
      <p><Link href="/auth/sign-in"><strong>Return to sign in →</strong></Link></p>
    </RegistrationShell>
  );
}
