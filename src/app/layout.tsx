import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ServiceDesk AI",
  description: "Operations platform for residential cleaning businesses",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
