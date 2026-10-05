import {
  CustomerCard,
  CustomerEmptyState,
  CustomerNotice,
  CustomerPageHeader,
  PublicBusinessShell,
} from "@/components/product/CustomerFacingShell";
import { buildBusinessModuleHref, businessNavigation, type BusinessModule } from "./business-modules";
import { loadPublicBusiness } from "./public-business-runtime";
import styles from "./BusinessProductRoute.module.css";

interface BusinessProductRouteProps {
  slug: string;
  module: BusinessModule;
}

function serviceInitial(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "S";
}

function navItems(slug: string) {
  return businessNavigation.map((item) => ({
    id: item.module,
    label: item.label,
    href: buildBusinessModuleHref(slug, item.module),
  }));
}

function HomeView({
  slug,
  businessName,
  services,
}: {
  slug: string;
  businessName: string;
  services: Array<{ code: string; name: string; requiresReview: boolean }>;
}) {
  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.heroEyebrow}>Home services</p>
          <h1>Simple service booking, with clear next steps.</h1>
          <p>
            Explore the services currently offered by {businessName}, then send an enquiry so the
            team can confirm the right service and next available step.
          </p>
        </div>

        <aside className={styles.heroPanel} aria-label="How to get started">
          <strong>Need a service?</strong>
          <p>Tell the team what you need. They will review your request and confirm what happens next.</p>
          <div className={styles.actionRow}>
            <a className={styles.primaryButton} href={buildBusinessModuleHref(slug, "enquire")}>
              Start an enquiry
            </a>
            <a className={styles.secondaryButton} href="/portal">
              Customer account
            </a>
          </div>
        </aside>
      </section>

      <section className={styles.serviceSection} aria-labelledby="available-services">
        <header className={styles.sectionHeader}>
          <div>
            <h2 id="available-services">Available services</h2>
            <p>Choose the service closest to what you need. Final details are confirmed before booking.</p>
          </div>
        </header>

        {services.length === 0 ? (
          <CustomerEmptyState
            title="No services are listed online right now"
            description="Please check again later for current service availability."
          />
        ) : (
          <div className={styles.serviceGrid}>
            {services.map((service) => (
              <article className={styles.serviceCard} key={service.code}>
                <span className={styles.serviceIcon} aria-hidden="true">{serviceInitial(service.name)}</span>
                <div>
                  <h3>{service.name}</h3>
                  <p>
                    {service.requiresReview
                      ? "The team will review your request before confirming the service details."
                      : "This service is currently available to request."}
                  </p>
                </div>
                <span className={styles.serviceMeta}>
                  {service.requiresReview ? "Request review required" : "Available to request"}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={styles.ctaBand}>
        <div>
          <h2>Ready to get started?</h2>
          <p>Send an enquiry with what you need and the team can take it from there.</p>
        </div>
        <a className={styles.primaryButton} href={buildBusinessModuleHref(slug, "enquire")}>
          Start an enquiry
        </a>
      </section>
    </>
  );
}

function EnquiryView({ slug, businessName }: { slug: string; businessName: string }) {
  return (
    <>
      <CustomerPageHeader
        eyebrow={businessName}
        title="Tell us what you need"
        description="New online enquiries cannot be submitted from this page yet."
        backHref={buildBusinessModuleHref(slug, "home")}
        backLabel="Services"
      />

      <div className={styles.narrow}>
        <CustomerCard title="Online enquiry">
          <CustomerNotice
            title="Enquiry form temporarily unavailable"
            description="No request will be created from this page right now. Existing customers can open their account to review current quotes and bookings."
            tone="info"
          />
          <div className={styles.actionRow}>
            <a className={styles.primaryButton} href="/portal">Open customer account</a>
            <a className={styles.secondaryButton} href={buildBusinessModuleHref(slug, "home")}>View services</a>
          </div>
        </CustomerCard>
      </div>
    </>
  );
}

function BookingView({ slug, businessName }: { slug: string; businessName: string }) {
  return (
    <>
      <CustomerPageHeader
        eyebrow={businessName}
        title="Continue from an accepted quote"
        description="Booking details are managed from your customer account after your quote is accepted."
        backHref={buildBusinessModuleHref(slug, "home")}
        backLabel="Services"
      />

      <div className={styles.narrow}>
        <CustomerCard title="How booking works">
          <ol className={styles.pathSteps}>
            <li>
              <span className={styles.stepNumber}>1</span>
              <span><strong>Review your quote</strong><span>Open the latest quote in your customer account.</span></span>
            </li>
            <li>
              <span className={styles.stepNumber}>2</span>
              <span><strong>Accept when you're ready</strong><span>An accepted quote lets the business move the service toward scheduling.</span></span>
            </li>
            <li>
              <span className={styles.stepNumber}>3</span>
              <span><strong>Follow the confirmed booking</strong><span>Your booking and any invoice will appear in the same account.</span></span>
            </li>
          </ol>

          <div className={styles.actionRow}>
            <a className={styles.primaryButton} href="/portal">Open customer account</a>
            <a className={styles.secondaryButton} href={buildBusinessModuleHref(slug, "home")}>View services</a>
          </div>
        </CustomerCard>
      </div>
    </>
  );
}

export async function BusinessProductRoute({ slug, module }: BusinessProductRouteProps) {
  const result = await loadPublicBusiness(slug);
  const businessName = result.ok ? result.value.workspace.name : "Service business";
  const homeHref = buildBusinessModuleHref(slug, "home");

  return (
    <PublicBusinessShell
      businessName={businessName}
      homeHref={homeHref}
      activeId={module}
      navItems={navItems(slug)}
    >
      {result.ok ? (
        module === "home" ? (
          <HomeView
            slug={slug}
            businessName={result.value.workspace.name}
            services={result.value.services}
          />
        ) : module === "enquire" ? (
          <EnquiryView slug={slug} businessName={result.value.workspace.name} />
        ) : (
          <BookingView slug={slug} businessName={result.value.workspace.name} />
        )
      ) : (
        <>
          <CustomerPageHeader
            eyebrow="Service information"
            title="Business page unavailable"
            description="We couldn't load this business page right now."
          />
          <CustomerEmptyState
            title="Please try again later"
            description={result.message}
          />
        </>
      )}
    </PublicBusinessShell>
  );
}
