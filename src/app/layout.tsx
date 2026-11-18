import type { Metadata } from "next";
import "./globals.css";
import "./responsive-a11y.css";

// Public indexing is an explicit deployment/release decision. Preview
// builds are noindex/nofollow by default until the owner approves publication.
const publicIndexingEnabled = process.env.SERVICEDESK_PUBLIC_INDEXING_ENABLED === "true";

export const metadata: Metadata = {
  title: {
    default: "ServiceDesk AI | Cleaning Operations Workspace",
    template: "%s | ServiceDesk AI",
  },
  description: "A cleaning operations workspace connecting customer enquiries, quotes, dispatch, field jobs, invoicing and quality review.",
  robots: {
    index: publicIndexingEnabled,
    follow: publicIndexingEnabled,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to main content</a>
        <div id="main-content">{children}</div>
      </body>
    </html>
  );
}
