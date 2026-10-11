"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./MarketingNavV3.module.css";

/** Concise information architecture for the public site. */
export const marketingLinks = [
  { href: "/features", label: "Product", description: "Explore the operations platform" },
  { href: "/use-cases/cleaning", label: "Solutions", description: "Built for cleaning teams" },
  { href: "/integrations", label: "Integrations", description: "Connect your existing tools" },
  { href: "/pricing", label: "Pricing", description: "Understand quote controls" },
] as const;

export function MarketingNavLinks({ variant }: { variant: "desktop" | "mobile" }) {
  const pathname = usePathname() ?? "";
  return (
    <>
      {marketingLinks.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={variant === "mobile" ? styles.mobileLink : styles.navLink}
          aria-current={pathname === item.href || pathname.startsWith(item.href + "/") ? "page" : undefined}
        >
          {variant === "mobile" ? (
            <>
              <span className={styles.mobileLinkCopy}>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
              <span className={styles.mobileLinkArrow} aria-hidden="true">↗</span>
            </>
          ) : item.label}
        </Link>
      ))}
    </>
  );
}
