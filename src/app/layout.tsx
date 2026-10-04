import type { Metadata } from "next";
import "./globals.css";
import "./responsive-a11y.css";

export const metadata: Metadata = {
  title: "ServiceDesk AI",
  description: "Operations platform for residential cleaning businesses",
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
