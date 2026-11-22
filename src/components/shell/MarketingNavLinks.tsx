"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./MarketingNavV3.module.css";

/** Concise information architecture for the public site. */
export const marketingLinks = [
  { href: "/work/business-automation", label: "Case study", description: "See the automation project" },
  { href: "/features", label: "Product", description: "Explore the operations platform" },
  { href: "/use-cases/cleaning", label: "Solutions", description: "Built for cleaning teams" },
  { href: "/integrations", label: "Integrations", description: "Connect your existing tools" },
  { href: "/pricing", label: "Pricing", description: "Understand quote controls" },
] as const;

const portfolioLinks = [
  { href: "/demo", label: "Dashboard demo", description: "Explore the guided operations workspace" },
  { href: "/#scenario-lab", label: "Live scenario", description: "Trigger and inspect connected business events" },
  { href: "/#ai-studio", label: "AI studio", description: "Explore six AI-assisted examples" },
  { href: "/#playbooks", label: "27 automations", description: "Search the real draft rule catalogue" },
  { href: "/#integrations", label: "Integrations", description: "Inspect evidence and provider handoffs" },
  { href: "/work/business-automation", label: "Case study", description: "Read the design and engineering story" },
] as const;

export function MarketingNavLinks({ variant, portfolioMode = false }: { variant: "desktop" | "mobile"; portfolioMode?: boolean }) {
  const pathname = usePathname() ?? "";
  return (
    <>
      {(portfolioMode ? portfolioLinks : marketingLinks).map((item) => (
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
