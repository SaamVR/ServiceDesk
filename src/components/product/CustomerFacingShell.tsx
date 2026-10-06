import type { ReactNode } from "react";
import styles from "./CustomerFacingShell.module.css";

export type CustomerFacingTone = "neutral" | "success" | "warning" | "danger" | "info";

function initials(value: string) {
  const letters = value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return letters || "SD";
}

export function CustomerPortalShell({
  businessName,
  customerName,
  authenticationRequired = false,
  activeSection,
  children,
}: {
  businessName: string;
  customerName?: string;
  authenticationRequired?: boolean;
  activeSection: "overview" | "properties" | "preferences" | "detail";
  children: ReactNode;
}) {
  const nav = [
    { id: "overview", label: "Overview", href: "/portal" },
    { id: "properties", label: "Properties", href: "/portal/properties" },
    { id: "preferences", label: "Preferences", href: "/portal/preferences" },
  ] as const;

  return (
    <div className={styles.portalShell}>
      <header className={styles.portalHeader}>
        <a className={styles.brand} href="/portal" aria-label={`${businessName} customer account`}>
          <span className={styles.brandMark} aria-hidden="true">{initials(businessName)}</span>
          <span className={styles.brandCopy}>
            <strong>{businessName}</strong>
            <small>Customer account</small>
          </span>
        </a>

        <nav className={styles.desktopNav} aria-label="Customer account">
          {nav.map((item) => (
            <a
              href={item.href}
              aria-current={activeSection === item.id ? "page" : undefined}
              key={item.id}
            >
              {item.label}
            </a>
          ))}
        </nav>

        {customerName ? (
          <div className={styles.accountActions}>
            <div className={styles.accountContext} aria-label="Signed-in customer">
              <span className={styles.accountAvatar} aria-hidden="true">{initials(customerName)}</span>
              <span>
                <small>Signed in as</small>
                <strong>{customerName}</strong>
              </span>
            </div>
            <form action="/auth/sign-out" method="post">
              <button className={styles.signOutButton} type="submit">Sign out</button>
            </form>
          </div>
        ) : authenticationRequired ? (
          <a className={styles.signInLink} href={"/auth/sign-in?next=" + encodeURIComponent("/portal")}>Sign in</a>
        ) : null}

        <details className={styles.mobileNav}>
          <summary>Menu</summary>
          <div className={styles.mobileNavPanel}>
            {customerName ? (
              <div className={styles.mobileAccount}>
                <span className={styles.accountAvatar} aria-hidden="true">{initials(customerName)}</span>
                <span>
                  <small>Signed in as</small>
                  <strong>{customerName}</strong>
                </span>
                <form action="/auth/sign-out" method="post">
                  <button className={styles.signOutButton} type="submit">Sign out</button>
                </form>
              </div>
            ) : null}
            <nav aria-label="Customer account mobile navigation">
              {nav.map((item) => (
                <a
                  href={item.href}
                  aria-current={activeSection === item.id ? "page" : undefined}
                  key={item.id}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </details>
      </header>
      <main className={styles.portalMain}>{children}</main>
    </div>
  );
}

export function PublicBusinessShell({
  businessName,
  homeHref,
  activeId,
  navItems,
  children,
}: {
  businessName: string;
  homeHref: string;
  activeId: string;
  navItems: ReadonlyArray<{ id: string; label: string; href: string }>;
  children: ReactNode;
}) {
  return (
    <div className={styles.businessShell}>
      <header className={styles.businessHeader}>
        <a className={styles.brand} href={homeHref} aria-label={`${businessName} home`}>
          <span className={styles.brandMark} aria-hidden="true">{initials(businessName)}</span>
          <span className={styles.brandCopy}>
            <strong>{businessName}</strong>
            <small>Home services</small>
          </span>
        </a>

        <nav className={styles.desktopNav} aria-label="Business">
          {navItems.map((item) => (
            <a href={item.href} aria-current={activeId === item.id ? "page" : undefined} key={item.id}>
              {item.label}
            </a>
          ))}
          <a className={styles.accountLink} href="/portal">Customer account</a>
        </nav>

        <details className={styles.mobileNav}>
          <summary>Menu</summary>
          <div className={styles.mobileNavPanel}>
            <nav aria-label="Business mobile navigation">
              {navItems.map((item) => (
                <a href={item.href} aria-current={activeId === item.id ? "page" : undefined} key={item.id}>
                  {item.label}
                </a>
              ))}
              <a href="/portal">Customer account</a>
            </nav>
          </div>
        </details>
      </header>
      <main className={styles.businessMain}>{children}</main>
      <footer className={styles.businessFooter}>
        <span>{businessName}</span>
        <a href="/portal">Existing customer? Open your account</a>
      </footer>
    </div>
  );
}

export function CustomerPageHeader({
  eyebrow,
  title,
  description,
  action,
  backHref,
  backLabel = "Back",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header className={styles.pageHeader}>
      <div className={styles.pageHeaderCopy}>
        {backHref ? <a className={styles.backLink} href={backHref}>← {backLabel}</a> : null}
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className={styles.pageDescription}>{description}</p> : null}
      </div>
      {action ? <div className={styles.pageAction}>{action}</div> : null}
    </header>
  );
}

export function CustomerCard({
  title,
  eyebrow,
  action,
  children,
  className,
}: {
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${styles.card} ${className ?? ""}`.trim()}>
      {title || eyebrow || action ? (
        <header className={styles.cardHeader}>
          <div>
            {eyebrow ? <p className={styles.cardEyebrow}>{eyebrow}</p> : null}
            {title ? <h2>{title}</h2> : null}
          </div>
          {action ? <div className={styles.cardAction}>{action}</div> : null}
        </header>
      ) : null}
      <div className={styles.cardBody}>{children}</div>
    </section>
  );
}

export function CustomerStatus({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: CustomerFacingTone;
}) {
  return <span className={`${styles.status} ${styles[`status_${tone}`]}`}>{children}</span>;
}

export function CustomerNotice({
  title,
  description,
  tone = "info",
  action,
  assertive = false,
}: {
  title: string;
  description?: string;
  tone?: CustomerFacingTone;
  action?: ReactNode;
  assertive?: boolean;
}) {
  return (
    <div
      className={`${styles.notice} ${styles[`notice_${tone}`]}`}
      role={assertive ? "alert" : "status"}
      aria-live={assertive ? "assertive" : "polite"}
    >
      <span className={styles.noticeMark} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className={styles.noticeAction}>{action}</div> : null}
    </div>
  );
}

export function CustomerEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptyMark} aria-hidden="true">✓</span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

export function CustomerSummaryList({
  children,
}: {
  children: ReactNode;
}) {
  return <dl className={styles.summaryList}>{children}</dl>;
}

export function CustomerSummaryItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function CustomerList({
  children,
}: {
  children: ReactNode;
}) {
  return <div className={styles.customerList}>{children}</div>;
}

export function CustomerListRow({
  title,
  meta,
  status,
  href,
}: {
  title: ReactNode;
  meta?: ReactNode;
  status?: ReactNode;
  href?: string;
}) {
  const content = (
    <>
      <span className={styles.rowCopy}>
        <strong>{title}</strong>
        {meta ? <small>{meta}</small> : null}
      </span>
      {status ? <span className={styles.rowStatus}>{status}</span> : null}
      {href ? <span className={styles.rowArrow} aria-hidden="true">›</span> : null}
    </>
  );

  return href ? (
    <a className={styles.customerRow} href={href}>{content}</a>
  ) : (
    <div className={styles.customerRow}>{content}</div>
  );
}

