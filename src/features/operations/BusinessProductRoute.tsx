import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { buildBusinessModuleHref, businessNavigation, type BusinessModule } from "./business-modules";
import { loadPublicBusiness, submitPublicEnquiry, type PublicEnquiryResult } from "./public-business-runtime";
import styles from "./CustomerPublicProduct.module.css";

interface BusinessProductRouteProps {
  slug: string;
  module: BusinessModule;
  notice?: string;
  error?: string;
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

function enquiryRedirect(slug: string, result: PublicEnquiryResult): never {
  const key = result.ok ? "notice" : "error";
  redirect(buildBusinessModuleHref(slug, "enquire") + "?" + key + "=" + encodeURIComponent(result.message));
}

export async function BusinessProductRoute({ slug, module, notice, error }: BusinessProductRouteProps) {
  const result = await loadPublicBusiness(slug);
  const submissionId = crypto.randomUUID();

  async function submitEnquiry(formData: FormData) {
    "use server";

    // Honeypot: return the same success surface without creating a lead.
    if (String(formData.get("companyWebsite") ?? "").trim()) {
      enquiryRedirect(slug, {
        ok: true,
        message: "Thanks — your enquiry has been sent. The team can now follow up with you.",
        requestId: "filtered",
      });
    }

    const cookieStore = await cookies();
    let visitorSessionId = cookieStore.get("servicedesk_visitor_session")?.value;
    if (!visitorSessionId) {
      visitorSessionId = crypto.randomUUID();
      cookieStore.set("servicedesk_visitor_session", visitorSessionId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    const actionResult = await submitPublicEnquiry(slug, {
      visitorSessionId,
      submissionId: String(formData.get("submissionId") ?? ""),
      displayName: String(formData.get("displayName") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      serviceCode: String(formData.get("serviceCode") ?? ""),
      bedrooms: String(formData.get("bedrooms") ?? ""),
      bathrooms: String(formData.get("bathrooms") ?? ""),
      preferredDate: String(formData.get("preferredDate") ?? ""),
      message: String(formData.get("message") ?? ""),
    });
    enquiryRedirect(slug, actionResult);
  }

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
            <section className={styles.enquiryLayout}>
              <div className={styles.businessState}>
                <p className="eyebrow">Enquiry</p>
                <h1>Tell us what you need.</h1>
                <p>
                  Share a few details and the team will receive your enquiry in their ServiceDesk workspace.
                </p>
                <div className={styles.enquirySteps} aria-label="What happens next">
                  <span>1 · Send your details</span>
                  <span>2 · Team reviews the request</span>
                  <span>3 · Receive your quote</span>
                </div>
              </div>

              <form action={submitEnquiry} className={styles.enquiryForm}>
                <input type="hidden" name="submissionId" value={submissionId} />
                <label className={styles.honeypot} aria-hidden="true">
                  Company website
                  <input name="companyWebsite" tabIndex={-1} autoComplete="off" />
                </label>

                {notice ? <p className={styles.successNotice} role="status">{notice}</p> : null}
                {error ? <p className={styles.errorNotice} role="alert">{error}</p> : null}

                <div className={styles.fieldGrid}>
                  <label className={styles.field}>
                    <span>Name</span>
                    <input name="displayName" autoComplete="name" maxLength={120} required />
                  </label>
                  <label className={styles.field}>
                    <span>Email</span>
                    <input name="email" type="email" autoComplete="email" maxLength={254} />
                  </label>
                  <label className={styles.field}>
                    <span>Phone</span>
                    <input name="phone" type="tel" autoComplete="tel" maxLength={40} />
                  </label>
                  <label className={styles.field}>
                    <span>Service</span>
                    <select name="serviceCode" required defaultValue="">
                      <option value="" disabled>Choose a service</option>
                      {result.value.services.map((service) => (
                        <option value={service.code} key={service.code}>{service.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span>Bedrooms</span>
                    <input name="bedrooms" type="number" min={0} max={10} inputMode="numeric" />
                  </label>
                  <label className={styles.field}>
                    <span>Bathrooms</span>
                    <input name="bathrooms" type="number" min={0} max={10} inputMode="numeric" />
                  </label>
                  <label className={styles.field}>
                    <span>Preferred date</span>
                    <input name="preferredDate" type="date" />
                  </label>
                </div>

                <label className={styles.field}>
                  <span>Anything else we should know?</span>
                  <textarea
                    name="message"
                    rows={5}
                    maxLength={2000}
                    placeholder="Access notes, priorities, or questions"
                  />
                </label>

                <p className={styles.privacyNote}>
                  We’ll use these details to respond to this service enquiry. At least an email address or phone number is required.
                </p>
                <button className="button-primary" type="submit">
                  Send enquiry
                </button>
              </form>
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
