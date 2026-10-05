import { buildBusinessModuleHref, businessNavigation, type BusinessModule } from "./business-modules";
import { loadPublicBusiness } from "./public-business-runtime";
import styles from "./CustomerPublicProduct.module.css";

interface BusinessProductRouteProps {
  slug: string;
  module: BusinessModule;
}

function BusinessNavigation({ slug, module }: { slug: string; module: BusinessModule }) {
  return (
    <nav className={styles.businessNav} aria-label="Business navigation">
      {businessNavigation.map((item) => (
        <a
          href={buildBusinessModuleHref(slug, item.module)}
          aria-current={item.module === module ? "page" : undefined}
          key={item.module}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}

export async function BusinessProductRoute({ slug, module }: BusinessProductRouteProps) {
  const result = await loadPublicBusiness(slug);

  return (
    <main className={styles.businessShell}>
      <header className={styles.businessHeader}>
        <a className={styles.businessBrand} href={buildBusinessModuleHref(slug, "home")}>
          <span className={styles.brandMark} aria-hidden="true">SD</span>
          <span>{result.ok ? result.value.workspace.name : "Service business"}</span>
        </a>
        <BusinessNavigation slug={slug} module={module} />
      </header>

      <section className={styles.businessBody}>
        {result.ok ? (
          module === "home" ? (
            <>
              <section className={styles.businessHero}>
                <div className={styles.businessHeroCopy}>
                  <p className="eyebrow">Professional home services</p>
                  <h1>Book the right service without the back-and-forth.</h1>
                  <p>
                    Choose from the services currently offered by {result.value.workspace.name},
                    then send the team the details they need to prepare your quote.
                  </p>
                </div>
                <div className={styles.businessHeroActions}>
                  <a className="button-primary" href={buildBusinessModuleHref(slug, "enquire")}>
                    Start an enquiry
                  </a>
                  <a className="button-secondary" href="/portal">
                    Customer sign in
                  </a>
                </div>
              </section>

              <section className={styles.serviceSection} aria-labelledby="services-heading">
                <div className={styles.serviceSectionHeader}>
                  <div>
                    <p className="eyebrow">Services</p>
                    <h2 id="services-heading">What we can help with</h2>
                  </div>
                </div>
                {result.value.services.length === 0 ? (
                  <section className="plain-card">
                    <h2>No services listed</h2>
                    <p>Please contact the business directly for current availability.</p>
                  </section>
                ) : (
                  <div className={styles.serviceGrid}>
                    {result.value.services.map((service) => (
                      <article className={styles.serviceCard} key={service.code}>
                        <p className={styles.serviceCode}>{service.code.replaceAll("_", " ")}</p>
                        <h3>{service.name}</h3>
                        <p>
                          {service.requiresReview
                            ? "We’ll review your details before confirming the quote."
                            : "Send your details to request a quote."}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : module === "enquire" ? (
            <section className={styles.businessState}>
              <p className="eyebrow">Enquiry</p>
              <h1>Online enquiries are being prepared.</h1>
              <p>
                The service list is live, but online contact intake is not connected yet.
                No request will be created until a secure contact flow is available.
              </p>
              <button className="button-primary" type="button" disabled>
                Submit enquiry
              </button>
            </section>
          ) : (
            <section className={styles.businessState}>
              <p className="eyebrow">Booking</p>
              <h1>Continue from your accepted quote.</h1>
              <p>
                Open your customer account to review booking and payment status.
                Online payment is not enabled for customer use yet.
              </p>
              <a className="button-primary" href="/portal">
                Open customer portal
              </a>
            </section>
          )
        ) : (
          <section className={styles.businessState}>
            <p className="eyebrow">Service unavailable</p>
            <h1>We can’t load this business page right now.</h1>
            <p>{result.message}</p>
          </section>
        )}
      </section>
    </main>
  );
}
