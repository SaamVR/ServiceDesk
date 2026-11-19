import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DemoOperationsDashboard } from "@/features/product/DemoOperationsDashboard";

export const metadata: Metadata = {
  title: "Guided Operations Dashboard · ServiceDesk AI Portfolio",
  description: "Explore a complete sample cleaning business operations workspace. Pricing, lifecycle, AI draft review and automation catalog. Browser-only fictional data.",
  robots: { index: false, follow: false },
};

export default function DemoDashboardPage() {
  if (process.env.SERVICEDESK_PORTFOLIO_MODE !== "true") notFound();
  return <DemoOperationsDashboard />;
}
