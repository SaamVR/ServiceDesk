import Link from "next/link";
import type { ReactNode } from "react";
import { productRoutes } from "@/features/product/story-model";

interface MarketingShellProps {
  eyebrow?: string;
  title: string;
  description: string;
  children: ReactNode;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}

export function MarketingShell({
  eyebrow = "ServiceDesk AI for cleaning operations",
  title,
  description,
  children,
  primaryHref = "/features",
  primaryLabel = "Explore platform",
  secondaryHref = "/contact",
  secondaryLabel = "Book a walkthrough",
}: MarketingShellProps) {
  return (
    <main className="site-shell">
      <header className="site-header" aria-label="Product navigation">
        <Link className="brand-lockup" href="/" aria-label="ServiceDesk AI home">
          <span className="brand-mark" aria-hidden="true">SD</span>
          <span>ServiceDesk AI</span>
        </Link>
        <nav className="site-nav site-primary-nav" aria-label="Primary">
          {productRoutes.slice(1, 6).map((route) => (
            <Link key={route.href} href={route.href}>{route.label}</Link>
          ))}
        </nav>
        <Link className="site-auth-link" href="/auth/sign-in">Sign in</Link>
      </header>

      <section className="hero-grid section-card marketing-hero">
        <div className="stack-lg marketing-hero-copy">
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
            <Link className="button-primary" href={primaryHref}>{primaryLabel}</Link>
            <Link className="button-secondary" href={secondaryHref}>{secondaryLabel}</Link>
          </div>
        </div>
        <div className="interface-card marketing-hero-card" aria-label="ServiceDesk operational interface">
          <div className="browser-bar" aria-hidden="true"><span /><span /><span /></div>
          <div className="split-preview">
            <div>
              <p className="label">Conversation</p>
              <div className="message incoming">I need a move-out clean for 3 bedrooms, 2 bathrooms and oven.</div>
              <div className="message outgoing">I can prepare that. Please confirm the area and preferred date.</div>
              <div className="message incoming">SW11, next Friday morning.</div>
            </div>
            <aside>
              <p className="label">Structured request</p>
              <dl className="summary-list">
                <div><dt>Service</dt><dd>Move-out clean</dd></div>
                <div><dt>Quote</dt><dd>$340 total</dd></div>
                <div><dt>Deposit</dt><dd>$85</dd></div>
                <div><dt>Status</dt><dd><span className="status-pill attention">Needs slot</span></dd></div>
              </dl>
            </aside>
          </div>
        </div>
      </section>

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
