import type { Metadata } from "next";
import { MarketingShell } from "@/components/shell/MarketingShell";
import { AutomationCaseStudy } from "@/features/product/AutomationCaseStudy";

export const metadata: Metadata = {
  title: "Business Automation Case Study | ServiceDesk AI",
  description: "An interactive portfolio case study of cleaning business operations: structured intake, reviewed quotes, crew scheduling, field work, and invoice follow-up. All sample data.",
  openGraph: {
    type: "website",
    title: "Business Automation Case Study | ServiceDesk AI",
    description: "Explore a human-controlled business automation prototype and browser-only interactive sandbox.",
  },
};

export default function BusinessAutomationCaseStudyPage() {
  return (
    <MarketingShell brightEdition title="Business automation case study" description="Explore the workflows behind ServiceDesk AI.">
      <AutomationCaseStudy />
    </MarketingShell>
  );
}
