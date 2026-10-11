import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./MarketingNavV3.module.css";
import heroStyles from "./MarketingHeroV3.module.css";
import brightStyles from "@/features/product/BrightHomeExperience.module.css";
import { OperationalFlowHero } from "./OperationalFlowHero";
import { ProductStoryHero, type ProductStoryHeroKind } from "./ProductStoryHero";
import { MarketingNavLinks } from "./MarketingNavLinks";
import { ownerRegistrationAvailable, ownerRegistrationPubliclyAvailable } from "@/features/auth/owner-registration-readiness";
import { marketingHeroEntry, marketingRegistrationEntry } from "@/features/auth/marketing-entry-policy";

interface MarketingShellProps {
  eyebrow?: string;
  title: string;
  description: string;
  children: ReactNode;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  heroStory?: ProductStoryHeroKind;
  homeEdition?: boolean;
}

export function MarketingShell({
  eyebrow = "ServiceDesk AI for cleaning operations",
  title,
  description,
  children,
  primaryHref = "/features",
  primaryLabel = "Explore platform",
  secondaryHref = "/contact",
  secondaryLabel = "Plan a walkthrough",
  heroStory,
  homeEdition = false,
}: MarketingShellProps) {
  const registrationEnabled = ownerRegistrationAvailable() && ownerRegistrationPubliclyAvailable();
  const registration = marketingRegistrationEntry(registrationEnabled);
  const heroAction = marketingHeroEntry(registrationEnabled, primaryHref, primaryLabel);
  return (
    <main className={homeEdition ? `site-shell ${brightStyles.shell}` : "site-shell"}>
      <a className={styles.skipLink} href="#public-main-content">Skip to content</a>
      <header className={"site-header " + styles.header + (homeEdition ? " " + styles.brightHeader : "")} aria-label="Product navigation">
        <Link className={styles.brand} href="/" aria-label="ServiceDesk AI home">
          <span className={styles.brandIcon} aria-hidden="true">
            <svg width="38" height="38" viewBox="0 0 38 38" fill="none" focusable="false">
              <path d="M12 12.5h10.5l4 6.5-4 6.5H12" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="12.5" r="3" fill="currentColor" />
              <circle cx="12" cy="25.5" r="3" fill="currentColor" />
              <path d="m20.5 17 3.4 2-3.4 2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className={styles.brandCopy}>
            <span className={styles.brandName}>ServiceDesk <span className={styles.brandAi}>AI</span></span>
            <span className={styles.brandCaption}>THE OPERATIONS DESK</span>
          </span>
        </Link>
        <nav className={styles.desktopNav} aria-label="Primary navigation">
          <MarketingNavLinks variant="desktop" />
        </nav>
        <div className={styles.actions}>
          <Link className={styles.signIn} href="/auth/sign-in">Sign in</Link>
          <Link className={styles.primaryAction} href={registration.href}>
            <span className={styles.desktopActionLabel}>{registration.desktop}</span>
            <span className={styles.mobileActionLabel}>{registration.mobile}</span>
            <svg className={styles.actionArrow} width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
          <details className={styles.mobileMenu}>
            <summary className={styles.menuToggle} aria-label="Open product menu">
              <span className={styles.menuText}>Menu</span>
              <span className={styles.menuBars} aria-hidden="true"><span /><span /></span>
            </summary>
            <nav className={styles.mobileMenuPanel} aria-label="Mobile product navigation">
              <p className={styles.menuEyebrow}>Explore the platform</p>
              <MarketingNavLinks variant="mobile" />
              <div className={styles.mobileMenuFooter}>
                <Link href="/contact">Contact sales <span aria-hidden="true">↗</span></Link>
                <Link href="/help">Help center <span aria-hidden="true">↗</span></Link>
                <Link href="/auth/sign-in">Sign in <span aria-hidden="true">↗</span></Link>
              </div>
            </nav>
          </details>
        </div>
      </header>

      {!homeEdition && <section id="public-main-content" tabIndex={-1} className={`hero-grid section-card marketing-hero ${heroStyles.heroSection}`}>
        <div className={`stack-lg marketing-hero-copy ${heroStyles.heroCopy}`}>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="lead">{description}</p>
          <ul className="hero-capabilities" aria-label="Core ServiceDesk capabilities">
            <li>Structured intake</li>
            <li>Versioned quotes</li>
            <li>Human-approved dispatch</li>
            <li>Field proof & invoicing</li>
          </ul>
          <div className="action-row">
            <Link className="button-primary" href={heroAction.href}>{heroAction.label}</Link>
            <Link className="button-secondary" href={secondaryHref}>{secondaryLabel}</Link>
          </div>
        </div>
        {heroStory ? <ProductStoryHero kind={heroStory} /> : <OperationalFlowHero />}
      </section>}

      {children}

      <footer className="site-footer">
        <div>
          <strong>ServiceDesk AI</strong>
          <p>Customer communication, scheduling, payments and service operations in one practical workspace.</p>
        </div>
        <nav aria-label="Legal">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/help">Help</Link>
        </nav>
      </footer>
    </main>
  );
}
