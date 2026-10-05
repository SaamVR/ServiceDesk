import { buildBusinessModuleHref, businessNavigation, type BusinessModule } from "./business-modules";
import { loadPublicBusiness } from "./public-business-runtime";

interface BusinessProductRouteProps {
  slug: string;
  module: BusinessModule;
}

function BusinessNavigation({ slug, module }: { slug: string; module: BusinessModule }) {
  return (
    <nav className="site-nav" aria-label="Business navigation">
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
    <main className="site-shell">
      <header className="site-header">
        <a className="brand-lockup" href={buildBusinessModuleHref(slug, "home")}>
          <span className="brand-mark" aria-hidden="true">SD</span>
          <span>{result.ok ? result.value.workspace.name : "Service business"}</span>
        </a>
        <BusinessNavigation slug={slug} module={module} />
      </header>

      <section className="section-card">
        {result.ok ? (
          module === "home" ? (
            <>
              <div className="section-heading">
                <p className="eyebrow">Professional cleaning services</p>
                <h1>Choose the service that fits your home.</h1>
                <p className="lead">
                  Browse the services currently offered by {result.value.workspace.name}.
                </p>
              </div>
              <div className="card-grid three">
                {result.value.services.length === 0 ? (
                  <section className="plain-card">
                    <h2>No services listed</h2>
                    <p>Please contact the business directly for current availability.</p>
                  </section>
                ) : (
                  result.value.services.map((service) => (
                    <article className="plain-card" key={service.code}>
                      <p className="label">{service.code.replaceAll("_", " ")}</p>
                      <h2>{service.name}</h2>
                      <p>
                        {service.requiresReview
                          ? "A team member will review the request before confirming the quote."
                          : "Available for request and quote review."}
                      </p>
                    </article>
                  ))
                )}
              </div>
              <div className="action-row">
                <a className="button-primary" href={buildBusinessModuleHref(slug, "enquire")}>
                  Start an enquiry
                </a>
                <a className="button-secondary" href="/portal">
                  Customer sign in
                </a>
              </div>
            </>
          ) : module === "enquire" ? (
            <section className="plain-card">
              <p className="eyebrow">Enquiry</p>
              <h1>Online enquiry is temporarily unavailable.</h1>
              <p>
                The business can publish its live service catalog, but this version does not yet
                have a customer-contact intake that can safely connect a web visitor to a follow-up
                record. No request will be submitted until that connection is available.
              </p>
              <button className="button-primary" type="button" disabled>
                Submit enquiry
              </button>
            </section>
          ) : (
            <section className="plain-card">
              <p className="eyebrow">Booking</p>
              <h1>Continue from an accepted quote.</h1>
              <p>
                Booking and payment start from your customer account after a quote is accepted.
                Online payments remain sandbox-only and are never shown as paid before the payment
                record is verified.
              </p>
              <a className="button-primary" href="/portal">
                Open customer portal
              </a>
            </section>
          )
        ) : (
          <section className="plain-card">
            <span className="status-pill attention">{result.kind.replaceAll("_", " ")}</span>
            <h1>Business page unavailable</h1>
            <p>{result.message}</p>
          </section>
        )}
      </section>
    </main>
  );
}
