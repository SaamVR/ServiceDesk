import { redirect } from "next/navigation";
import {
  CustomerCard,
  CustomerEmptyState,
  CustomerNotice,
  CustomerPageHeader,
  PublicBusinessShell,
} from "@/components/product/CustomerFacingShell";
import { buildBusinessModuleHref, businessNavigation, type BusinessModule } from "./business-modules";
import { loadPublicBusiness, submitPublicEnquiry } from "./public-business-runtime";
import { FormActions, FormField, FormGrid, FormSection, SelectInput, TextArea, TextInput } from "@/components/product/FormPrimitives";
import styles from "./BusinessProductRoute.module.css";

interface BusinessProductRouteProps {
  slug: string;
  module: BusinessModule;
  notice?: string;
  error?: string;
  selectedServiceCode?: string;
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
                <a
                  className={styles.serviceAction}
                  href={buildBusinessModuleHref(slug, "enquire") + "?service=" + encodeURIComponent(service.code)}
                >
                  Enquire about this service
                </a>
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

function EnquiryView({
  slug,
  businessName,
  services,
  notice,
  error,
  selectedServiceCode,
}: {
  slug: string;
  businessName: string;
  services: Array<{ code: string; name: string; requiresReview: boolean }>;
  notice?: string;
  error?: string;
  selectedServiceCode?: string;
}) {
  const idempotencyKey = crypto.randomUUID();
  const selectedService = services.some((service) => service.code === selectedServiceCode)
    ? selectedServiceCode
    : undefined;

  async function submit(formData: FormData) {
    "use server";
    const bedroomsRaw = String(formData.get("bedrooms") ?? "");
    const bathroomsRaw = String(formData.get("bathrooms") ?? "");
    const result = await submitPublicEnquiry(slug, {
      displayName: String(formData.get("displayName") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      serviceCode: String(formData.get("serviceCode") ?? ""),
      preferredDate: String(formData.get("preferredDate") ?? ""),
      bedrooms: bedroomsRaw ? Number(bedroomsRaw) : undefined,
      bathrooms: bathroomsRaw ? Number(bathroomsRaw) : undefined,
      message: String(formData.get("message") ?? ""),
      idempotencyKey: String(formData.get("idempotencyKey") ?? ""),
    });
    const key = result.ok ? "notice" : "error";
    redirect(
      buildBusinessModuleHref(slug, "enquire") +
        "?" +
        key +
        "=" +
        encodeURIComponent(result.message),
    );
  }

  return (
    <>
      <CustomerPageHeader
        eyebrow={businessName}
        title="Tell us what you need"
        description="Send the details below and the team can review your request and follow up."
        backHref={buildBusinessModuleHref(slug, "home")}
        backLabel="Services"
      />

      <div className={styles.narrow}>
        {notice ? <CustomerNotice title="Enquiry sent" description={notice} tone="success" /> : null}
        {error ? <CustomerNotice title="Could not send enquiry" description={error} tone="warning" /> : null}

        <CustomerCard title="Service enquiry">
          <form action={submit}>
            <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
            <FormSection
              title="Your details"
              description="Add at least one way for the team to contact you."
            >
              <FormGrid columns={2}>
                <FormField id="public-enquiry-name" label="Name" required>
                  {({ id, describedBy, invalid }) => (
                    <TextInput id={id} name="displayName" autoComplete="name" required describedBy={describedBy} invalid={invalid} />
                  )}
                </FormField>
                <FormField id="public-enquiry-service" label="Service" required>
                  {({ id, describedBy, invalid }) => (
                    <SelectInput id={id} name="serviceCode" required defaultValue={selectedService} describedBy={describedBy} invalid={invalid}>
                      <option value="">Choose a service</option>
                      {services.map((service) => <option key={service.code} value={service.code}>{service.name}</option>)}
                    </SelectInput>
                  )}
                </FormField>
                <FormField id="public-enquiry-email" label="Email">
                  {({ id, describedBy, invalid }) => (
                    <TextInput id={id} name="email" type="email" autoComplete="email" describedBy={describedBy} invalid={invalid} />
                  )}
                </FormField>
                <FormField id="public-enquiry-phone" label="Phone">
                  {({ id, describedBy, invalid }) => (
                    <TextInput id={id} name="phone" type="tel" autoComplete="tel" describedBy={describedBy} invalid={invalid} />
                  )}
                </FormField>
                <FormField id="public-enquiry-date" label="Preferred date">
                  {({ id, describedBy, invalid }) => (
                    <TextInput id={id} name="preferredDate" type="date" describedBy={describedBy} invalid={invalid} />
                  )}
                </FormField>
                <FormField id="public-enquiry-bedrooms" label="Bedrooms">
                  {({ id, describedBy, invalid }) => (
                    <TextInput id={id} name="bedrooms" type="number" min={0} max={10} inputMode="numeric" describedBy={describedBy} invalid={invalid} />
                  )}
                </FormField>
                <FormField id="public-enquiry-bathrooms" label="Bathrooms">
                  {({ id, describedBy, invalid }) => (
                    <TextInput id={id} name="bathrooms" type="number" min={0} max={10} inputMode="numeric" describedBy={describedBy} invalid={invalid} />
                  )}
                </FormField>
              </FormGrid>
              <FormField id="public-enquiry-message" label="Anything else we should know?">
                {({ id, describedBy, invalid }) => (
                  <TextArea id={id} name="message" rows={5} maxLength={2000} describedBy={describedBy} invalid={invalid} />
                )}
              </FormField>
              <FormActions>
                <button className={styles.primaryButton} type="submit" disabled={services.length === 0}>
                  Send enquiry
                </button>
              </FormActions>
            </FormSection>
          </form>
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
              <span><strong>Accept when you’re ready</strong><span>An accepted quote lets the business move the service toward scheduling.</span></span>
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

export async function BusinessProductRoute({ slug, module, notice, error, selectedServiceCode }: BusinessProductRouteProps) {
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
          <EnquiryView
            slug={slug}
            businessName={result.value.workspace.name}
            services={result.value.services}
            notice={notice}
            error={error}
            selectedServiceCode={selectedServiceCode}
          />
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
