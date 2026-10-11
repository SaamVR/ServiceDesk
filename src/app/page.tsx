import type { Metadata } from "next";
import { MarketingShell } from "@/components/shell/MarketingShell";
import { ownerRegistrationAvailable } from "@/features/auth/owner-registration-readiness";
import { BrightHomeExperience } from "@/features/product/BrightHomeExperience";

export const metadata: Metadata = {
  title: "A cleaner way to run your cleaning business",
  description: "A brighter, calmer way to manage a cleaning business. ServiceDesk AI connects customer enquiries, human-reviewed quotes, schedules, field teams and follow-ups.",
  openGraph: {
    type: "website",
    title: "A cleaner way to run your cleaning business",
    description: "Beautifully simple cleaning operations, thoughtfully intelligent behind the scenes. Explore how ServiceDesk AI supports teams from first enquiry to final follow-up.",
  },
};

export default function HomePage() {
  const canRegister = ownerRegistrationAvailable();

  return (
    <MarketingShell
      homeEdition
      eyebrow="ServiceDesk AI for cleaning operations"
      title="A cleaner way to run your cleaning business."
      description="Beautifully simple for your team, thoughtfully intelligent behind the scenes."
      primaryHref={canRegister ? "/auth/sign-up" : "/tour"}
      primaryLabel={canRegister ? "Create your workspace" : "Explore product tour"}
      secondaryHref={canRegister ? "/tour" : "/features"}
      secondaryLabel={canRegister ? "Explore the product" : "View product features"}
    >
      <BrightHomeExperience canRegister={canRegister} />
    </MarketingShell>
  );
}
