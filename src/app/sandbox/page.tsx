import type { Metadata } from "next";
import { SandboxJourney } from "@/features/sandbox/SandboxJourney";

export const metadata: Metadata = {
  title: "Interactive ServiceDesk Sandbox · Sample Data Only",
  description: "Explore an isolated, synthetic enquiry-to-invoice workflow. No messages or payments are sent.",
  robots: { index: false, follow: false },
};

export default function SandboxPage() {
  return <SandboxJourney />;
}
