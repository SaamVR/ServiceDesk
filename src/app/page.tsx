import type { Metadata } from "next";
import { MarketingShell } from "@/components/shell/MarketingShell";
import { ownerRegistrationAvailable, ownerRegistrationPubliclyAvailable } from "@/features/auth/owner-registration-readiness";
import { BrightHomeExperience } from "@/features/product/BrightHomeExperience";
import { AutomationMotionHome } from "@/features/product/AutomationMotionHome";

export const metadata: Metadata = process.env.SERVICEDESK_PORTFOLIO_MODE === "true" ? {
  title: "Business Automation in Motion | ServiceDesk AI",
  description: "An interactive portfolio exploration of cleaning business workflows, 27 source automation starters and AI-assisted operations. Synthetic demonstrations, not a live SaaS.",
  openGraph: { type: "website", title: "Business Automation in Motion | ServiceDesk AI", description: "Explore the animated automation control room, AI use cases, integration map and 27 starter workflows." },
} : {
  title: "A cleaner way to run your cleaning business | ServiceDesk AI",
  description: "A brighter, calmer way to manage a cleaning business. ServiceDesk AI connects customer enquiries, human-reviewed quotes, schedules, field teams and follow-ups.",
  openGraph: {
    type: "website",
    title: "A cleaner way to run your cleaning business",
    description: "Beautifully simple cleaning operations, thoughtfully intelligent behind the scenes. Explore how ServiceDesk AI supports teams from first enquiry to final follow-up.",
  },
};

export default function HomePage() {
  const portfolioMode = process.env.SERVICEDESK_PORTFOLIO_MODE === "true";
  const canRegister = !portfolioMode && ownerRegistrationAvailable() && ownerRegistrationPubliclyAvailable();

  return (
    <MarketingShell
      homeEdition={!portfolioMode}
      brightEdition={portfolioMode}
      eyebrow="ServiceDesk AI for cleaning operations"
      title="A cleaner way to run your cleaning business."
      description="Beautifully simple for your team, thoughtfully intelligent behind the scenes."
      primaryHref={canRegister ? "/auth/sign-up" : "/tour"}
      primaryLabel={canRegister ? "Create your workspace" : "Explore product tour"}
      secondaryHref={canRegister ? "/tour" : "/features"}
      secondaryLabel={canRegister ? "Explore the product" : "View product features"}
    >
      {portfolioMode ? <AutomationMotionHome /> : <BrightHomeExperience canRegister={canRegister} />}
    </MarketingShell>
  );
}
